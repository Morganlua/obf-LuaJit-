import fengari from 'fengari';

const { lua, lauxlib, lualib } = fengari;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan metode POST' });

  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Kode Lua kosong!' });

    // 1. Transformasi XOR String & Global Masking
    const processedCode = obfuscateSource(code);

    // 2. Kompilasi ke Lua VM & Dump ke Bytecode Biner (.luac)
    const L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);

    const status = lauxlib.luaL_loadstring(L, fengari.to_luastring(processedCode));
    if (status !== lua.LUA_OK) {
      const err = lua.lua_tostring(L, -1);
      return res.status(400).json({ error: "Syntax Error: " + fengari.to_jsstring(err) });
    }

    let bytecodeChunks = [];
    lua.lua_dump(L, (L, b, size, ud) => {
      const bytes = fengari.to_jsstring(b);
      bytecodeChunks.push(bytes);
      return 0;
    }, null, 1); // Strip debug info (string.dump equivalent)

    const bytecodeResult = bytecodeChunks.join('');

    return res.status(200).json({
      success: true,
      result: bytecodeResult
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

function createXorStringExpr(str, key) {
  if (!str) return '""';
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) ^ key);
  }
  return `((function() local _t={${bytes.join(',')}} local _s={} for _i=1,#_t do _s[_i]=string.char(bit.bxor(_t[_i],${key})) end return table.concat(_s) end)())`;
}

function obfuscateSource(srcCode) {
  const key = Math.floor(Math.random() * 180) + 35;
  let processed = srcCode;

  processed = processed.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (_, p1) => createXorStringExpr(p1, key));
  processed = processed.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, p1) => createXorStringExpr(p1, key));

  const globals = [
    "script_name", "script_author", "script_version", "script_description",
    "sampAddChatMessage", "sampRegisterChatCommand", "setPlayerNeverGetsTired",
    "isSampAvailable", "PLAYER_HANDLE", "showCursor", "isPauseMenuActive",
    "wait", "print", "tostring", "tonumber"
  ];

  globals.forEach(name => {
    const encExpr = createXorStringExpr(name, key);
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    processed = processed.replace(regex, `_G[${encExpr}]`);
  });

  return processed;
}
