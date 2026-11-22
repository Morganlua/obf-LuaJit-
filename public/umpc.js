"use strict";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BICO_HOST_RE =
  /(^|\.)(bicolink\.com|bico\.link|bicosafe\.com|bicolink\.net|bclnk\.net)$/i;

// Domain iklan / pop-under / smartlink / tracker yang sering disisipkan pada halaman shortlink
const AD_OR_SKIP_HOST_RE =
  /(^|\.)(bicolink\.com|bico\.link|bicosafe\.com|bicolink\.net|bclnk\.net|honmia\.com|google\.com|googleapis\.com|gstatic\.com|cloudflare\.com|cloudflareinsights\.com|jquery\.com|bootstrap\.com|bootstrapcdn\.com|fontawesome\.com|jsdelivr\.net|unpkg\.com|w3\.org|googletagmanager\.com|google-analytics\.com|doubleclick\.net|googlesyndication\.com|adservice\.google\.com|facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|youtu\.be|tiktok\.com|discord\.com|discord\.gg|histats\.com|histats\.net|popads\.net|propellerads\.com|exoclick\.com|hilltopads\.net|adsterra\.com|monetag\.com)$/i;

function decodeEntities(str) {
  return String(str || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_, d) => {
      try {
        return String.fromCodePoint(parseInt(d, 10));
      } catch {
        return "";
      }
    })
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function decodeBase64Candidate(raw) {
  try {
    let s = String(raw || "").trim().replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return Buffer.from(s, "base64").toString("utf8");
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

function isAdLikePath(u) {
  const p = (u.pathname || "").toLowerCase();
  return /^\/(?:4|5|6|7|8|9)\/[0-9a-f]{16,}$/i.test(p) || /\/(?:ad|ads|banner|popup|popunder|smartlink|clk|clickout)\b/i.test(p);
}

function isValidTargetUrl(href, sourceUrl) {
  try {
    const u = new URL(href);
    if (!/^https?:$/i.test(u.protocol)) return false;
    if (u.href === sourceUrl) return false;
    if (AD_OR_SKIP_HOST_RE.test(u.hostname)) return false;
    if (isStaticOrAsset(u)) return false;
    if (isAdLikePath(u)) return false;
    return true;
  } catch {
    return false;
  }
}

function extractTargetFromContent(content, baseUrl, sourceUrl, trace) {
  if (!content) return null;
  const text = decodeEntities(String(content).replace(/\\\//g, "/"));

  // 1. Cek query parameter tujuan eksplisit pada URL saat ini
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

  // 2. Prioritaskan link tombol/redirect/variabel eksplisit yang bukan iklan
  const directPatterns = [
    /(?:window\.location(?:\.href)?|document\.location(?:\.href)?|top\.location(?:\.href)?|location\.replace|location\.assign)\s*\(\s*["'`](https?:\/\/[^"'`\s<>]+)["'`]/gi,
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

  // 3. Cek base64 yang ter-decode menjadi URL tujuan valid
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

    for (let hop = 0; hop < 6; hop++) {
      const res = await session.request(currentUrl, {
        method: "GET",
        referer,
        redirect: "manual",
      });
      trace.push(`hop ${hop + 1} ${new URL(currentUrl).hostname} -> ${res.status}`);
      lastHtml = res.text || "";

      if ([301, 302, 303, 307, 308].includes(res.status) && res.location) {
        const nextUrl = new URL(res.location, currentUrl).href;
        // Jika redirect mengarah ke domain iklan/smartlink seperti honmia.com, jangan dijadikan link tujuan
        if (isValidTargetUrl(nextUrl, parsed.href)) {
          bypassedUrl = nextUrl;
          break;
        }
        try {
          const nextHost = new URL(nextUrl).hostname.toLowerCase();
          if (!BICO_HOST_RE.test(nextHost)) {
            trace.push(`lewati redirect non-bicolink/iklan: ${nextUrl}`);
            break;
          }
        } catch {
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

    if (!bypassedUrl) {
      throw new Error(
        `URL tujuan asli tidak ditemukan pada ${host} (halaman mungkin memakai step/timer/verifikasi di browser dan menyisipkan link iklan).`
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
