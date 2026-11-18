"use strict";

/*
 * Engine Bypass.vip untuk integrasi Vercel (Noxis Bypass Link)
 */

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function bypassVip(url, options = {}) {
  const startTime = Date.now();
  const result = {
    status: false,
    author_skrep: "bypass.vip",
    source: "bypass-vip",
    data: null,
    error: null,
    execution_time_ms: 0,
  };

  try {
    if (!url) throw new Error("URL target belum diisi.");
    
    const targetApi = `https://bypass.vip/userscript.html?url=${encodeURIComponent(url)}&time=0&key=`;
    
    const res = await fetch(targetApi, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25000)
    });

    const finalUrl = res.url;
    if (finalUrl && finalUrl !== targetApi && !finalUrl.includes("bypass.vip/userscript.html")) {
      result.status = true;
      result.data = {
        source_url: url,
        bypassed_url: finalUrl,
        host: new URL(finalUrl).hostname,
      };
    } else {
      const html = await res.text();
      const match = html.match(/redirect=([^&"'\s]+)/);
      if (match) {
        const decoded = decodeURIComponent(match[1]);
        result.status = true;
        result.data = {
          source_url: url,
          bypassed_url: decoded,
          host: new URL(decoded).hostname,
        };
      } else {
        throw new Error("Gagal mengekstrak URL tujuan dari bypass.vip.");
      }
    }
  } catch (e) {
    result.error = e.message || "Unknown error";
  }

  result.execution_time_ms = Date.now() - startTime;
  return result;
}

async function directHandler(req, res) {
  const target = new URL(req.url, "http://x").searchParams.get("url") || "";
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const result = await bypassVip(target, {});
  res.statusCode = result.status ? 200 : 502;
  res.end(JSON.stringify(result));
}

module.exports = { bypass: bypassVip, directHandler };
module.exports.default = directHandler;
