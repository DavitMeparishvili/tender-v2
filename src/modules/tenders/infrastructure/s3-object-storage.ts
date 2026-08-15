import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerEnv } from "../../../config/env";
import type { Result } from "../../shared";
import { MAX_ATTACHMENT_BYTES } from "../domain/constraints";
import type { AllowedAttachmentMimeType } from "../domain/constraints";
import type { ObjectStorage, StoredObject } from "../ports/object-storage";

const {
  STORAGE_ACCESS_KEY_ID,
  STORAGE_BUCKET,
  STORAGE_ENDPOINT,
  STORAGE_FORCE_PATH_STYLE,
  STORAGE_REGION,
  STORAGE_SECRET_ACCESS_KEY,
} = getServerEnv();

export class S3ObjectStorage implements ObjectStorage {
  private readonly bucket = STORAGE_BUCKET;
  // MinIO and other S3-compatible servers are addressed by path
  // (`/bucket/key`) rather than by virtual host, which is why path-style
  // addressing is configurable and defaults on.
  private readonly client = new S3Client({
    endpoint: STORAGE_ENDPOINT,
    region: STORAGE_REGION,
    forcePathStyle: STORAGE_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY_ID,
      secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
    },
  });

  async putObject(input: {
    objectKey: string;
    body: Uint8Array;
    contentType: AllowedAttachmentMimeType;
  }): Promise<Result<StoredObject, "OBJECT_TOO_LARGE">> {
    // Checked before the request so an oversized payload is never streamed to
    // the bucket only to be rejected — or silently accepted — by the provider.
    if (input.body.byteLength > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: "OBJECT_TOO_LARGE" };
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.body.byteLength,
      }),
    );

    return {
      ok: true,
      value: { objectKey: input.objectKey, sizeBytes: input.body.byteLength },
    };
  }

  getSignedDownloadUrl(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      { expiresIn: expiresInSeconds },
    );
  }
}

export const s3ObjectStorage = new S3ObjectStorage();
