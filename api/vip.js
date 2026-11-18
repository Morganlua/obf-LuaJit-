"use strict";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

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

    const targetUrl = `https://bypass.vip/userscript.html?url=${encodeURIComponent(url)}&time=0&key=`;
    
    let res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": "https://bypass.vip/"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000)
    });

    let currentUrl = res.url || "";
    
    try {
      const uObj = new URL(currentUrl);
      const rParam = uObj.searchParams.get("redirect") || uObj.searchParams.get("url") || uObj.searchParams.get("to");
      if (rParam && !rParam.includes("bypass.vip") && rParam !== url) {
        finalUrl = decodeURIComponent(rParam);
      }
    } catch {}

    if (!finalUrl || finalUrl === url || finalUrl.includes("bypass.vip")) {
      const text = await res.text();
      
      const patterns = [
        /[?&]redirect=([^&"'\s]+)/i,
        /[?&]url=([^&"'\s]+)/i,
        /window\.location(?:\.href|\.replace)?\s*=\s*["'](https?:\/\/[^"']+)["']/i,
        /href=["'](https?:\/\/[^"']+)["']/i
      ];

      for (const rx of patterns) {
        const m = text.match(rx);
        if (m && m[1]) {
          let candidate = m[1];
          try {
            candidate = decodeURIComponent(candidate);
          } catch {}
          if (!candidate.includes("bypass.vip") && candidate !== url && candidate.startsWith("http")) {
            finalUrl = candidate;
            break;
          }
        }
      }
    }

    if (!finalUrl || finalUrl === url || finalUrl.includes("bypass.vip")) {
      const apiRes = await fetch(`https://bypass.vip/api/bypass?url=${encodeURIComponent(url)}`, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "application/json, text/plain, */*",
          "Referer": "https://bypass.vip/"
        },
        signal: AbortSignal.timeout(15000)
      });
      const apiText = await apiRes.text();
      try {
        const json = JSON.parse(apiText);
        const parsed = json.url || json.destination || json.bypassed || json.result || json.link;
        if (parsed && !parsed.includes("bypass.vip") && parsed !== url) {
          finalUrl = parsed;
        }
      } catch {}
    }

    if (finalUrl && finalUrl !== url && !finalUrl.includes("bypass.vip")) {
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
