import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
  STORAGE_ENDPOINT: z.string().url(),
  // Server-side S3 calls can use Docker's private network, while presigned
  // browser URLs need the public HTTPS hostname. If omitted, the existing
  // single-endpoint deployment remains supported.
  STORAGE_PUBLIC_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  // Consumed only by `src/test/integration/setup.ts`, exactly like
  // `DATABASE_URL_TEST` above, so a production deployment is not made to
  // supply it. `validateTestStorageBucket` refuses a missing value on the
  // test side, so requiredness here buys no safety.
  STORAGE_BUCKET_TEST: z.string().min(1).optional(),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  // `z.coerce.boolean()` is deliberately avoided: it turns the string "false"
  // into `true`, so a deployment that disables path-style addressing could not
  // express that.
  STORAGE_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  // Required, not optional: a deployment without it would silently never run
  // winner selection, and the Phase 0 exit criterion forbids a missing-secret
  // fallback in a production build. 32 characters matches AUTH_SECRET.
  SELECTION_WORKER_SECRET: z.string().min(32),
  AGREEMENT_WORKER_SECRET: z.string().min(32),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(
  input: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  return serverEnvSchema.parse(input);
}
