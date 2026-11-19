"use strict";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SOCIAL_HOST_RE =
  /(^|\.)(rekonise\.com|sub2unlock\.(com|net)|ytsubme\.com|sub4unlock\.(io|com)|unlocknow\.net|sub2get\.com|subfinal\.com|mboost\.me|social-unlock\.com|socialwolvez\.com|paster\.(so|gg)|cuty\.io|adfoc\.us|mendationforc\.info)$/i;

const SKIP_HOST_RE =
  /(^|\.)(rekonise\.com|sub2unlock\.(com|net)|ytsubme\.com|sub4unlock\.(io|com)|unlocknow\.net|sub2get\.com|subfinal\.com|mboost\.me|social-unlock\.com|socialwolvez\.com|paster\.(so|gg)|cuty\.io|adfoc\.us|mendationforc\.info|facebook\.com|twitter\.com|x\.com|youtube\.com|youtu\.be|instagram\.com|tiktok\.com|discord\.com|discord\.gg|google\.com|googleapis\.com|gstatic\.com|cloudflare\.com|jquery\.com|w3\.org)$/i;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeB64(str) {
  try {
    let norm = String(str || "").trim().replace(/-/g, "+").replace(/_/g, "/");
    while (norm.length % 4) norm += "=";
    return Buffer.from(norm, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function guessDestination(text, sourceUrl) {
  if (!text) return null;
  const cleaned = String(text).replace(/\\\//g, "/");
  const matches = cleaned.match(/https?:\/\/[^\s"'<>\\)\]]+/gi) || [];
  for (const raw of matches) {
    try {
      const u = new URL(raw.replace(/[,;]+$/, ""));
      if (!SKIP_HOST_RE.test(u.hostname) && u.href !== sourceUrl) {
        return u.href;
      }
    } catch {}
  }
  return null;
}

class SimpleSession {
  constructor() {
    this.cookies = new Map();
  }
  storeCookies(res, url) {
    const host = new URL(url).hostname;
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
        this.cookies.set(`${host}:${pair.slice(0, eq).trim()}`, pair.slice(eq + 1).trim());
      }
    }
  }
  cookieHeader(url) {
    const host = new URL(url).hostname;
    const out = [];
    for (const [k, v] of this.cookies) {
      const [h, name] = k.split(":");
      if (host === h || host.endsWith("." + h)) out.push(`${name}=${v}`);
    }
    return out.join("; ");
  }
  async get(url, opts = {}) {
    let cur = url;
    for (let hop = 0; hop < 8; hop++) {
      const headers = {
        "User-Agent": UA,
        Accept: opts.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
        ...(opts.headers || {}),
      };
      const ck = this.cookieHeader(cur);
      if (ck) headers.Cookie = ck;
      const res = await fetch(cur, {
        method: "GET",
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(opts.timeoutMs || 18000),
      });
      this.storeCookies(res, cur);
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("location");
        if (!loc) break;
        cur = new URL(loc, cur).href;
        continue;
      }
      const text = await res.text();
      return { status: res.status, url: cur, headers: res.headers, text };
    }
    throw new Error("Terlalu banyak redirect pada social unlock.");
  }
  async postJson(url, payload, opts = {}) {
    const headers = {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    };
    const ck = this.cookieHeader(url);
    if (ck) headers.Cookie = ck;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload || {}),
      signal: AbortSignal.timeout(opts.timeoutMs || 12000),
    });
    this.storeCookies(res, url);
    const text = await res.text();
    return { status: res.status, url, headers: res.headers, text };
  }
}

async function bypassRekonise(parsedUrl, trace) {
  const s = new SimpleSession();
  const path = parsedUrl.pathname;
  const r = await s.get(`https://api.rekonise.com/social-unlocks${path}`, {
    accept: "application/json, text/plain, */*",
  });
  trace.push(`rekonise api -> ${r.status}`);
  let data = null;
  try {
    data = JSON.parse(r.text);
  } catch {
    throw new Error("Respon api.rekonise.com bukan JSON.");
  }
  if (data && data.url) return data.url;
  const ut = data && data.unlock_token;
  if (ut) {
    const deadline = Date.now() + 35000;
    while (Date.now() < deadline) {
      await delay(5000);
      const uRes = await s.get(
        `https://api.rekonise.com/social-unlocks${path}/unlock?token=${encodeURIComponent(ut)}`,
        { accept: "application/json, text/plain, */*" }
      );
      trace.push(`rekonise unlock poll -> ${uRes.status}`);
      if (uRes.status === 200) {
        try {
          const d2 = JSON.parse(uRes.text);
          if (d2 && d2.url) return d2.url;
        } catch {}
      }
    }
  }
  const dest = guessDestination(JSON.stringify(data), parsedUrl.href);
  if (dest) return dest;
  throw new Error("rekonise: gagal mendapatkan URL tujuan.");
}

