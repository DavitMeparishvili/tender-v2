import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_REGION: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_BUCKET_TEST: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  // `z.coerce.boolean()` is deliberately avoided: it turns the string "false"
  // into `true`, so a deployment that disables path-style addressing could not
  // express that.
  STORAGE_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(
  input: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  return serverEnvSchema.parse(input);
}
