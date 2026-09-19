import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
loadEnvConfig(process.cwd());
const url = new URL(
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!,
);
if (url.hostname.endsWith(".neon.tech"))
  url.hostname = url.hostname.replace("-pooler.", ".");
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: url.toString() },
});