async function bypassSub2UnlockCom(parsedUrl, trace) {
  const vid = parsedUrl.pathname.replace(/^\/+|\/+$/g, "").split("/").pop() || "";
  const s = new SimpleSession();
  const r = await s.get(`https://sub2unlock.com/link/unlock/${encodeURIComponent(vid)}`);
  trace.push(`sub2unlock.com unlock -> ${r.status}`);
  const m =
    r.text.match(/<a[^>]+id=["']link["'][^>]+href=["']([^"']+)["']/i) ||
    r.text.match(/href=["'](https?:\/\/[^"']+)["'][^>]*id=["']link["']/i);
  if (m && m[1].startsWith("http")) return m[1];
  const dest = guessDestination(r.text, parsedUrl.href);
  if (dest) return dest;
  throw new Error("sub2unlock.com: URL tujuan tidak ditemukan.");
}

async function bypassSub2UnlockNet(parsedUrl, trace) {
  const s = new SimpleSession();
  const r = await s.get(parsedUrl.href);
  trace.push(`sub2unlock.net get -> ${r.status}`);
  const pats = [
    /attr\(["']href["'],\s*["'](https?:\/\/[^"']+)["']/i,
    /id=["']theLinkID["'][^>]*>([^<]+)</i,
    /id=["']theGetLink["'][^>]*href=["']([^"']+)["']/i,
    /href=["']([^"']+)["'][^>]*id=["']theGetLink["']/i,
  ];
  for (const pat of pats) {
    const m = r.text.match(pat);
    if (m && String(m[1]).trim().startsWith("http")) return String(m[1]).trim();
  }
  const dest = guessDestination(r.text, parsedUrl.href);
  if (dest) return dest;
  throw new Error("sub2unlock.net: URL tujuan tidak ditemukan.");
}

async function bypassYtSubMe(parsedUrl, trace) {
  const s = new SimpleSession();
  const r = await s.get(parsedUrl.href);
  trace.push(`ytsubme get -> ${r.status}`);
  const m =
    r.text.match(/<a[^>]+id=["']link["'][^>]+href=["']([^"']+)["']/i) ||
    r.text.match(/href=["'](https?:\/\/[^"']+)["'][^>]*id=["']link["']/i);
  if (m && m[1].startsWith("http")) return m[1];
  const dest = guessDestination(r.text, parsedUrl.href);
  if (dest) return dest;
  throw new Error("ytsubme: URL tujuan tidak ditemukan.");
}

async function bypassSub4Unlock(parsedUrl, trace) {
  const s = new SimpleSession();
  const r = await s.get(parsedUrl.href);
  trace.push(`sub4unlock get -> ${r.status}`);
  const pats = [
    /window\.open\(["'](https?:\/\/[^"']+)/i,
    /fun2\s*=\s*function[^}]*?["'](https?:\/\/[^"']+)/i,
    /(?:var|let|const)\s+\w+\s*=\s*["'](https?:\/\/[^"']+)["']\s*;\s*window\.open/i,
  ];
  for (const pat of pats) {
    const m = r.text.match(pat);
    if (m && m[1].startsWith("http")) return m[1];
  }
  const dest = guessDestination(r.text, parsedUrl.href);
  if (dest) return dest;
  throw new Error("sub4unlock: URL tujuan tidak ditemukan.");
}

async function bypassGenericSocial(parsedUrl, trace) {
  const host = parsedUrl.hostname.toLowerCase();
  const s = new SimpleSession();
  const r = await s.get(parsedUrl.href, { timeoutMs: 20000 });
  trace.push(`generic ${host} -> ${r.status}`);
  const html = r.text || "";

  const patterns = [
    /window\.location\.href\s*=\s*["'](https?:\/\/[^"']+)/i,
    /window\.open\(["'](https?:\/\/[^"']+)/i,
    /(?:var|let|const)\s+(?:dest|target|url|link|redirect|destination|final_url)\w*\s*=\s*["'](https?:\/\/[^"']+)/i,
    /attr\(["']href["'],\s*["'](https?:\/\/[^"']+)/i,
    /<a[^>]+id=["'](?:link|getlink|thelink|dest|unlock|continue)[^"']*["'][^>]+href=["']([^"']+)["']/i,
    /<a[^>]+href=["']([^"']+)["'][^>]+id=["'](?:link|getlink|thelink|dest|unlock|continue)[^"']*["']/i,
    /class=["'][^"']*(?:get-link|btn-get|destination|unlock-btn)[^"']*["'][^>]+href=["']([^"']+)["']/i,
    /href=["']([^"']+)["'][^>]*class=["'][^"']*(?:get-link|btn-get|destination|unlock-btn)/i,
    /data-captcha-url=["'](https?:\/\/[^"']+)/i,
  ];

  for (const pat of patterns) {
    const m = html.match(pat);
    if (m && m[1] && m[1].startsWith("http")) return m[1];
  }

  for (const m of html.matchAll(/atob\(["']([A-Za-z0-9+/=_-]{20,})["']\)/g)) {
    const dec = decodeB64(m[1]);
    if (dec.startsWith("http")) return dec;
  }

  for (const ep of ["/api/link", "/api/unlock", "/api/get", "/unlock", "/get-link"]) {
    try {
      const r2 = await s.postJson(`https://${host}${ep}`, { id: parsedUrl.pathname.replace(/^\/+|\/+$/g, "") });
      if ((r2.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
        const d = JSON.parse(r2.text);
        for (const k of ["url", "destination", "link", "target"]) {
          if (d && typeof d[k] === "string" && d[k].startsWith("http")) return d[k];
        }
      }
    } catch {}
  }

  if (r.url !== parsedUrl.href && !r.url.replace(/\/+$/, "").endsWith(host)) {
    return r.url;
  }

  const dest = guessDestination(html, parsedUrl.href);
  if (dest) return dest;
  throw new Error(`${host}: URL tujuan tidak ditemukan.`);
}

async function bypassSocial(inputUrl) {
  const t0 = Date.now();
  const trace = [];
  const result = {
    status: false,
    source: "social-unlock",
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
      throw new Error("URL Social Unlock tidak valid.");
    }

    const host = parsed.hostname.toLowerCase();
    if (!SOCIAL_HOST_RE.test(host)) {
      throw new Error(`Host ${host} bukan domain Social Unlock yang didukung.`);
    }

    let bypassedUrl = null;
    if (host === "rekonise.com" || host.endsWith(".rekonise.com")) {
      bypassedUrl = await bypassRekonise(parsed, trace);
    } else if (host === "sub2unlock.com" || host === "www.sub2unlock.com") {
      bypassedUrl = await bypassSub2UnlockCom(parsed, trace);
    } else if (host === "sub2unlock.net" || host === "www.sub2unlock.net") {
      bypassedUrl = await bypassSub2UnlockNet(parsed, trace);
    } else if (host === "ytsubme.com" || host.endsWith(".ytsubme.com")) {
      bypassedUrl = await bypassYtSubMe(parsed, trace);
    } else if (host === "sub4unlock.io" || host === "sub4unlock.com" || host.endsWith(".sub4unlock.io") || host.endsWith(".sub4unlock.com")) {
      bypassedUrl = await bypassSub4Unlock(parsed, trace);
    } else {
      bypassedUrl = await bypassGenericSocial(parsed, trace);
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
    result.error = (err && err.message) || "Gagal bypass Social Unlock.";
  }

  result.execution_time_ms = Date.now() - t0;
  return result;
}

async function directHandler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const rawUrl = (req && req.url) || "/";
  const target = new URL(rawUrl, "http://localhost").searchParams.get("url") || "";
  const out = await bypassSocial(target);
  res.statusCode = out.status ? 200 : 502;
  res.end(JSON.stringify(out));
}

module.exports = { bypass: bypassSocial, bypassSocial, directHandler };
module.exports.default = directHandler;
module.exports.handler = directHandler;
