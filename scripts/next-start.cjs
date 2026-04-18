require("./dotenv-override.cjs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const r = spawnSync("npx", ["next", "start"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
  cwd: root,
});
process.exit(r.status ?? 1);
