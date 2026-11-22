"use strict";

const crypto = require("node:crypto");

const CREDIT = {
  author_skrep: "JH a.k.a Dhika",
  kesayangan: "Fiony Alveria\u2661",
};

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";

const VW = 392;
const VH = 687;
const MAX_HOP = 10;
const MAX_ROUND = 5;
const GATE_RE = /id=["']verify["']/i;

const BASE_HEADERS = {
  "Accept-Language": "id-ID,id;q=0.9",
  "User-Agent": USER_AGENT,
};

class SflError extends Error {
  constructor(msg, raw) {
    super(msg);
    this.raw = raw;
  }
}

const rawOf = (e) =>
  [e && e.name, e && e.message, e && e.cause && (e.cause.code || e.cause.message)]
    .filter(Boolean)
    .join(" | ");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isSfl = (h) => /(^|\.)(sfl\.gl|(khadd?avi)\.(com|net))$/i.test(h);

const bersih = (u) => {
  try {
    const x = new URL(String(u).replace(/\\/g, "/"));
    x.pathname = x.pathname.replace(/\/{2,}/g, "/");
    return x.href;
  } catch (e) {
    return u;
  }
};

const _s0 = "xq9-sfl-\u03df7";
const _h1 = "2796dc0f3760aecb";
const _h2 = "956ddc012926128b";
const _h3 = "abe7e4cdc6729708";
const _h4 = "5f34461d23d6c735";
const _n3 = 1983952584;

const _r1 = "Lkzmw1ugtFCt8B0zhWr00Ak+wUur";
const _r2 = "NiY2WZz5b8zdHEZ0+sVbbkaGJ5RT";
const _r3 = "vUJwlRmofCfdzgLcwBl2HnoiQtPI";
const _r4 = "KkzUhS4xr7xwbPXXRclQdwoL1g1n";
const _r5 = "BzdDl6qw/TjlaP2yw2+GFA==";

const _alg1 = "sha256";
const _alg2 = "aes-256-gcm";

function _m7(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function _brk() {
  throw new Error("Integritas credit skrip tidak valid.");
}

function checkCredit() {
  const a = CREDIT.author_skrep;
  const k = CREDIT.kesayangan;
  const dg = crypto.createHash(_alg1).update(JSON.stringify([a, k, _s0])).digest("hex");
  if (dg !== _h1 + _h2 + _h3 + _h4) _brk();
  if (_m7(a + "\u0001" + k + "\u0001" + _s0) !== _n3) _brk();
  return { a, k };
}

let _dF = null;

function _expandKey(seed, len) {
  const out = Buffer.alloc(len);
  let block = crypto.createHash(_alg1).update(seed).digest();
  let off = 0;
  let counter = 0;
  while (off < len) {
    const h = crypto.createHash(_alg1).update(Buffer.concat([block, Buffer.from([counter++])])).digest();
    h.copy(out, off, 0, Math.min(h.length, len - off));
    off += h.length;
    block = h;
  }
  return out;
}

function derivedKey() {
  if (_dF) return _dF;
  const { a, k } = checkCredit();
  const blob = Buffer.from(_r1 + _r2 + _r3 + _r4 + _r5, "base64");
  const ks = _expandKey("P2\u0000" + a + "\u0000" + k, blob.length);
  const un = Buffer.alloc(blob.length);
  for (let i = 0; i < blob.length; i++) un[i] = blob[i] ^ ks[i];
  const iv = un.subarray(0, 12);
  const tag = un.subarray(12, 28);
  const ct = un.subarray(28);
  const aesKey = crypto.createHash(_alg1).update("P1\u0000" + k + "\u0000" + a).digest();
  const d = crypto.createDecipheriv(_alg2, aesKey, iv);
  d.setAuthTag(tag);
  const pt = Buffer.concat([d.update(ct), d.final()]);
  _dF = JSON.parse(pt.toString("utf8")).z;
  return _dF;
}

function makeClient() {
  const jar = new Map();

  const cookieHeader = (host) =>
    jar.has(host) ? [...jar.get(host)].map(([k, v]) => `${k}=${v}`).join("; ") : "";

  const storeCookies = (host, res) => {
    const sc = res.headers["set-cookie"] || [];
    if (!sc.length) return;
    if (!jar.has(host)) jar.set(host, new Map());
    const store = jar.get(host);
    for (const c of sc) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      if (i < 1) continue;
      const name = kv.slice(0, i).trim();
      const val = kv.slice(i + 1).trim();
      if (/max-age=0/i.test(c) || /expires=Thu, 01 Jan 1970/i.test(c)) store.delete(name);
      else store.set(name, val);
    }
  };

  const http = async (url, { method = "GET", json, referer } = {}) => {
    const u = new URL(url);
    const headers = { ...BASE_HEADERS };
    const ck = cookieHeader(u.host);
    if (ck) headers["Cookie"] = ck;
    if (referer) headers["Referer"] = referer;
    let body;
    if (method === "POST") {
      headers["Accept"] = "*/*";
      headers["Content-Type"] = "application/json";
      headers["Origin"] = u.origin;
      headers["Sec-Fetch-Dest"] = "empty";
      headers["Sec-Fetch-Mode"] = "cors";
      headers["Sec-Fetch-Site"] = "same-origin";
      body = JSON.stringify(json || {});
    } else {
      headers["Accept"] = "text/html,application/xhtml+xml,*/*;q=0.8";
      headers["Upgrade-Insecure-Requests"] = "1";
    }

    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(25000),
      });
    } catch (e) {
      throw new SflError("Gagal terhubung ke " + u.host + ".", rawOf(e));
    }

    const text = await res.text();
    const setCookie =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : res.headers.get("set-cookie")
          ? [res.headers.get("set-cookie")]
          : [];
    storeCookies(u.host, { headers: { "set-cookie": setCookie } });
    return { status: res.status, location: res.headers.get("location"), text };
  };

  const makeToken = (host) => {
    const bucket = jar.get(host);
    const xsrf = bucket && bucket.get("XSRF-TOKEN");
    if (!xsrf) {
      throw new SflError(
        "Cookie XSRF-TOKEN tidak ada.",
        "host=" + host + " cookies=[" + (bucket ? [...bucket.keys()].join(",") : "") + "]"
      );
    }
    const u = "#" + Buffer.from(derivedKey()).toString("base64");
    return decodeURIComponent(xsrf).slice(0, 128 - u.length) + u;
  };

  const api = async (page, path, json) => {
    const res = await http(new URL(path, page).href, { method: "POST", json, referer: page });
    if (res.status < 200 || res.status >= 300) {
      if (res.status === 419)
        throw new SflError("Sesi/token ditolak server (419), coba jalankan ulang.", `${path} :: ${res.text}`);
      if (res.status === 422)
        throw new SflError("Request ditolak validasi server (422).", `${path} :: ${res.text}`);
      throw new SflError(`API ${path} ditolak (HTTP ${res.status}).`, res.text);
    }
    try {
      return JSON.parse(res.text);
    } catch (e) {
      throw new SflError(`Response ${path} bukan JSON.`, res.text);
    }
  };

  const sniffBody = (html, base) => {
    const form = html.match(/<form[^>]+action=["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/i);
    if (form && !/method=["']?post/i.test(form[0].match(/^<form[^>]*>/i)[0])) {
      const u = new URL(form[1], base);
      for (const mm of form[2].matchAll(/<input[^>]+>/gi)) {
        const n = mm[0].match(/name=["']([^"']+)["']/i);
        const v = mm[0].match(/value=["']([^"']*)["']/i);
        if (n) u.searchParams.set(n[1], v ? v[1] : "");
      }
      return u.href;
    }
    const meta = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"'>\s]+)/i);
    if (meta) return new URL(meta[1], base).href;
    const js = html.match(/(?:window\.|document\.|top\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i);
    if (js) return new URL(js[1], base).href;
    const rep = html.match(/location\.replace\(\s*["']([^"']+)["']\s*\)/i);
    if (rep) return new URL(rep[1], base).href;
    return null;
  };

  const sniffFinal = (body, base) => {
    try {
      const j = JSON.parse(body);
      const u = j && (j.url || j.target || j.link || j.redirect);
      if (u) return new URL(u, base).href;
    } catch (e) {}
    const hop = sniffBody(body, base);
    if (hop && hop !== base) return hop;
    const SKIP =
      /(^|\.)(sfl\.gl|(khadd?avi)\.(com|net)|w3\.org|google\.com|googleapis\.com|gstatic\.com|cloudflare\.com|jquery\.com|facebook\.com|twitter\.com)$/i;
    for (const mm of body.replace(/\\+\//g, "/").matchAll(/https?:\/\/[^\s"'<>\\)]+/gi)) {
      try {
        const u = new URL(mm[0]);
        if (!SKIP.test(u.hostname)) return u.href;
      } catch (e) {}
    }
    return null;
  };

  const navigate = async (start, referer, chain) => {
    let url = start;
    let prev = referer || "";
    for (let i = 0; i < MAX_HOP; i++) {
      const res = await http(url, { referer: prev });
      chain.push({ url, status: res.status });
      if (res.status >= 300 && res.status < 400 && res.location) {
        prev = url;
        url = new URL(res.location, url).href;
        continue;
      }
      if (res.status >= 400)
        throw new SflError("Server menolak request (HTTP " + res.status + ").", url + " :: " + res.text);
      if (GATE_RE.test(res.text)) return { url, body: res.text, gate: true };
      const next = sniffBody(res.text, url);
      if (next && next !== url) {
        prev = url;
        url = next;
        continue;
      }
      return { url, body: res.text, gate: false };
    }
    throw new SflError("Redirect terlalu banyak (>: " + MAX_HOP + ").", chain.map((c) => c.url).join(" -> "));
  };

  const finalize = async (start, referer, chain) => {
    let url = start;
    let prev = referer || "";
    for (let i = 0; i < MAX_HOP; i++) {
      if (!isSfl(new URL(url).hostname)) return url;
      const res = await http(url, { referer: prev });
      chain.push({ url, status: res.status });
      if (res.status >= 300 && res.status < 400 && res.location) {
        prev = url;
        url = new URL(res.location, url).href;
        continue;
      }
      if (res.status >= 400)
        throw new SflError("Server menolak request (HTTP " + res.status + ").", url + " :: " + res.text);
      const next = sniffFinal(res.text, url);
      if (!next || next === url)
        throw new SflError("Tujuan akhir tidak ditemukan di halaman /ready/go.", url + " :: " + res.text);
      prev = url;
      url = next;
    }
    throw new SflError("Redirect terlalu banyak di hop terakhir.", chain.map((c) => c.url).join(" -> "));
  };

  const resolve = async (startUrl) => {
    checkCredit();
    const chain = [];
    let page = await navigate(startUrl, "", chain);

    for (let round = 0; round < MAX_ROUND; round++) {
      if (!page.gate)
        throw new SflError(
          "Halaman gate SafelinkU tidak ditemukan (mungkin struktur berubah).",
          page.url
        );

      const host = new URL(page.url).host;
      const s = await api(page.url, "/api/session", { _token: makeToken(host) });
      if (s.captcha || s.passcode)
        throw new SflError("Link ini butuh captcha/passcode, tidak bisa diproses otomatis.", JSON.stringify(s));

      if (s.step === 1) {
        await sleep(12000);
        const v = await api(page.url, "/api/verify", { _a: 0 });
        const next = new URL(v.target || "/redirect.php", page.url).href;
        page = await navigate(next, page.url, chain);
        continue;
      }

      if (s.step === 2) {
        await sleep(5000);
        const a = Math.floor(Math.random() * 1000);
        const size = (VW + a) * 2 + "." + (VH + a) * 2;
        const g = await api(page.url, "/api/go", { key: a, size, ado: null });
        if (!g.url) throw new SflError("Response /api/go tidak berisi url.", JSON.stringify(g));
        const final = bersih(await finalize(new URL(g.url, page.url).href, page.url, chain));
        return final;
      }

      throw new SflError("Step tidak dikenal: " + s.step, JSON.stringify(s));
    }
    throw new SflError("Terlalu banyak putaran gate (>: " + MAX_ROUND + ").", chain.map((c) => c.url).join(" -> "));
  };

  return { resolve, http, jar, makeToken, api };
}

async function bypass(input) {
  const t0 = Date.now();
  const result = {
    status: false,
    author_skrep: CREDIT.author_skrep,
    source: "safelinku",
    data: null,
    error: null,
    execution_time_ms: 0,
  };
  try {
    if (!input) throw new SflError("Link belum diisi.", "input kosong");
    const matchUrl = String(input).match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:sfl\.gl|(?:khadd?avi)\.(?:com|net))(?:\/[^\s]*)?/i);
    if (!matchUrl) throw new SflError("Link harus dari domain sfl.gl, khaddavi.net, atau khaddavi.com.", String(input));

    const startUrl = /^https?:\/\//i.test(matchUrl[0]) ? matchUrl[0] : "https://" + matchUrl[0];
    const client = makeClient();
    const final = await client.resolve(startUrl);

    let hostName = "";
    try {
      hostName = new URL(final).hostname;
    } catch (e) {}

    result.status = true;
    result.data = {
      source_url: startUrl,
      bypassed_url: final,
      host: hostName,
      steps: [],
    };
  } catch (error) {
    result.error = error.message || "Unknown Error";
    if (error.raw) result.raw = error.raw;
  }
  result.execution_time_ms = Date.now() - t0;
  return result;
}

async function directHandler(req, res) {
  const target = new URL(req.url, "http://x").searchParams.get("url") || "";
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const result = await bypass(target);
  res.statusCode = result.status ? 200 : 502;
  res.end(JSON.stringify(result));
}

module.exports = { bypass, CREDIT, directHandler };
module.exports.default = directHandler;
