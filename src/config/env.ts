import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(
  input: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  return serverEnvSchema.parse(input);
}
