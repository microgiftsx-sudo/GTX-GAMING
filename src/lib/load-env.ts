import { config } from "dotenv";
import path from "path";

/** Prefer project `.env` over inherited User/System env (e.g. stale DATABASE_URL on Windows). */
config({ path: path.resolve(process.cwd(), ".env"), override: true });
