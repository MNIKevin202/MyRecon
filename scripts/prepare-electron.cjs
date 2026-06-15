const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const standaloneNext = path.join(standalone, ".next");

function copyDir(from, to) {
  if (!fs.existsSync(from)) {
    return;
  }

  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function materializeSymlinks(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const stat = fs.lstatSync(fullPath);

    if (stat.isSymbolicLink()) {
      const target = fs.realpathSync(fullPath);
      fs.rmSync(fullPath, { recursive: true, force: true });
      fs.cpSync(target, fullPath, { recursive: true });
      continue;
    }

    if (entry.isDirectory()) {
      materializeSymlinks(fullPath);
    }
  }
}

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  throw new Error("Next standalone server is missing. Run npm run build first.");
}

copyDir(path.join(root, ".next", "static"), path.join(standaloneNext, "static"));
copyDir(path.join(root, "public"), path.join(standalone, "public"));
copyDir(path.join(root, "prisma", "migrations"), path.join(standalone, "prisma", "migrations"));
materializeSymlinks(standalone);

for (const optionalModule of [
  path.join(standalone, "node_modules", "cpu-features"),
  path.join(standalone, ".next", "node_modules", "cpu-features"),
]) {
  if (fs.existsSync(optionalModule)) {
    fs.rmSync(optionalModule, { recursive: true, force: true });
  }
}

console.log("Prepared Next standalone output for Electron.");
