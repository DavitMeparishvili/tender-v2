// Sibling of `validateTestDatabaseUrl`: the test run must never write objects
// into the bucket development uses, so the test bucket has to name itself as a
// test target and has to differ from the configured development bucket.
export function validateTestStorageBucket(
  value: string | undefined,
  developmentBucket: string | undefined,
): string {
  if (!value) {
    throw new Error("STORAGE_BUCKET_TEST is required");
  }

  if (!value.endsWith("-test")) {
    throw new Error("STORAGE_BUCKET_TEST must target a bucket ending in -test");
  }

  if (value === developmentBucket) {
    throw new Error(
      "STORAGE_BUCKET_TEST must not name the same bucket as STORAGE_BUCKET",
    );
  }

  return value;
}
