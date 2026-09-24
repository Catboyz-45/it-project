import { afterEach, describe, expect, it, vi } from "vitest";

// สร้าง client จริงไม่ได้ในเทสต์ จึงดักดูค่าที่ถูกส่งเข้าไปตอนสร้างและตอนสั่งอัปโหลดแทน
const clientConfigs: unknown[] = [];
const putInputs: Record<string, unknown>[] = [];

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor(config: unknown) {
      clientConfigs.push(config);
    }
    send = vi.fn(async () => ({}));
  },
  PutObjectCommand: class {
    constructor(input: Record<string, unknown>) {
      putInputs.push(input);
    }
  },
  GetObjectCommand: class {},
  DeleteObjectCommand: class {},
}));

async function adapterWith(env: Record<string, string>) {
  vi.resetModules();
  clientConfigs.length = 0;
  putInputs.length = 0;
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const { getStorageAdapter } = await import("@/lib/documents/storage");
  return getStorageAdapter();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const s3Env = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/app",
  STORAGE_TYPE: "s3",
  AWS_REGION: "auto",
  AWS_S3_BUCKET: "nestly-files",
};

describe("storage adapter selection", () => {
  // AWS หา endpoint จาก region ให้เอง การระบุเองจะไปทับค่าที่ถูกต้อง
  it("lets the SDK resolve the endpoint when none is configured", async () => {
    await adapterWith(s3Env);
    expect(clientConfigs[0]).toEqual({ region: "auto" });
  });

  // ผู้ให้บริการที่พูดภาษาเดียวกับ S3 อย่าง Cloudflare R2 ต้องบอก endpoint เอง
  // และต้องใช้ path style เพราะไม่รองรับชื่อถังที่อยู่หน้าโดเมน
  it("passes a custom endpoint through with path style addressing", async () => {
    await adapterWith({ ...s3Env, AWS_S3_ENDPOINT: "https://acc.r2.cloudflarestorage.com" });
    expect(clientConfigs[0]).toEqual({
      region: "auto",
      endpoint: "https://acc.r2.cloudflarestorage.com",
      forcePathStyle: true,
    });
  });

  it("asks AWS to encrypt at rest", async () => {
    const adapter = await adapterWith(s3Env);
    await adapter.put("documents/a.pdf", Buffer.from("x"), "application/pdf");
    expect(putInputs[0]).toMatchObject({ Bucket: "nestly-files", ServerSideEncryption: "AES256" });
  });

  // R2 เข้ารหัสให้เองอยู่แล้วและปฏิเสธ header นี้ ส่งไปจะอัปโหลดไม่ผ่าน
  it("omits the encryption header for a non-AWS endpoint", async () => {
    const adapter = await adapterWith({ ...s3Env, AWS_S3_ENDPOINT: "https://acc.r2.cloudflarestorage.com" });
    await adapter.put("documents/a.pdf", Buffer.from("x"), "application/pdf");
    expect(putInputs[0]).not.toHaveProperty("ServerSideEncryption");
  });

  // คีย์มาจากชื่อไฟล์ที่ระบบสร้างเอง แต่กันไว้อีกชั้นเผื่อมีทางไหนหลุดมา
  it("refuses a key that climbs out of its folder", async () => {
    const adapter = await adapterWith(s3Env);
    await expect(adapter.put("../../etc/passwd.pdf", Buffer.from("x"), "application/pdf")).rejects.toThrow();
    await expect(adapter.put("documents/shell.php", Buffer.from("x"), "application/pdf")).rejects.toThrow();
  });
});
