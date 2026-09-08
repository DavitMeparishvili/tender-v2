import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { saveAuthoring } from "./tender-authoring-repository";
import { saveTenderAuthoring } from "../application/save-tender-authoring";
import { prismaBidRepository } from "../../bidding/infrastructure/prisma-bid-repository";

describe("authoring persistence", () => {
  it("saves all fields and attachments atomically, rejects foreign/closed edits and stale-currency bids", async () => {
    const ownerId = randomUUID(),
      otherId = randomUUID(),
      id = randomUUID(),
      oldFile = randomUUID(),
      newFile = randomUUID();
    await database.user.createMany({
      data: [ownerId, otherId].map((id) => ({
        id,
        name: "Authoring test",
        email: `${id}@tender.test`,
        emailVerified: true,
      })),
    });
    const deadline = new Date(Date.now() + 86400000);
    try {
      await database.tender.create({
        data: {
          id,
          ownerId,
          title: "Renovation in Vake",
          specialty: "CONSTRUCTION_REPAIR",
          serviceCode: "RENOVATION_REMODELING",
          status: "PUBLISHED",
          currency: "GEL",
          deadline,
          budgetMinorUnits: 4800000,
          fullDescription: "Existing complete renovation description",
          shortDescription: "Existing short description",
          scopeOfWork: "Existing scope of work",
        },
      });
      await database.tenderAttachment.create({
        data: {
          id: oldFile,
          tenderId: id,
          originalFileName: "old.pdf",
          objectKey: `tenders/${id}/old`,
          mimeType: "application/pdf",
          sizeBytes: 100,
        },
      });
      const details = {
        title: "Updated renovation in Vake",
        currency: "GEL" as const,
        budgetMinorUnits: 5000000,
        conditions: "Work on weekdays",
        workItems: [{ name: "Floor", quantity: 96, unit: "m²" }],
      };
      const additions = [
        {
          id: newFile,
          objectKey: `tenders/${id}/${newFile}`,
          originalFileName: "new.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
        },
      ];
      expect(
        await saveAuthoring(
          id,
          { id: ownerId },
          { ...details, currency: "USD" },
          undefined,
          [oldFile],
          [],
        ),
      ).toMatchObject({ ok: false, error: "INVALID_INPUT" });
      expect(
        await saveAuthoring(
          id,
          { id: otherId },
          details,
          undefined,
          [],
          additions,
        ),
      ).toMatchObject({ ok: false, error: "NOT_OWNER" });
      expect(
        await saveAuthoring(
          id,
          { id: ownerId },
          details,
          undefined,
          [randomUUID()],
          additions,
        ),
      ).toMatchObject({ ok: false, error: "INVALID_INPUT" });
      expect(
        (await database.tender.findUniqueOrThrow({ where: { id } })).title,
      ).toBe("Renovation in Vake");
      expect(
        await database.tenderAttachment.count({ where: { tenderId: id } }),
      ).toBe(1);
      expect(
        await saveAuthoring(
          id,
          { id: ownerId },
          details,
          undefined,
          [],
          additions,
        ),
      ).toMatchObject({ ok: true });
      const saved = await database.tender.findUniqueOrThrow({
        where: { id },
        include: { attachments: true },
      });
      expect(saved).toMatchObject({
        currency: "GEL",
        budgetMinorUnits: 5000000,
        conditions: "Work on weekdays",
        workItems: details.workItems,
      });
      expect(saved.attachments.map((file) => file.id)).toEqual([newFile]);
      expect(
        await saveAuthoring(
          id,
          { id: ownerId },
          details,
          undefined,
          [],
          additions,
        ),
      ).toMatchObject({ ok: true });
      const bid = {
        id: randomUUID(),
        tenderId: id,
        providerId: otherId,
        amountMinorUnits: 4000000,
        currency: "USD" as const,
        command: { amountMinorUnits: 4000000, conditions: "Ready to start" },
        qualifyingSubmittedAt: new Date(),
      };
      expect(await prismaBidRepository.insertBid(bid, deadline)).toMatchObject({
        ok: false,
        error: "TENDER_NOT_OPEN",
      });
      expect(
        await prismaBidRepository.insertBid(
          { ...bid, currency: "GEL" },
          deadline,
        ),
      ).toMatchObject({ ok: true });
      expect(
        await saveAuthoring(id, { id: ownerId }, details, undefined, [], []),
      ).toMatchObject({ ok: false, error: "EDIT_NOT_ALLOWED" });
      expect(
        await database.tenderAttachment.count({ where: { tenderId: id } }),
      ).toBe(1);
      await database.bid.deleteMany({ where: { tenderId: id } });
      await database.tender.update({
        where: { id },
        data: { status: "DRAFT" },
      });
      expect(
        await saveTenderAuthoring(
          id,
          {
            details: {
              title: "Draft with cleared fields",
              fullDescription: null,
              shortDescription: null,
              scopeOfWork: null,
              budgetMinorUnits: null,
              deadline: null,
            },
            location: null,
            retainedAttachmentIds: [newFile],
            uploads: [],
          },
          { id: ownerId },
        ),
      ).toMatchObject({ ok: true });
      expect(
        await database.tender.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        fullDescription: null,
        budgetMinorUnits: null,
        deadline: null,
        city: null,
      });
    } finally {
      await database.tender.deleteMany({ where: { id } });
      await database.user.deleteMany({
        where: { id: { in: [ownerId, otherId] } },
      });
    }
  });
});
