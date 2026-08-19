import type { Result } from "@/src/modules/shared";
import type { AllowedAttachmentMimeType } from "../domain/constraints";

export type StoredObject = Readonly<{ objectKey: string; sizeBytes: number }>;

export interface ObjectStorage {
  putObject(input: {
    objectKey: string;
    body: Uint8Array;
    contentType: AllowedAttachmentMimeType;
  }): Promise<Result<StoredObject, "OBJECT_TOO_LARGE">>;
  getSignedDownloadUrl(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<string>;
}

export type InspectedObject = Readonly<{
  sizeBytes: number;
  contentType: string | undefined;
  prefix: Uint8Array;
}>;

export interface DirectUploadObjectStorage {
  getSignedUploadUrl(
    objectKey: string,
    contentType: AllowedAttachmentMimeType,
    expiresInSeconds: number,
  ): Promise<string>;
  inspectObject(objectKey: string): Promise<InspectedObject | null>;
  deleteObject(objectKey: string): Promise<void>;
}
