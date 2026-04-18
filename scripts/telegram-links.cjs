/**
 * Print Telegram API URLs using TELEGRAM_BOT_TOKEN from project `.env`.
 * Does not commit secrets — run locally after filling `.env`.
 */
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const baseUrl =
  process.env.TELEGRAM_WEBHOOK_BASE_URL?.trim() || "https://YOUR-RAILWAY-DOMAIN";

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .env");
  process.exit(1);
}

// Token stays in path as-is (colon is valid); do not over-encode.
const b = `https://api.telegram.org/bot${token}`;

console.log("\n--- Copy these into your browser ---\n");
console.log("1) Bot info (getMe):");
console.log(`${b}/getMe\n`);
console.log("2) Webhook status:");
console.log(`${b}/getWebhookInfo\n`);
console.log("3) Set webhook (one-time; set TELEGRAM_WEBHOOK_BASE_URL in .env to your public HTTPS origin):");
const webhookPath = "/api/telegram/webhook";
const setUrl = `${baseUrl.replace(/\/$/, "")}${webhookPath}`;
console.log(`${b}/setWebhook?url=${encodeURIComponent(setUrl)}\n`);
