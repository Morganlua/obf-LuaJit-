"use strict";

/*
 * Engine Bypass.vip (Updated sesuai mekanisme redirect Userscript asli)
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

    let finalUrl = null;

    // Memanggil endpoint userscript.html bypass.vip dengan redirect: "manual" atau mengikuti redirectnya
    const targetUrl = `https://bypass.vip/userscript.html?url=${encodeURIComponent(url)}&time=0&key=`;
    
    let res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000)
    });

    // Cek apakah URL akhir berisi parameter redirect seperti pada userscript aslinya
    const currentUrlObj = new URL(res.url);
    const rawRedirect = currentUrlObj.searchParams.get("redirect");

    if (rawRedirect) {
      try {
        finalUrl = decodeURIComponent(rawRedirect);
      } catch {
        finalUrl = rawRedirect;
      }
    } else if (res.url && !res.url.includes("bypass.vip/userscript.html") && !res.url.includes("bypass.vip/api")) {
      finalUrl = res.url;
    } else {
      let text = await res.text();
      
      // Cari pola parameter ?redirect= atau url= di dalam teks HTML/script
      const match = text.match(/[?&]redirect=([^&"'\s]+)/i) || text.match(/[?&]url=([^&"'\s]+)/i);
      if (match && match[1]) {
        try {
          finalUrl = decodeURIComponent(match[1]);
        } catch {
          finalUrl = match[1];
        }
      }
    }

    if (finalUrl && !finalUrl.includes("bypass.vip")) {
      result.status = true;
      result.data = {
        source_url: url,
        bypassed_url: finalUrl,
        host: new URL(finalUrl).hostname,
      };
    } else {
      throw new Error("Gagal mengekstrak URL tujuan dari bypass.vip.");
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
