import "dotenv/config";
import { database } from "../src/infrastructure/db/client";
import { S3ObjectStorage } from "../src/modules/tenders/infrastructure/s3-object-storage";
import { sniffAttachmentMimeType } from "../src/modules/tenders/domain/mime-sniff";
import { coarsenCoordinates } from "../src/modules/tenders/domain/coordinates";

// Additive, idempotent sample enrichment. Never creates accounts or tenders,
// changes existing prices/dates/ownership, or resets application records.
const items = [
  { name: "Floor preparation", quantity: 96, unit: "m²" },
  { name: "Wall plastering", quantity: 180, unit: "m²" },
  { name: "Electrical conduit installation", quantity: 85, unit: "m" },
  { name: "Tile adhesive supply", quantity: 250, unit: "kg" },
];
const photoSources = [7937304, 804392, 12036084, 1571460].map(
  (id) =>
    `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1000`,
);
function samplePdf(title: string) {
  const lines = [
    "ILLUSTRATIVE PROJECT BRIEF - SAMPLE DATA",
    title,
    "Renovation of a 96 square metre apartment in Tbilisi.",
    "Demolition, electrical and plumbing rework, plastering and finishes.",
    "Team: crew of 4-6, including a licensed electrician.",
    "Client supplies tiles and sanitary ware.",
    "Floor preparation: 96 m2; plastering: 180 m2.",
    "Conduit: 85 m; tile adhesive: 250 kg.",
    "This sample document is not a construction instruction.",
  ];
  const stream =
    "BT /F1 12 Tf 50 780 Td " +
    lines
      .map(
        (line, i) =>
          `${i ? "0 -28 Td " : ""}(${line.replace(/[()\\]/g, " ")}) Tj`,
      )
      .join("\n") +
    " ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
async function main() {
  const dbName = new URL(process.env.DATABASE_URL!).pathname;
  if (!dbName.endsWith("_dev"))
    throw new Error(
      "This example seeder is restricted to the development database.",
    );
  const tenders = await database.tender.findMany({
    where: {
      id: {
        in: [
          "d4329b32-1f2a-4570-86bd-43e127e7721f",
          "c184d970-da56-49c2-9d22-a33a452d5210",
        ],
      },
    },
    select: {
      id: true,
      title: true,
      budgetMinorUnits: true,
      deadline: true,
      desiredStartDate: true,
      workItems: true,
      areaSquareMeters: true,
      reference: true,
      addressLine: true,
      exactLatitude: true,
      exactLongitude: true,
      owner: { select: { email: true } },
      _count: { select: { attachments: true, bids: true } },
    },
  });
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify(tenders, null, 2));
    return;
  }
  const owner = tenders.find(
    (tender) =>
      tender.id === "d4329b32-1f2a-4570-86bd-43e127e7721f" &&
      tender.owner.email === "phase1.client@tender.test" &&
      tender.budgetMinorUnits === 4_800_000 &&
      tender.deadline?.toISOString() === "2026-09-05T08:00:00.000Z" &&
      tender.desiredStartDate?.toISOString() === "2026-09-14T00:00:00.000Z" &&
      tender.title === "Full apartment renovation in Vake",
  );
  const publicTender = tenders.find(
    (tender) =>
      tender.id === "c184d970-da56-49c2-9d22-a33a452d5210" &&
      tender.owner.email === "demo.client@tender.test" &&
      tender.budgetMinorUnits === 12_000_000 &&
      tender.deadline?.toISOString() === "2026-08-21T13:16:00.000Z" &&
      tender.desiredStartDate?.toISOString() === "2026-08-23T00:00:00.000Z" &&
      (tender.title === "with map" ||
        tender.title === "Apartment renovation in Tbilisi"),
  );
  if (!owner || !publicTender)
    throw new Error(
      "Expected reference tenders were not found; no records were changed.",
    );
  // Explicitly requested sample correction, not a production geocoding result.
  // Address reference: https://ge.near-place.com/zoommer-zumeri-37-ilia-chavchavadze-avenue-tbilisi
  if (process.argv.includes("--align-vake")) {
    if (
      owner.addressLine !== "Chavchavadze Avenue 37" ||
      owner._count.bids !== 0
    )
      throw new Error(
        "Vake sample address/bid guard failed; no records were changed.",
      );
    const exact = { latitude: 41.7115293, longitude: 44.7573781 };
    const approximate = coarsenCoordinates(exact);
    await database.tender.update({
      where: { id: owner.id },
      data: {
        exactLatitude: exact.latitude,
        exactLongitude: exact.longitude,
        publicLatitude: approximate.latitude,
        publicLongitude: approximate.longitude,
      },
    });
    console.log(
      JSON.stringify({
        id: owner.id,
        previous: {
          latitude: owner.exactLatitude,
          longitude: owner.exactLongitude,
        },
        exampleVakePin: exact,
        publicArea: approximate,
      }),
    );
  }
  const download = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Asset failed: ${response.status} ${url}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const photos = await Promise.all(photoSources.map(download));
  const dwg = await download(
    "https://raw.githubusercontent.com/LibreDWG/libredwg/master/test/test-data/example_2000.dwg",
  );
  const storage = new S3ObjectStorage();
  for (const tender of [owner, publicTender]) {
    if (tender.id === publicTender.id && tender.title === "with map") {
      await database.tender.update({
        where: { id: tender.id },
        data: {
          fullDescription:
            "Complete renovation of an apartment in Tbilisi, including demolition, electrical and plumbing work, wall preparation, flooring and final finishing. Please include labour and installation in your offer.",
          shortDescription:
            "Complete apartment renovation in Tbilisi, including demolition, electrical and plumbing work, flooring and finishing.",
          scopeOfWork:
            "Demolition, electrical and plumbing work, wall preparation, flooring and finishing.",
          workerNotes: "Crew of 4–6; licensed electrician",
          materialNotes: "Client supplies tiles and sanitary ware.",
        },
      });
    }
    await database.tender.update({
      where: { id: tender.id },
      data: {
        ...(Array.isArray(tender.workItems) && tender.workItems.length
          ? {}
          : { workItems: items }),
        ...(tender.areaSquareMeters === null ? { areaSquareMeters: 96 } : {}),
        ...(tender.reference === null
          ? {
              reference:
                tender.id === owner.id ? "TN-2026-0147" : "TN-2026-0148",
            }
          : {}),
        ...(tender.title === "with map"
          ? { title: "Apartment renovation in Tbilisi" }
          : {}),
      },
    });
    const media = [
      ...photos.map((body, index) => ({
        body,
        name: `Renovation example ${index + 1}.jpg`,
      })),
      {
        body: samplePdf(
          tender.title === "with map"
            ? "Apartment renovation in Tbilisi"
            : tender.title,
        ),
        name: "Project brief.pdf",
      },
      { body: dwg, name: "Floor plan.dwg" },
    ];
    for (const [index, file] of media.entries()) {
      const id = `${tender.id}-redesign-sample-${index}`;
      if (
        await database.tenderAttachment.findUnique({
          where: { id },
          select: { id: true },
        })
      )
        continue;
      const existing = await database.tenderAttachment.findMany({
        where: { tenderId: tender.id },
        select: { mimeType: true },
      });
      const photoCount = existing.filter(
        (entry) =>
          entry.mimeType.startsWith("image/") &&
          entry.mimeType !== "image/vnd.dwg",
      ).length;
      if (index < 4 && photoCount >= 4) continue;
      if (
        index === 4 &&
        existing.some((entry) => entry.mimeType === "application/pdf")
      )
        continue;
      if (
        index === 5 &&
        existing.some((entry) => entry.mimeType === "image/vnd.dwg")
      )
        continue;
      const count = await database.tenderAttachment.count({
        where: { tenderId: tender.id },
      });
      if (count >= 10)
        throw new Error(
          "Tender attachment limit reached; existing files were preserved.",
        );
      const mimeType = sniffAttachmentMimeType(file.body);
      if (!mimeType) throw new Error(`Unsupported example file: ${file.name}`);
      const objectKey = `tenders/${tender.id}/examples/${index}`;
      const stored = await storage.putObject({
        objectKey,
        body: file.body,
        contentType: mimeType,
      });
      if (!stored.ok) throw new Error("Example file too large");
      await database.tenderAttachment.create({
        data: {
          id,
          tenderId: tender.id,
          objectKey,
          originalFileName: file.name,
          mimeType,
          sizeBytes: file.body.length,
        },
      });
    }
    console.log(
      JSON.stringify({
        id: tender.id,
        budgetMinorUnits: tender.budgetMinorUnits,
        deadline: tender.deadline,
        attachmentCount: await database.tenderAttachment.count({
          where: { tenderId: tender.id },
        }),
      }),
    );
  }
}
try {
  await main();
} finally {
  await database.$disconnect();
}
