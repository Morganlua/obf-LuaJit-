"use strict";

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 13_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1 Mobile/15E148 Safari/604.1";

const LV_HOST_RE =
  /(^|\.)(linkvertise\.(com|net|download)|link-to\.net|file-link\.net|direct-link\.net)$/i;

function parseLinkvertiseUrl(rawUrl) {
  const normalized = /^https?:\/\//i.test(String(rawUrl || "").trim())
    ? String(rawUrl || "").trim()
    : "https://" + String(rawUrl || "").trim();
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("URL Linkvertise tidak valid.");
  }
  if (!LV_HOST_RE.test(parsed.hostname)) {
    throw new Error(`Host ${parsed.hostname} bukan domain Linkvertise yang didukung.`);
  }
  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  if (!cleanPath || cleanPath === "/") {
    throw new Error("Path/slug Linkvertise tidak ditemukan pada URL.");
  }
  return {
    startUrl: parsed.href,
    host: parsed.hostname.toLowerCase(),
    pathname: cleanPath,
  };
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      "User-Agent": IOS_UA,
      Accept: "application/json, text/plain, */*",
      ...(opts.headers || {}),
    },
    body: opts.body,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 140);
    throw new Error(`HTTP ${res.status} (${snippet || "Respon bukan JSON"})`);
  }
  if (!res.ok) {
    throw new Error((json && (json.message || json.error)) || `HTTP ${res.status}`);
  }
  return json;
}

async function bypassLinkvertise(inputUrl) {
  const t0 = Date.now();
  const result = {
    status: false,
    source: "linkvertise",
    data: null,
    error: null,
    execution_time_ms: 0,
  };

  try {
    const info = parseLinkvertiseUrl(inputUrl);
    const baseApi = "https://publisher.linkvertise.com/api/v1/redirect/link";

    // Pancing endpoint impression/captcha/click (diabaikan jika salah satu mengembalikan non-200)
    const prePaths = [
      `${baseApi}${info.pathname}/captcha`,
      `${baseApi}${info.pathname}/countdown_impression?trafficOrigin=network`,
      `${baseApi}${info.pathname}/todo_impression?mobile=true&trafficOrigin=network`,
      `${baseApi}${info.pathname}/click?trafficOrigin=network`,
    ];
    await Promise.allSettled(prePaths.map((u) => fetchJson(u)));

    // Ambil metadata link statis untuk mendapatkan link_id
    const staticData = await fetchJson(`${baseApi}/static${info.pathname}`);
    const linkId =
      staticData &&
      staticData.data &&
      staticData.data.link &&
      staticData.data.link.id;

    if (!linkId) {
      throw new Error("Gagal mengambil link_id dari endpoint static Linkvertise.");
    }

    const payloadObj = {
      timestamp: Date.now(),
      random: "6548307",
      link_id: linkId,
    };
    const encodedSerial = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64");

    // Coba GET ?serial= (metode v0.4.2) lalu fallback POST { serial } (metode v0.4.3)
    let targetData = null;
    try {
      targetData = await fetchJson(
        `${baseApi}${info.pathname}/target?serial=${encodeURIComponent(encodedSerial)}`
      );
    } catch {
      targetData = await fetchJson(`${baseApi}${info.pathname}/target`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial: encodedSerial }),
      });
    }

    const bypassedUrl =
      (targetData && targetData.data && (targetData.data.target || targetData.data.url)) ||
      (targetData && (targetData.target || targetData.url)) ||
      null;

    if (!bypassedUrl) {
      throw new Error("URL tujuan tidak ditemukan pada respons /target Linkvertise.");
    }

    let destHost = "";
    try {
      destHost = new URL(bypassedUrl).hostname;
    } catch {}

    result.status = true;
    result.data = {
      source_url: info.startUrl,
      bypassed_url: bypassedUrl,
      host: destHost,
      steps: [
        `preflight ${info.host}${info.pathname}`,
        `static link_id=${linkId}`,
        `target -> ${destHost || bypassedUrl}`,
      ],
    };
  } catch (err) {
    result.error = (err && err.message) || "Gagal bypass Linkvertise.";
  }

  result.execution_time_ms = Date.now() - t0;
  return result;
}

async function directHandler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const rawUrl = (req && req.url) || "/";
  const target = new URL(rawUrl, "http://localhost").searchParams.get("url") || "";
  const out = await bypassLinkvertise(target);
  res.statusCode = out.status ? 200 : 502;
  res.end(JSON.stringify(out));
}

module.exports = { bypass: bypassLinkvertise, bypassLinkvertise, directHandler };
module.exports.default = directHandler;
module.exports.handler = directHandler;
