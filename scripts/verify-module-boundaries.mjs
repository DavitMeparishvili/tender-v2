import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
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
const domainSafePackages = [];
const domainTestPackages = ["vitest"];
const nodeBuiltinModules = new Set(
  builtinModules.map((moduleName) => moduleName.replace(/^node:/, "")),
);

function isPackageOrSubpath(specifier, packageName) {
  return specifier === packageName || specifier.startsWith(`${packageName}/`);
}

function isInternalSpecifier(specifier) {
  return (
    specifier.startsWith(".") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("src/")
  );
}

function isNodeBuiltin(specifier) {
  return nodeBuiltinModules.has(specifier.replace(/^node:/, ""));
}

function isApprovedPackage(specifier, packages) {
  return packages.some((packageName) =>
    isPackageOrSubpath(specifier, packageName),
  );
}

function isDomainTest(sourceFile) {
  return /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(sourceFile);
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

function isPathWithin(path, directory) {
  return path === directory || path.startsWith(`${directory}/`);
}

function isOutsideRepository(root, target) {
  const relativeTarget = relative(root, target);

  return (
    relativeTarget === ".." ||
    relativeTarget.startsWith(`..${sep}`) ||
    resolve(root, relativeTarget) !== target
  );
}

function isSharedPublicEntry(path) {
  const sharedRoot = "src/modules/shared";

  return (
    path === sharedRoot ||
    path === `${sharedRoot}/index` ||
    [...sourceExtensions].some(
      (extension) => path === `${sharedRoot}/index${extension}`,
    )
  );
}

function internalImportReason(root, sourceFile, specifier) {
  const sourcePath = normalizedRelativePath(root, sourceFile);
  const sourceModule = /^src\/modules\/([^/]+)\//.exec(sourcePath)?.[1];
  const resolvedImport = importedPath(root, sourceFile, specifier);

  if (!sourceModule || !resolvedImport) {
    return "unapproved internal dependency";
  }

  if (isOutsideRepository(root, resolvedImport)) {
    return "path outside repository";
  }

  const importedSourcePath = normalizedRelativePath(root, resolvedImport);
  const ownDomain = `src/modules/${sourceModule}/domain`;
  const sharedDomain = "src/modules/shared/domain";

  if (
    isPathWithin(importedSourcePath, ownDomain) ||
    isPathWithin(importedSourcePath, sharedDomain) ||
    isSharedPublicEntry(importedSourcePath)
  ) {
    return undefined;
  }

  if (isPathWithin(importedSourcePath, "src/infrastructure")) {
    return "root infrastructure";
  }

  if (isPathWithin(importedSourcePath, "src/generated")) {
    return "generated source";
  }

  if (isPathWithin(importedSourcePath, "app")) {
    return "application route layer";
  }

  const moduleLayer =
    /^src\/modules\/([^/]+)\/(application|infrastructure)(?:\/|$)/.exec(
      importedSourcePath,
    );

  if (moduleLayer?.[1] && moduleLayer[2]) {
    return `${moduleLayer[2]} from module ${moduleLayer[1]}`;
  }

  const otherModuleDomain = /^src\/modules\/([^/]+)\/domain(?:\/|$)/.exec(
    importedSourcePath,
  );

  if (otherModuleDomain?.[1]) {
    return `domain from module ${otherModuleDomain[1]}`;
  }

  return "unapproved internal dependency";
}

function forbiddenReason(root, sourceFile, specifier) {
  if (isInternalSpecifier(specifier)) {
    return internalImportReason(root, sourceFile, specifier);
  }

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

  if (isNodeBuiltin(specifier)) {
    return "Node.js runtime dependency";
  }

  if (
    isApprovedPackage(specifier, domainSafePackages) ||
    (isDomainTest(sourceFile) &&
      isApprovedPackage(specifier, domainTestPackages))
  ) {
    return undefined;
  }

  return "unapproved external/provider dependency";
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
