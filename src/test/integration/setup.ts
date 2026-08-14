import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL_TEST;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_TEST is required for integration tests");
}

let parsedDatabaseUrl: URL;

try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  throw new Error("DATABASE_URL_TEST must be a valid URL");
}

const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.slice(1));

if (!databaseName.endsWith("_test")) {
  throw new Error(
    "DATABASE_URL_TEST must target a database ending in _test for integration tests",
  );
}

process.env.DATABASE_URL = parsedDatabaseUrl.toString();
