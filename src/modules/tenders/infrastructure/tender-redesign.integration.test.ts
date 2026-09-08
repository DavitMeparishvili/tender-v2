import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { editPublishedTender } from "../application/edit-published-tender";
import { PrismaTenderRepository } from "./prisma-tender-repository";
import { getAttachmentPreviews } from "../application/get-attachment-previews";

describe("tender redesign persistence and permissions", () => {
  it("persists quantities, queries owned records, and refuses forbidden published edits", async () => {
    const ownerId = randomUUID();
    const otherId = randomUUID();
    const id = randomUUID();
    await database.user.createMany({
      data: [ownerId, otherId].map((id) => ({
        id,
        name: "Redesign test",
        email: `${id}@tender.test`,
        emailVerified: true,
      })),
    });
    try {
      await database.tender.create({
        data: {
          id,
          ownerId,
          title: "Renovation in Vake",
          status: "PUBLISHED",
          specialty: "CONSTRUCTION_REPAIR",
          serviceCode: "GENERAL_CONSTRUCTION",
          deadline: new Date(Date.now() + 86_400_000),
          city: "Tbilisi",
        },
      });
      const input = {
        title: "Updated renovation in Vake",
        fullDescription: "A complete apartment renovation project.",
        workerNotes: "Crew of 4–6",
        materialNotes: "Tiles supplied",
        equipmentNotes: null,
        areaSquareMeters: 96,
        workItems: [{ name: "Floor preparation", quantity: 96, unit: "m²" }],
      };
      expect(await editPublishedTender(id, input, { id: otherId })).toEqual({
        ok: false,
        error: "NOT_OWNER",
      });
      expect(await editPublishedTender(id, input, { id: ownerId })).toEqual({
        ok: true,
        value: null,
      });
      const repository = new PrismaTenderRepository();
      const found = await repository.listOwned(
        { id: ownerId },
        { search: "vAkE", status: "PUBLISHED", sort: "deadline" },
      );
      expect(found).toHaveLength(1);
      expect(found[0]?.workItems).toEqual(input.workItems);
      expect(found[0]?.areaSquareMeters).toBe(96);
      expect(
        await repository.listOwned({ id: otherId }, { search: "Vake" }),
      ).toEqual([]);
      await database.tenderAttachment.create({
        data: {
          id: randomUUID(),
          tenderId: id,
          objectKey: "secret-key/" + id,
          originalFileName: "Private address 37.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1024,
        },
      });
      const preview = JSON.stringify(await getAttachmentPreviews(id));
      expect(preview).not.toContain("Private address");
      expect(preview).not.toContain("secret-key");
      expect(preview).toContain('"url":null');
      await database.bid.create({
        data: {
          id: randomUUID(),
          tenderId: id,
          providerId: otherId,
          amountMinorUnits: 10000,
          currency: "GEL",
          status: "SUBMITTED",
          conditions: "test",
          qualifyingSubmittedAt: new Date(),
        },
      });
      expect(await editPublishedTender(id, input, { id: ownerId })).toEqual({
        ok: false,
        error: "EDIT_NOT_ALLOWED",
      });
      // A withdrawn offer remains history: material scope cannot change under it.
      await database.bid.updateMany({
        where: { tenderId: id },
        data: { status: "WITHDRAWN" },
      });
      expect(await editPublishedTender(id, input, { id: ownerId })).toEqual({
        ok: false,
        error: "EDIT_NOT_ALLOWED",
      });
      await database.bid.deleteMany({ where: { tenderId: id } });
      await database.tender.update({
        where: { id },
        data: { deadline: new Date(Date.now() - 1000) },
      });
      expect(await editPublishedTender(id, input, { id: ownerId })).toEqual({
        ok: false,
        error: "EDIT_NOT_ALLOWED",
      });
      await database.tender.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      expect(await getAttachmentPreviews(id)).toEqual([]);
    } finally {
      await database.tender.deleteMany({ where: { id } });
      await database.user.deleteMany({
        where: { id: { in: [ownerId, otherId] } },
      });
    }
  });
});
