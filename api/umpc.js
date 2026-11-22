"use strict";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BICO_HOST_RE =
  /(^|\.)(bicolink\.com|bico\.link|bicosafe\.com|bicolink\.net|bclnk\.net)$/i;

const SKIP_HOST_RE =
  /(^|\.)(bicolink\.com|bico\.link|bicosafe\.com|bicolink\.net|bclnk\.net|google\.com|googleapis\.com|gstatic\.com|cloudflare\.com|cloudflareinsights\.com|jquery\.com|bootstrap\.com|bootstrapcdn\.com|fontawesome\.com|jsdelivr\.net|unpkg\.com|w3\.org|googletagmanager\.com|google-analytics\.com|facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|youtu\.be|tiktok\.com|discord\.com|discord\.gg)$/i;

function decodeEntities(str) {
  return String(str || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String(fromCodePointSafe(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function fromCodePointSafe(d) {
  try {
    return String.fromCodePoint(parseInt(d, 10));
  } catch {
    return "";
  }
}

function decodeBase64Candidate(raw) {
  try {
    let s = String(raw || "").trim().replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const out = Buffer.from(s, "base64").toString("utf8");
    return out;
  } catch {
    return "";
  }
}

function isStaticOrAsset(u) {
  const p = (u.pathname || "").toLowerCase();
  return (
    p.includes("/beacon.min.js") ||
    p.includes("/cdn-cgi/") ||
    /\.(?:js|css|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|map)(?:$|[?#])/i.test(p)
  );
}

function isValidTargetUrl(href, sourceUrl) {
  try {
    const u = new URL(href);
    if (!/^https?:$/i.test(u.protocol)) return false;
    if (u.href === sourceUrl) return false;
    if (SKIP_HOST_RE.test(u.hostname)) return false;
    if (isStaticOrAsset(u)) return false;
    return true;
  } catch {
    return false;
  }
}

function extractTargetFromContent(content, baseUrl, sourceUrl, trace) {
  if (!content) return null;
  const text = decodeEntities(String(content).replace(/\\\//g, "/"));

  // 1. Cek query parameter umum seperti ?url= / ?u= / ?link= / ?target= / ?dest= / ?r=
  try {
    const bu = new URL(baseUrl);
    for (const key of ["url", "u", "link", "target", "dest", "destination", "redirect", "r", "go"]) {
      const val = bu.searchParams.get(key);
      if (val) {
        const candidate = /^https?:\/\//i.test(val) ? val : decodeBase64Candidate(val);
        if (candidate && isValidTargetUrl(candidate, sourceUrl)) {
          trace.push(`bico query ${key} -> ${candidate}`);
          return candidate;
        }
      }
    }
  } catch {}

  // 2. Pola redirect / tombol / variabel JS / meta refresh / form action
  const directPatterns = [
    /(?:window\.location(?:\.href)?|document\.location(?:\.href)?|top\.location(?:\.href)?|location\.replace|location\.assign|window\.open)\s*\(\s*["'`](https?:\/\/[^"'`\s<>]+)["'`]/gi,
    /(?:var|let|const)\s+(?:url|link|target|dest|destination|redirect|final_url|go_url|next_url)\w*\s*[:=]\s*["'`](https?:\/\/[^"'`\s<>]+)["'`]/gi,
    /["'](?:url|link|target|dest|destination|redirect|final_url)["']\s*:\s*["'`](https?:\/\/[^"'`\s<>]+)["'`]/gi,
    /<a[^>]+(?:id|class)=["'][^"']*(?:link|get|go|continue|download|dest|target|skip|next|btn)[^"']*["'][^>]*href=["'](https?:\/\/[^"'\s<>]+)["']/gi,
    /<a[^>]+href=["'](https?:\/\/[^"'\s<>]+)["'][^>]+(?:id|class)=["'][^"']*(?:link|get|go|continue|download|dest|target|skip|next|btn)/gi,
    /data-(?:url|link|href|target|dest|redirect)=["'](https?:\/\/[^"'\s<>]+)["']/gi,
    /<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"'>\s;]+)/gi,
    /<form[^>]+action=["'](https?:\/\/[^"'\s<>]+)["']/gi,
  ];

  for (const re of directPatterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const rawCand = (m[1] || "").trim().replace(/[,;'"`\])]+$/, "");
      if (isValidTargetUrl(rawCand, sourceUrl)) {
        trace.push(`bico pattern -> ${rawCand}`);
        return rawCand;
      }
    }
  }

  // 3. Cek base64 (atob(...) atau string base64 panjang yang ter-decode menjadi http(s)://)
  const b64Matches = [
    ...text.matchAll(/atob\s*\(\s*["'`]([A-Za-z0-9+/=_-]{16,})["'`]\s*\)/g),
    ...text.matchAll(/["'`](aHR0c[A-Za-z0-9+/=_-]{14,})["'`]/g),
  ];
  for (const bm of b64Matches) {
    const decoded = decodeBase64Candidate(bm[1]).trim();
    if (isValidTargetUrl(decoded, sourceUrl)) {
      trace.push(`bico base64 -> ${decoded}`);
      return decoded;
    }
  }

  // 4. Scan semua URL http/https yang muncul di body
  const allUrls = text.match(/https?:\/\/[^\s"'<>\\)\]]+/gi) || [];
  for (const raw of allUrls) {
    const cleaned = raw.replace(/[,;'"`\])]+$/, "");
    if (isValidTargetUrl(cleaned, sourceUrl)) {
      trace.push(`bico fallback url -> ${cleaned}`);
      return cleaned;
    }
  }

  return null;
}

class BicoSession {
  constructor() {
    this.cookies = new Map();
  }

  storeCookies(res, url) {
    const host = new URL(url).hostname.toLowerCase();
    const list =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : res.headers.get("set-cookie")
          ? [res.headers.get("set-cookie")]
          : [];
    for (const c of list) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) {
        const name = pair.slice(0, eq).trim();
        const val = pair.slice(eq + 1).trim();
        if (/max-age=0/i.test(c) || /expires=Thu, 01 Jan 1970/i.test(c)) {
          this.cookies.delete(`${host}:${name}`);
        } else {
          this.cookies.set(`${host}:${name}`, val);
        }
      }
    }
  }

  cookieHeader(url) {
    const host = new URL(url).hostname.toLowerCase();
    const out = [];
    for (const [k, v] of this.cookies) {
      const idx = k.indexOf(":");
      const h = k.slice(0, idx);
      const name = k.slice(idx + 1);
      if (host === h || host.endsWith("." + h)) {
        out.push(`${name}=${v}`);
      }
    }
    return out.join("; ");
  }

  async request(url, opts = {}) {
    const headers = {
      "User-Agent": UA,
      Accept:
        opts.accept ||
        "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      ...(opts.headers || {}),
    };
    const ck = this.cookieHeader(url);
    if (ck) headers.Cookie = ck;

    const res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body: opts.body,
      redirect: opts.redirect || "manual",
      signal: AbortSignal.timeout(opts.timeoutMs || 15000),
    });
    this.storeCookies(res, url);
    const text = await res.text();
    return {
      status: res.status,
      url,
      location: res.headers.get("location"),
      headers: res.headers,
      text,
    };
  }
}

async function bypassBico(inputUrl) {
  const t0 = Date.now();
  const trace = [];
  const result = {
    status: false,
    source: "bicolink",
    data: null,
    error: null,
    execution_time_ms: 0,
  };

  try {
    const normalized = /^https?:\/\//i.test(String(inputUrl || "").trim())
      ? String(inputUrl || "").trim()
      : "https://" + String(inputUrl || "").trim();

    let parsed;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new Error("URL Bicolink tidak valid.");
    }

    const host = parsed.hostname.toLowerCase();
    if (!BICO_HOST_RE.test(host)) {
      throw new Error(`Host ${host} bukan domain Bicolink yang didukung.`);
    }

    const session = new BicoSession();
    let currentUrl = parsed.href;
    let referer = "";
    let bypassedUrl = null;
    let lastHtml = "";

    // Ikuti rantai redirect hingga 8 hop
    for (let hop = 0; hop < 8; hop++) {
      const res = await session.request(currentUrl, {
        method: "GET",
        referer,
        redirect: "manual",
      });
      trace.push(`hop ${hop + 1} ${new URL(currentUrl).hostname} -> ${res.status}`);
      lastHtml = res.text || "";

      if ([301, 302, 303, 307, 308].includes(res.status) && res.location) {
        const nextUrl = new URL(res.location, currentUrl).href;
        if (isValidTargetUrl(nextUrl, parsed.href)) {
          bypassedUrl = nextUrl;
          break;
        }
        referer = currentUrl;
        currentUrl = nextUrl;
        continue;
      }

      if (res.status >= 400) {
        throw new Error(`${new URL(currentUrl).hostname} mengembalikan HTTP ${res.status}.`);
      }

      const found = extractTargetFromContent(lastHtml, currentUrl, parsed.href, trace);
      if (found) {
        bypassedUrl = found;
        break;
      }

      break;
    }

    // Jika belum ketemu, coba POST ke endpoint umum pada domain aktif dan domain asal
    if (!bypassedUrl) {
      const activeHost = (() => {
        try {
          return new URL(currentUrl).hostname.toLowerCase();
        } catch {
          return host;
        }
      })();
      const slug = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
      const candidateHosts = [...new Set([activeHost, host])];
      const candidatePaths = ["/go", "/get", "/link", "/unlock", "/redirect", "/api/link", "/api/go"];

      for (const h of candidateHosts) {
        for (const p of candidatePaths) {
          if (Date.now() - t0 > 18000) break;
          const ep = `https://${h}${p}`;
          try {
            const postRes = await session.request(ep, {
              method: "POST",
              referer: currentUrl,
              redirect: "manual",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug, id: slug, code: slug, url: parsed.href }),
            });
            if ([301, 302, 303, 307, 308].includes(postRes.status) && postRes.location) {
              const loc = new URL(postRes.location, ep).href;
              if (isValidTargetUrl(loc, parsed.href)) {
                bypassedUrl = loc;
                trace.push(`bico post redirect ${h}${p} -> ${loc}`);
                break;
              }
            }
            const foundPost = extractTargetFromContent(postRes.text, ep, parsed.href, trace);
            if (foundPost) {
              bypassedUrl = foundPost;
              break;
            }
          } catch {}
        }
        if (bypassedUrl) break;
      }
    }

    if (!bypassedUrl) {
      throw new Error(
        `URL tujuan tidak ditemukan pada ${host}. Struktur halaman atau proteksi anti-bot pada domain mirror mungkin berbeda dari bicolink.com.`
      );
    }

    let destHost = "";
    try {
      destHost = new URL(bypassedUrl).hostname;
    } catch {}

    result.status = true;
    result.data = {
      source_url: parsed.href,
      bypassed_url: bypassedUrl,
      host: destHost,
      steps: trace,
    };
  } catch (err) {
    result.error = (err && err.message) || "Gagal bypass Bicolink.";
  }

  result.execution_time_ms = Date.now() - t0;
  return result;
}

async function directHandler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const rawUrl = (req && req.url) || "/";
  const target = new URL(rawUrl, "http://localhost").searchParams.get("url") || "";
  const out = await bypassBico(target);
  res.statusCode = out.status ? 200 : 502;
  res.end(JSON.stringify(out));
}

module.exports = { bypass: bypassBico, bypassBico, directHandler };
module.exports.default = directHandler;
module.exports.handler = directHandler;
