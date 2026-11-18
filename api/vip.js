"use strict";

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

    const apiEndpoints = [
      `https://bypass.vip/api/bypass?url=${encodeURIComponent(url)}`,
      `https://bypass.vip/userscript.html?url=${encodeURIComponent(url)}&time=0&key=`
    ];

    for (const endpoint of apiEndpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "GET",
          headers: {
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/html,application/xhtml+xml,*/*"
          },
          redirect: "follow",
          signal: AbortSignal.timeout(15000)
        });

        const resUrl = res.url || "";
        const uObj = new URL(resUrl);
        const rParam = uObj.searchParams.get("redirect") || uObj.searchParams.get("url") || uObj.searchParams.get("to");
        if (rParam && !rParam.includes("bypass.vip")) {
          finalUrl = decodeURIComponent(rParam);
          break;
        }

        const text = await res.text();
        
        try {
          const json = JSON.parse(text);
          const parsed = json.url || json.destination || json.bypassed || json.result || json.link;
          if (parsed && !parsed.includes("bypass.vip")) {
            finalUrl = parsed;
            break;
          }
        } catch {}

        const match = text.match(/[?&]redirect=([^&"'\s]+)/i) || 
                      text.match(/[?&]url=([^&"'\s]+)/i) ||
                      text.match(/window\.location(?:\.href)?\s*=\s*["'](https?:\/\/[^"']+)["']/i);
        if (match && match[1]) {
          const candidate = decodeURIComponent(match[1]);
          if (!candidate.includes("bypass.vip")) {
            finalUrl = candidate;
            break;
          }
        }
      } catch (err) {
        // Lanjutkan ke endpoint berikutnya
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
