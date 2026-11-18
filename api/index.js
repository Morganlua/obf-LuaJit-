"use strict";

/*
 * Router tunggal untuk deployment serverless (Vercel, Node runtime).
 * Endpoint:
 *   GET /api/mgvt?url=<link sfl.gl>   -> safelinku
 *   GET /api/umpc?url=<link bicolink> -> bicolink
 *   GET /api/vip?url=<link vip/loot>  -> bypass.vip
 *   GET /api?url=...&engine=auto      -> deteksi otomatis berdasarkan hostname
 */

const mgvt = require("./mgvt");
const umpc = require("./umpc");
const vip = require("./vip");

const ENGINES = {
  mgvt: { run: (u, o) => mgvt.bypass(u, o) },
  umpc: { run: (u, o) => umpc.bypass(u, o) },
  vip:  { run: (u, o) => vip.bypass(u, o) },
};

const HOSTS = [
  { test: /(^|\.)sfl\.gl$/i, engine: "mgvt" },
  { test: /(^|\.)(bicolink\.com|bico\.link)$/i, engine: "umpc" },
  { test: /(^|\.)(loot-link\.com|loot-links\.com|lootdest\.com|linkvertise\.com|adfoc\.us|boost\.ink|cuty\.io|rekonise\.com|sub2unlock\.com|mega-guy\.com|lootlabs\.com)$/i, engine: "vip" },
];

function pickEngine(url) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch (e) {
    return null;
  }
  const hit = HOSTS.find((e) => e.test.test(host));
  return hit ? hit.engine : null;
}

async function resolveRequest(req) {
  const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const target = u.searchParams.get("url");
  const forced = u.searchParams.get("engine") || "";
  const engine = forced && ENGINES[forced] ? forced : target ? pickEngine(target) : null;

  if (!target) {
    return {
      status: 400,
      payload: {
        status: false,
        error: "Parameter url wajib diisi.",
        engines: ["mgvt", "umpc", "vip"],
      },
    };
  }
  if (!engine) {
    return {
      status: 422,
      payload: {
        status: false,
        error: "Engine tidak dikenal untuk host tersebut. Pakai /api/mgvt, /api/umpc, /api/vip, atau ?engine=mgvt|umpc|vip.",
      },
    };
  }

  try {
    const result = await ENGINES[engine].run(target, {});
    return { status: result.status ? 200 : 502, payload: result };
  } catch (e) {
    return { status: 500, payload: { status: false, error: (e && e.message) || "Internal error" } };
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function handle(req, res) {
  const { status, payload } = await resolveRequest(req);
  sendJson(res, status, payload);
}

module.exports = handle;
module.exports.handle = handle;
module.exports.default = handle;
module.exports.resolveRequest = resolveRequest;
module.exports.pickEngine = pickEngine;
module.exports.ENGINES = ENGINES;
