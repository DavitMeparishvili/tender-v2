import "dotenv/config";
import { readFileSync } from "node:fs";
import { database } from "../../src/infrastructure/db/client";

const url = new URL(process.env.DATABASE_URL!);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  throw new Error("QA fixture operations require a local database");
}
const [operation, id] = process.argv.slice(2);
try {
  if (operation === "catalog" || operation === "repair-catalog") {
    const sql = readFileSync(
      "prisma/migrations/20260816190000_georgian_places/migration.sql",
      "utf8",
    );
    const records = [
      ...sql.matchAll(/\((\d+), '((?:[^']|'')*)', '((?:[^']|'')*)', '/g),
    ];
    const differences = [];
    for (const row of records) {
      const existing = await database.georgianPlace.findUnique({
        where: { id: Number(row[1]) },
      });
      if (
        existing &&
        (existing.nameEn !== row[2]!.replaceAll("''", "'") ||
          existing.nameKa !== row[3]!.replaceAll("''", "'"))
      ) {
        differences.push({
          id: existing.id,
          actual: existing.nameEn,
          expected: row[2],
        });
        if (
          operation === "repair-catalog" &&
          (existing.nameEn.includes("???") || existing.nameKa.includes("???"))
        ) {
          await database.georgianPlace.update({
            where: { id: existing.id },
            data: {
              nameEn: row[2]!.replaceAll("''", "'"),
              nameKa: row[3]!.replaceAll("''", "'"),
            },
          });
        }
      }
    }
    console.log(JSON.stringify({ catalogDifferences: differences }));
  } else if (operation === "settle" || operation === "selection-retry") {
    if (!id) throw new Error("Tender ID required");
    const tender = await database.tender.findUniqueOrThrow({ where: { id } });
    if (!tender.title.startsWith("QA MCP 20260908"))
      throw new Error("Not a QA tender");
    if (operation === "settle")
      await database.tender.update({
        where: { id },
        data: { deadline: new Date() },
      });
    const { runDeadlineSelection } =
      await import("../../src/modules/bidding/application/run-deadline-selection");
    console.log(JSON.stringify(await runDeadlineSelection(tender.id)));
  } else if (operation === "expire") {
    if (!id) throw new Error("QA tender ID required");
    const agreement = await database.agreement.findUniqueOrThrow({
      where: { tenderId: id },
    });
    if (!agreement.tenderTitle.startsWith("QA MCP 20260908"))
      throw new Error("Not a QA agreement");
    const now = new Date();
    if (agreement.status === "PENDING_CONFIRMATION")
      await database.agreement.update({
        where: { id: agreement.id },
        data: { confirmDeadline: new Date(now.getTime() - 1000) },
      });
    const { prismaAgreementGateway } =
      await import("../../src/modules/agreements/infrastructure/prisma-agreement-gateway");
    const result = await prismaAgreementGateway.manage(
      agreement.id,
      { type: "EXPIRE", actorId: null },
      now,
      { next: () => crypto.randomUUID() },
    );
    console.log(JSON.stringify({ id: agreement.id, result }));
  } else if (operation === "qa-provider-login") {
    const user = await database.user.findFirstOrThrow({
      where: { email: { startsWith: "qa.mcp.20260908.mobile.provider." } },
      orderBy: { createdAt: "desc" },
    });
    const password = process.env.QA_FIXTURE_PASSWORD;
    if (!password || password.length < 12)
      throw new Error("QA fixture password required");
    const { hashPassword } = await import("better-auth/crypto");
    await database.account.updateMany({
      where: { userId: user.id, providerId: "credential" },
      data: { password: await hashPassword(password) },
    });
    console.log(JSON.stringify({ email: user.email }));
  } else if (operation === "admin") {
    if (!id) throw new Error("QA email required");
    const user = await database.user.findUniqueOrThrow({
      where: { email: id },
    });
    if (!user.email.startsWith("qa.mcp.20260908."))
      throw new Error("Not a QA user");
    await database.userCapability.upsert({
      where: { userId_code: { userId: user.id, code: "ADMIN" } },
      create: { id: crypto.randomUUID(), userId: user.id, code: "ADMIN" },
      update: {},
    });
    console.log("QA moderator capability enabled");
  } else {
    throw new Error("Unknown fixture operation");
  }
} finally {
  await database.$disconnect();
}
