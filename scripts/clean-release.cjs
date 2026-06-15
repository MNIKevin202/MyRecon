const fs = require("node:fs");
const path = require("node:path");

const release = path.join(process.cwd(), "release");

if (fs.existsSync(release)) {
  fs.rmSync(release, { recursive: true, force: true });
}

fs.mkdirSync(release, { recursive: true });
console.log("Cleaned release output.");
