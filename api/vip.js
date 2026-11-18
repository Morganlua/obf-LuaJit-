"use strict";

/*
 * Engine Bypass.vip (Updated API endpoint)
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
    
    // Menggunakan endpoint API / free endpoint backend bypass.vip yang menghasilkan JSON atau redirect langsung
    const targetApi = `https://bypass.vip/api/bypass?url=${encodeURIComponent(url)}`;
    
    const res = await fetch(targetApi, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25000)
    });

    const contentType = res.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      const json = await res.json();
      const finalUrl = json.url || json.destination || json.bypassed || json.result;
      if (finalUrl) {
        result.status = true;
        result.data = {
          source_url: url,
          bypassed_url: finalUrl,
          host: new URL(finalUrl).hostname,
        };
      } else {
        throw new Error("Format JSON dari bypass.vip tidak dikenali.");
      }
    } else {
      const text = await res.text();
      // Coba parse jika berupa JSON string atau ambil lewat regex URL
      try {
        const json = JSON.parse(text);
        const finalUrl = json.url || json.destination || json.bypassed;
        if (finalUrl) {
          result.status = true;
          result.data = {
            source_url: url,
            bypassed_url: finalUrl,
            host: new URL(finalUrl).hostname,
          };
          result.execution_time_ms = Date.now() - startTime;
          return result;
        }
      } catch {}

      throw new Error("Gagal mendapatkan respons JSON valid dari bypass.vip.");
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
