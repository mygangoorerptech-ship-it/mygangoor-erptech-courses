// backend/src/config/env.js  (ESM)
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env (or .env.test if NODE_ENV=test)
const envPath =
  process.env.NODE_ENV === "test"
    ? path.resolve(__dirname, "../../.env.test")
    : path.resolve(__dirname, "../../.env");

dotenv.config({ path: envPath });

export function env(key, fallback) {
  return process.env[key] ?? fallback;
}
