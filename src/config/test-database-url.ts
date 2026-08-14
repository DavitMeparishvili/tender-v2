import { getServerEnv, type ServerEnv } from "./env";

export type TestDatabaseServerEnv = Omit<ServerEnv, "DATABASE_URL_TEST"> & {
  DATABASE_URL_TEST: string;
};

export function validateTestDatabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error("DATABASE_URL_TEST is required");
  }

  let parsedDatabaseUrl: URL;

  try {
    parsedDatabaseUrl = new URL(value);
  } catch {
    throw new Error("DATABASE_URL_TEST must be a valid URL");
  }

  let databaseName: string;

  try {
    databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.slice(1));
  } catch {
    throw new Error("DATABASE_URL_TEST must contain a valid database name");
  }

  if (
    !databaseName ||
    databaseName.includes("/") ||
    !databaseName.endsWith("_test")
  ) {
    throw new Error("DATABASE_URL_TEST must target a database ending in _test");
  }

  return parsedDatabaseUrl.toString();
}

export function getTestDatabaseServerEnv(
  input: NodeJS.ProcessEnv = process.env,
): TestDatabaseServerEnv {
  const testDatabaseUrl = validateTestDatabaseUrl(input.DATABASE_URL_TEST);
  const serverEnv = getServerEnv({
    ...input,
    DATABASE_URL: testDatabaseUrl,
    DATABASE_URL_TEST: testDatabaseUrl,
  });

  return {
    ...serverEnv,
    DATABASE_URL: testDatabaseUrl,
    DATABASE_URL_TEST: testDatabaseUrl,
  };
}
