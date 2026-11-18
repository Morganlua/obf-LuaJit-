"use strict";

/*
 * Engine Bypass.vip (Updated API endpoint & HTML fallback parser)
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
    
    // Coba endpoint API resmi jika tersedia, atau fetch halaman bypass.vip dengan parameter url
    const targetApi = `https://bypass.vip/api/bypass?url=${encodeURIComponent(url)}`;
    
    let res = await fetch(targetApi, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000)
    });

    let text = await res.text();
    let finalUrl = null;

    // Coba parse sebagai JSON
    try {
      const json = JSON.parse(text);
      finalUrl = json.url || json.destination || json.bypassed || json.result || json.link;
    } catch {
      // Jika bukan JSON, cek apakah halaman userscript / html yang memuat parameter redirect
      const match = text.match(/[?&]redirect=([^&"'\s]+)/) || text.match(/url=([^&"'\s]+)/);
      if (match) {
        try {
          finalUrl = decodeURIComponent(match[1]);
        } catch {
          finalUrl = match[1];
        }
      }
    }

    // Jika lewat API /api/bypass gagal atau mengembalikan html/error, coba fallback ke userscript.html
    if (!finalUrl || finalUrl.includes("bypass.vip")) {
      const fallbackUrl = `https://bypass.vip/userscript.html?url=${encodeURIComponent(url)}&time=0&key=`;
      const res2 = await fetch(fallbackUrl, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
        redirect: "follow",
        signal: AbortSignal.timeout(20000)
      });
      
      if (res2.url && !res2.url.includes("bypass.vip/userscript.html")) {
        finalUrl = res2.url;
      } else {
        const text2 = await res2.text();
        const m2 = text2.match(/redirect=([^&"'\s]+)/);
        if (m2) {
          finalUrl = decodeURIComponent(m2[1]);
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
