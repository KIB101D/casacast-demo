import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// The demo version's own tables (src/demo/schema.ts), with a separate migrations folder and
// journal table, so the product's migrations (drizzle.config.ts) are untouched.
export default defineConfig({
  schema: "./src/demo/schema.ts",
  out: "./drizzle-demo",
  dialect: "postgresql",
  casing: "snake_case",
  tablesFilter: ["demo_*"],
  migrations: { table: "__drizzle_migrations_demo" },
  // Neon on Vercel provides a pooled DATABASE_URL and a direct DATABASE_URL_UNPOOLED; migrations
  // take the direct one when it exists.
  dbCredentials: {
    url: (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL)!,
  },
});
