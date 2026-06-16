import { readFileSync, writeFileSync } from "fs";

const cs  = readFileSync("F:/MyRcon/plugins/MyRconAdminPanel.cs", "utf8");
const src = readFileSync("F:/MyRcon/src/lib/exclusive-plugins.ts", "utf8");

const START = "const ADMIN_PANEL_CS = `";
const REG   = "// ─────────────────────────────────────────────────────────────────────────────\n//  Registry";

const si = src.indexOf(START);
const ri = src.indexOf(REG);
if (si === -1 || ri === -1) { console.error("markers not found", si, ri); process.exit(1); }

// closing backtick of the template literal sits just before ";\n\n// ──── Registry"
const closingTick = ri - 4; // `;\n\n

// Escape for JS template literal embedding
const escaped = cs.replaceAll("`", "\\`").replaceAll("${", "\\${");

const out = src.slice(0, si + START.length) + escaped + src.slice(closingTick);
writeFileSync("F:/MyRcon/src/lib/exclusive-plugins.ts", out, "utf8");
console.log("done, new length:", out.length);
