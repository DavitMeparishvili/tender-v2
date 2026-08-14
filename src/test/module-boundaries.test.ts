import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";

const checkerPath = resolve(
  process.cwd(),
  "scripts/verify-module-boundaries.mjs",
);
const fixtureRoots: string[] = [];

function createFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "tender-module-boundaries-"));
  fixtureRoots.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = join(root, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents, "utf8");
  }

  return root;
}

function runChecker(root: string) {
  return spawnSync(process.execPath, [checkerPath, "--root", root], {
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("rejects forbidden domain dependencies across supported module syntaxes", () => {
  const root = createFixture({
    "src/modules/tenders/domain/static-import.ts":
      'import type { Metadata } from "next";\n',
    "src/modules/tenders/domain/react-import.ts":
      'import type { ReactNode } from "react";\n',
    "src/modules/tenders/domain/re-export.ts":
      'export { PrismaClient } from "@prisma/client";\n',
    "src/modules/tenders/domain/commonjs.ts": 'require("pg");\n',
    "src/modules/tenders/domain/dynamic.ts": 'await import("stripe");\n',
    "src/modules/tenders/domain/cross-module.ts":
      'import "../../billing/infrastructure/stripe-adapter";\n',
  });

  const result = runChecker(root);
  const output = `${result.stdout}${result.stderr}`;

  expect(result.status).toBe(1);
  expect(output).toContain("next");
  expect(output).toContain("react");
  expect(output).toContain("@prisma/client");
  expect(output).toContain("pg");
  expect(output).toContain("stripe");
  expect(output).toContain("billing/infrastructure/stripe-adapter");
});

it("rejects an unlisted provider SDK as an unapproved external dependency", () => {
  const root = createFixture({
    "src/modules/tenders/domain/provider.ts":
      'import { ProviderClient } from "unknown-provider-sdk";\n',
  });

  const result = runChecker(root);
  const output = `${result.stdout}${result.stderr}`;

  expect(result.status).toBe(1);
  expect(output).toContain("unknown-provider-sdk");
  expect(output).toContain("unapproved external/provider dependency");
});

it("rejects Node.js runtime imports from domain code", () => {
  const root = createFixture({
    "src/modules/tenders/domain/hash.ts":
      'import { createHash } from "node:crypto";\n',
  });

  const result = runChecker(root);
  const output = `${result.stdout}${result.stderr}`;

  expect(result.status).toBe(1);
  expect(output).toContain("node:crypto");
  expect(output).toContain("Node.js runtime dependency");
});

it("accepts clean domain imports and ignores import-like comments", () => {
  const root = createFixture({
    "src/modules/shared/domain/result.ts": `
      // import "react";
      /* export { PrismaClient } from "@prisma/client"; */
      export type Result<T> = { ok: true; value: T } | { ok: false };
    `,
    "src/modules/tenders/domain/tender.ts":
      'import type { Result } from "../../shared/domain/result";\nexport type TenderResult = Result<string>;\n',
  });

  const result = runChecker(root);

  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
});
