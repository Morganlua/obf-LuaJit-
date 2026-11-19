"use strict";

const mgvt = require("./mgvt");
const umpc = require("./umpc");
const lv = require("./lv");
const social = require("./social");

const ENGINES = {
  mgvt: { run: (u, o) => mgvt.bypass(u, o) },
  umpc: { run: (u, o) => umpc.bypass(u, o) },
  lv: { run: (u, o) => lv.bypass(u, o) },
  social: { run: (u, o) => social.bypass(u, o) },
};

const HOSTS = [
  { test: /(^|\.)(sfl\.gl|(khadd?avi)\.(com|net))$/i, engine: "mgvt" },
  { test: /(^|\.)(bicolink\.com|bico\.link|bicosafe\.com|bicolink\.net|bclnk\.net)$/i, engine: "umpc" },
  { test: /(^|\.)(linkvertise\.(com|net|download)|link-to\.net|file-link\.net|direct-link\.net)$/i, engine: "lv" },
  { test: /(^|\.)(rekonise\.com|sub2unlock\.(com|net)|ytsubme\.com|sub4unlock\.(io|com)|unlocknow\.net|sub2get\.com|subfinal\.com|mboost\.me|social-unlock\.com|socialwolvez\.com|paster\.(so|gg)|cuty\.io|adfoc\.us|mendationforc\.info)$/i, engine: "social" },
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
        engines: ["mgvt", "umpc", "lv", "social"],
      },
    };
  }
  if (!engine) {
    return {
      status: 422,
      payload: {
        status: false,
        error: "Engine tidak dikenal atau tidak didukung untuk host tersebut.",
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
