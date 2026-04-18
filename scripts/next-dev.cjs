require("./dotenv-override.cjs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const extra = process.argv.slice(2);
const r = spawnSync("npx", ["next", "dev", ...extra], {
  stdio: "inherit",
  env: process.env,
  shell: true,
  cwd: root,
});
process.exit(r.status ?? 1);
