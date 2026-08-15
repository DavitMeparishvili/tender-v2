import { describe, expect, it } from "vitest";
import { sniffAttachmentMimeType } from "./mime-sniff";

describe("sniffAttachmentMimeType", () => {
  it("detects a PDF by its magic bytes", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\n...");
    expect(sniffAttachmentMimeType(bytes)).toBe("application/pdf");
  });

  it("detects a JPEG by its magic bytes", () => {
    expect(
      sniffAttachmentMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])),
    ).toBe("image/jpeg");
  });

  it("detects a PNG by its magic bytes", () => {
    expect(
      sniffAttachmentMimeType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
  });

  it("reports the true type of a payload whose name or declared type claims PDF", () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0]);
    expect(sniffAttachmentMimeType(jpegBytes)).toBe("image/jpeg");
  });

  it("returns null for a text payload named like a PDF", () => {
    expect(
      sniffAttachmentMimeType(new TextEncoder().encode("not really a pdf")),
    ).toBeNull();
  });

  it("returns null for unrecognized bytes", () => {
    expect(sniffAttachmentMimeType(new Uint8Array([0, 1, 2, 3]))).toBeNull();
  });
});
