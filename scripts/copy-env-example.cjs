/**
 * Create `.env` from `.env.example` if `.env` is missing (local dev / first clone).
 * Run: npm run setup:env
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (!fs.existsSync(examplePath)) {
  console.error("Missing .env.example");
  process.exit(1);
}

if (fs.existsSync(envPath)) {
  console.log(".env already exists — not overwriting. Edit .env or remove it to regenerate.");
  process.exit(0);
}

fs.copyFileSync(examplePath, envPath);
console.log("Created .env from .env.example");
console.log("Next: set KINGUIN_API_KEY (required for catalog/search), then npm run dev");
