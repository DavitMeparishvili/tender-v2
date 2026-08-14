import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
const providerSdkPrefixes = [
  "@anthropic-ai/",
  "@aws-sdk/",
  "@better-auth/",
  "@googlemaps/",
  "@mapbox/",
  "@sendgrid/",
  "@supabase/",
  "@vercel/blob",
  "better-auth",
  "cloudinary",
  "firebase",
  "firebase-admin",
  "mapbox-gl",
  "nodemailer",
  "openai",
  "postmark",
  "resend",
  "stripe",
  "twilio",
];

function isPackageOrSubpath(specifier, packageName) {
  return specifier === packageName || specifier.startsWith(`${packageName}/`);
}

function providerSdkName(specifier) {
  return providerSdkPrefixes.find((prefix) =>
    prefix.endsWith("/")
      ? specifier.startsWith(prefix)
      : isPackageOrSubpath(specifier, prefix),
  );
}

function normalizedRelativePath(root, path) {
  return relative(root, path).split(sep).join("/");
}

function importedPath(root, sourceFile, specifier) {
  if (specifier.startsWith(".")) {
    return resolve(dirname(sourceFile), specifier);
  }

  if (specifier.startsWith("@/")) {
    return resolve(root, specifier.slice(2));
  }

  if (specifier.startsWith("src/")) {
    return resolve(root, specifier);
  }

  return undefined;
}

function crossModuleInfrastructureReason(root, sourceFile, specifier) {
  const sourcePath = normalizedRelativePath(root, sourceFile);
  const sourceModule = /^src\/modules\/([^/]+)\//.exec(sourcePath)?.[1];
  const resolvedImport = importedPath(root, sourceFile, specifier);

  if (!sourceModule || !resolvedImport) {
    return undefined;
  }

  const importedSourcePath = normalizedRelativePath(root, resolvedImport);
  const importedMatch = /^src\/modules\/([^/]+)\/infrastructure(?:\/|$)/.exec(
    importedSourcePath,
  );

  if (importedMatch?.[1] && importedMatch[1] !== sourceModule) {
    return `infrastructure from module ${importedMatch[1]}`;
  }

  return undefined;
}

function forbiddenReason(root, sourceFile, specifier) {
  if (isPackageOrSubpath(specifier, "next")) {
    return "Next.js framework";
  }

  if (
    isPackageOrSubpath(specifier, "react") ||
    isPackageOrSubpath(specifier, "react-dom") ||
    specifier.startsWith("react-server-dom-")
  ) {
    return "React framework";
  }

  if (
    specifier.startsWith("@prisma/") ||
    specifier.includes("generated/prisma")
  ) {
    return "Prisma ORM";
  }

  if (isPackageOrSubpath(specifier, "pg")) {
    return "PostgreSQL driver";
  }

  const providerSdk = providerSdkName(specifier);
  if (providerSdk) {
    return `provider SDK ${providerSdk.replace(/\/$/, "")}`;
  }

  return crossModuleInfrastructureReason(root, sourceFile, specifier);
}

function domainSourceFiles(root) {
  const modulesRoot = resolve(root, "src/modules");
  const files = [];

  function visit(directory, insideDomain) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        visit(path, insideDomain || entry.name === "domain");
      } else if (insideDomain && sourceExtensions.has(extname(entry.name))) {
        files.push(path);
      }
    }
  }

  try {
    visit(modulesRoot, false);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }

  return files.sort();
}

function verifyBoundaries(root) {
  const violations = [];

  for (const file of domainSourceFiles(root)) {
    const source = readFileSync(file, "utf8");
    const imports = ts.preProcessFile(source, true, true).importedFiles;

    for (const importedFile of imports) {
      const reason = forbiddenReason(root, file, importedFile.fileName);
      if (reason) {
        violations.push({
          file: normalizedRelativePath(root, file),
          reason,
          specifier: importedFile.fileName,
        });
      }
    }
  }

  return violations;
}

function requestedRoot(arguments_) {
  if (arguments_.length === 0) {
    return repositoryRoot;
  }

  if (arguments_.length === 2 && arguments_[0] === "--root") {
    return resolve(arguments_[1]);
  }

  throw new Error(
    "Usage: node scripts/verify-module-boundaries.mjs [--root <path>]",
  );
}

const root = requestedRoot(process.argv.slice(2));
const violations = verifyBoundaries(root);

if (violations.length > 0) {
  console.error("Domain module boundary violations:");
  for (const violation of violations) {
    console.error(
      `- ${violation.file}: ${violation.specifier} (${violation.reason})`,
    );
  }
  process.exitCode = 1;
} else {
  console.log("Domain module boundaries verified.");
}
