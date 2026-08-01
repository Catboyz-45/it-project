import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerEnv } from "@/server/config/env";
import type { ObjectStorage } from "./types";

async function bytes(body: Awaited<ReturnType<S3Client["send"]>> | unknown): Promise<Uint8Array> {
  const stream = (body as { Body?: { transformToByteArray?: () => Promise<Uint8Array> } }).Body;
  if (!stream?.transformToByteArray) throw new Error("STORAGE_BODY_UNAVAILABLE");
  return stream.transformToByteArray();
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor() {
    const env = getServerEnv();
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) throw new Error("OBJECT_STORAGE_NOT_CONFIGURED");
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
      maxAttempts: 3,
    });
  }

  signPut(key: string, contentType: string, contentLength: number, expiresIn: number) { return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: contentLength }), { expiresIn }); }
  signGet(key: string, expiresIn: number, downloadName?: string) { return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key, ...(downloadName ? { ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` } : {}) }), { expiresIn }); }
  async head(key: string) { const value = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })); return { size: value.ContentLength ?? 0, contentType: value.ContentType }; }
  async get(key: string) { return bytes(await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))); }
  async put(key: string, body: Uint8Array, contentType: string) { await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "private, max-age=31536000, immutable" })); }
  async deleteMany(keys: string[]) { if (!keys.length) return; await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys.map(Key => ({ Key })), Quiet: true } })); }
}

let instance: ObjectStorage | undefined;
export function storage(): ObjectStorage { return instance ??= new S3ObjectStorage(); }
