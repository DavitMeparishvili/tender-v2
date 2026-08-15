import type { AllowedAttachmentMimeType } from "./constraints";

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // RIFF
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]; // WEBP
const WEBP_SIGNATURE_OFFSET = 8;

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function hasSignatureAt(
  bytes: Uint8Array,
  offset: number,
  signature: readonly number[],
): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

// The declared MIME type and file name of an upload are attacker-controlled, so
// the stored content type is derived from the payload's own magic bytes only.
export function sniffAttachmentMimeType(
  bytes: Uint8Array,
): AllowedAttachmentMimeType | null {
  if (startsWith(bytes, PDF_SIGNATURE)) {
    return "application/pdf";
  }
  if (startsWith(bytes, JPEG_SIGNATURE)) {
    return "image/jpeg";
  }
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return "image/png";
  }
  if (
    startsWith(bytes, RIFF_SIGNATURE) &&
    hasSignatureAt(bytes, WEBP_SIGNATURE_OFFSET, WEBP_SIGNATURE)
  ) {
    return "image/webp";
  }
  return null;
}
