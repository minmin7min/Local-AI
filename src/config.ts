import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  STORAGE_ROOT: z.string().default("./storage"),
  AI_PROVIDER: z.enum(["deterministic", "openai-compatible"]).default("deterministic"),
  AI_MODEL: z.string().min(1).default("deterministic-v1"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().max(25_000_000).default(10_485_760),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(900).max(86_400).default(28_800),
});

export type Config = z.infer<typeof schema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}
