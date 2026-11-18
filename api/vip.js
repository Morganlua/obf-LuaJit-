"use strict";

/*
 * Engine Bypass.vip (Robust HTML & API Extractor)
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

    // 1. Coba panggil halaman userscript.html dari bypass.vip langsung
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

    if (res.url && !res.url.includes("bypass.vip/userscript.html") && !res.url.includes("bypass.vip/api")) {
      finalUrl = res.url;
    } else {
      let text = await res.text();
      
      // Cari berbagai pola parameter redirect / url di dalam HTML atau script
      const patterns = [
        /[?&]redirect=([^&"'\s]+)/i,
        /[?&]url=([^&"'\s]+)/i,
        /window\.location\.href\s*=\s*["']([^"']+)["']/i,
        /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
        /href=["'](https?:\/\/[^"']+)["']/i
      ];

      for (const rx of patterns) {
        const m = text.match(rx);
        if (m && m[1]) {
          let candidate = m[1];
          if (!candidate.includes("bypass.vip")) {
            try {
              finalUrl = decodeURIComponent(candidate);
              break;
            } catch {
              finalUrl = candidate;
              break;
            }
          }
        }
      }

      // Jika belum ketemu, coba panggil endpoint API JSON mereka
      if (!finalUrl || finalUrl.includes("bypass.vip")) {
        const apiRes = await fetch(`https://bypass.vip/api/bypass?url=${encodeURIComponent(url)}`, {
          method: "GET",
          headers: { "User-Agent": USER_AGENT, "Accept": "application/json, text/plain, */*" },
          signal: AbortSignal.timeout(15000)
        });
        const apiText = await apiRes.text();
        try {
          const json = JSON.parse(apiText);
          finalUrl = json.url || json.destination || json.bypassed || json.result || json.link;
        } catch {}
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
