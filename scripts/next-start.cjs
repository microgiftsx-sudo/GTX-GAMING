require("./dotenv-override.cjs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const nextBin = require.resolve("next/dist/bin/next");
const r = spawnSync(process.execPath, [nextBin, "start"], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});
process.exit(r.status ?? 1);
