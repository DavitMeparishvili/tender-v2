import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerEnv } from "../../../config/env";
import type { Result } from "../../shared";
import { MAX_ATTACHMENT_BYTES } from "../domain/constraints";
import type { AllowedAttachmentMimeType } from "../domain/constraints";
import type {
  DirectUploadObjectStorage,
  ObjectStorage,
  StoredObject,
} from "../ports/object-storage";

const {
  STORAGE_ACCESS_KEY_ID,
  STORAGE_BUCKET,
  STORAGE_ENDPOINT,
  STORAGE_FORCE_PATH_STYLE,
  STORAGE_PUBLIC_ENDPOINT,
  STORAGE_REGION,
  STORAGE_SECRET_ACCESS_KEY,
} = getServerEnv();

export class S3ObjectStorage
  implements ObjectStorage, DirectUploadObjectStorage
{
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
  // A presigned URL contains its host in the signature. Use the public HTTPS
  // endpoint for URLs sent to the browser, while ordinary server operations
  // can stay on Docker's private network.
  private readonly signingClient = new S3Client({
    endpoint: STORAGE_PUBLIC_ENDPOINT ?? STORAGE_ENDPOINT,
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
      this.signingClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      { expiresIn: expiresInSeconds },
    );
  }

  getSignedUploadUrl(
    objectKey: string,
    contentType: AllowedAttachmentMimeType,
    expiresInSeconds: number,
  ): Promise<string> {
    return getSignedUrl(
      this.signingClient,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: contentType,
        IfNoneMatch: "*",
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async inspectObject(objectKey: string) {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      const prefixResponse = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Range: "bytes=0-63",
        }),
      );
      const prefix =
        prefixResponse.Body === undefined
          ? new Uint8Array()
          : await prefixResponse.Body.transformToByteArray();
      return {
        sizeBytes: head.ContentLength ?? 0,
        contentType: head.ContentType,
        prefix,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "NotFound" || error.name === "NoSuchKey")
      ) {
        return null;
      }
      throw error;
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
  }
}

export const s3ObjectStorage = new S3ObjectStorage();
