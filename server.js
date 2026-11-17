"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const apiIndex = require("./api/index");
const mgvt = require("./api/mgvt");
const umpc = require("./api/umpc");

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/mgvt") {
    return mgvt.directHandler(req, res);
  }
  if (url.pathname === "/api/umpc") {
    return umpc.directHandler(req, res);
  }
  if (url.pathname === "/api" || url.pathname === "/api/") {
    return apiIndex.handle(req, res);
  }

  let filePath = path.join(__dirname, "public", url.pathname === "/" ? "index.html" : url.pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream(path.join(__dirname, "public", "index.html")).pipe(res);
  }
});

server.listen(PORT, () => {
  console.log(`[Noxis Link Bypass] Running at http://localhost:${PORT}`);
});
