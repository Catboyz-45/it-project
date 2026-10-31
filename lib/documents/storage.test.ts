import { afterEach, describe, expect, it, vi } from "vitest";

// สร้าง client จริงไม่ได้ในเทสต์ จึงดักดูค่าที่ถูกส่งเข้าไปตอนสร้างและตอนสั่งอัปโหลดแทน
const clientConfigs: unknown[] = [];
const putInputs: Record<string, unknown>[] = [];
// คำตอบที่ S3 ปลอมจะส่งกลับในคำสั่งถัดไป แต่ละเทสต์ตั้งเองได้
let nextSendResult: unknown = {};

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor(config: unknown) {
      clientConfigs.push(config);
    }
    send = vi.fn(async () => nextSendResult);
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
  nextSendResult = {};
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

  // header นี้เป็นของ AWS โดยเฉพาะ ผู้ให้บริการอื่นเข้ารหัสให้เองและไม่รับประกันว่าจะรับ
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

describe("S3 storage reads and deletes", () => {
  it("returns the stored bytes with their content type", async () => {
    const adapter = await adapterWith(s3Env);
    nextSendResult = { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) }, ContentType: "image/png" };
    await expect(adapter.get("slips/a.png")).resolves.toMatchObject({ contentType: "image/png", size: 3 });
  });

  // ไม่มีชนิดไฟล์ติดมาก็ถือเป็น PDF ซึ่งเป็นชนิดหลักที่ระบบเก็บ
  it("defaults the content type to PDF", async () => {
    const adapter = await adapterWith(s3Env);
    nextSendResult = { Body: { transformToByteArray: async () => new Uint8Array([1]) } };
    await expect(adapter.get("documents/a.pdf")).resolves.toMatchObject({ contentType: "application/pdf" });
  });

  it("refuses an object that came back without a body", async () => {
    const adapter = await adapterWith(s3Env);
    nextSendResult = {};
    await expect(adapter.get("documents/a.pdf")).rejects.toThrow("Stored document is empty");
  });

  it("deletes by a checked key only", async () => {
    const adapter = await adapterWith(s3Env);
    await expect(adapter.delete("documents/a.pdf")).resolves.toBeUndefined();
    await expect(adapter.delete("../secret.pdf")).rejects.toThrow();
  });
});

describe("local storage", () => {
  async function localAdapter() {
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const root = await mkdtemp(path.join(tmpdir(), "nestly-storage-"));
    return { root, adapter: await adapterWith({ DATABASE_URL: s3Env.DATABASE_URL, STORAGE_TYPE: "local", LOCAL_STORAGE_PATH: root }) };
  }

  it("round-trips a file and reads its type from the extension", async () => {
    const { adapter } = await localAdapter();
    await adapter.put("slips/2026/a.png", Buffer.from([137, 80]), "image/png");
    await expect(adapter.get("slips/2026/a.png")).resolves.toMatchObject({ contentType: "image/png", size: 2 });
    await adapter.put("documents/a.pdf", Buffer.from("%PDF"), "application/pdf");
    await expect(adapter.get("documents/a.pdf")).resolves.toMatchObject({ contentType: "application/pdf" });
  });

  // ลบไฟล์ที่ไม่มีอยู่แล้วต้องไม่พัง งานลบไฟล์เก่าจะได้รันซ้ำได้
  it("treats deleting a missing file as done", async () => {
    const { adapter } = await localAdapter();
    await expect(adapter.delete("documents/missing.pdf")).resolves.toBeUndefined();
  });

  // ข้อผิดพลาดอื่นที่ไม่ใช่ไม่พบไฟล์ต้องโยนต่อ ไม่ใช่กลืนเงียบ
  it("surfaces other delete failures", async () => {
    const { root, adapter } = await localAdapter();
    const { mkdir } = await import("node:fs/promises");
    const path = await import("node:path");
    await mkdir(path.join(root, "documents", "folder.pdf"), { recursive: true });
    await expect(adapter.delete("documents/folder.pdf")).rejects.toThrow();
  });
});
