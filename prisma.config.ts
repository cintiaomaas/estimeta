import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
export default defineConfig({ schema: "prisma/schema.prisma", migrations: { path: "prisma/migrations" } });
