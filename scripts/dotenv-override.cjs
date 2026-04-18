/**
 * Load project `.env` and override existing process env (e.g. Windows User DATABASE_URL).
 * Keeps local dev aligned with production: single source of truth in `.env`.
 */
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});
