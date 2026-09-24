import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getServerEnv } from "@/lib/server/env";
import type { StoredFile } from "@/lib/documents/types";

// หน้าตาเดียวกันทั้งเก็บในเครื่องและเก็บบน S3 ที่เรียกใช้จึงไม่ต้องรู้ว่าไฟล์อยู่ที่ไหนจริง ๆ
export interface StorageAdapter {
  get(key: string): Promise<StoredFile>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

// นามสกุลที่ safeStorageKey ยอมให้ผ่าน มีแค่ไม่กี่แบบ ที่ไม่อยู่ในตารางคือ PDF
const contentTypeByExtension: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// ป้องกัน path traversal ใช้วิธีระบุรูปแบบที่อนุญาต ไม่ใช่ไล่ห้ามทีละแบบ
// ต้องขึ้นต้นด้วยตัวอักษรหรือตัวเลข มีได้เฉพาะอักขระที่กำหนด และลงท้ายด้วยนามสกุลที่รู้จัก
// เช็ค ".." ซ้ำอีกชั้น กันการไต่ออกไปนอกโฟลเดอร์ที่ตั้งใจ
function safeStorageKey(key: string) {
  if (!/^[a-z0-9][a-z0-9/_.-]*\.(pdf|png|jpe?g|webp)$/i.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  return key;
}

// เก็บไฟล์ลงดิสก์ ใช้ตอน dev และตอนรันด้วย Docker Compose ที่ไม่ได้ต่อ S3
class LocalStorageAdapter implements StorageAdapter {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.isAbsolute(root)
      ? path.normalize(root)
      : path.resolve(/* turbopackIgnore: true */ process.cwd(), root);
  }

  // ตรวจสองชั้น รูปแบบของ key ก่อน แล้วเช็คว่าเส้นทางจริงที่ได้ยังอยู่ในโฟลเดอร์ที่ตั้งใจ
  // ชั้นหลังคือกันพลาด เผื่อรูปแบบข้างบนมีช่องที่คิดไม่ถึง
  private resolve(key: string) {
    const resolved = path.resolve(this.root, safeStorageKey(key));
    if (!resolved.startsWith(`${this.root}${path.sep}`)) throw new Error("Invalid storage path");
    return resolved;
  }

  async put(key: string, body: Buffer) {
    const filePath = this.resolve(key);
    // 0700 กับ 0600 คือให้เฉพาะเจ้าของเข้าถึงได้ ผู้ใช้อื่นบนเครื่องเดียวกันอ่านไม่ได้
    // ไฟล์พวกนี้เป็นสัญญาและสลิปโอนเงิน ไม่ควรให้ใครก็อ่านได้
    await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    await writeFile(filePath, body, { mode: 0o600 });
  }

  async get(key: string): Promise<StoredFile> {
    const body = await readFile(this.resolve(key));
    // เดาชนิดไฟล์จากนามสกุล ซึ่ง safeStorageKey จำกัดไว้แล้วว่ามีได้แค่ไม่กี่แบบ
    const extension = path.extname(key).toLowerCase();
    const contentType = contentTypeByExtension[extension] ?? "application/pdf";
    return { body, contentType, size: body.byteLength };
  }

  async delete(key: string) {
    try {
      await unlink(this.resolve(key));
    } catch (error) {
      // ไฟล์ไม่มีอยู่แล้วก็ถือว่าลบสำเร็จ งานลบไฟล์เก่าจะได้รันซ้ำได้โดยไม่พัง
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
}

// เก็บไฟล์บน S3 ใช้ตอน production ที่มีหลายเครื่องและต้องเห็นไฟล์ชุดเดียวกัน
class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;

  constructor(private readonly bucket: string, region: string) {
    this.client = new S3Client({ region });
  }

  // ServerSideEncryption เข้ารหัสตอนเก็บ ดิสก์ของผู้ให้บริการหลุดก็ยังอ่านไฟล์ไม่ได้
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: safeStorageKey(key), Body: body, ContentType: contentType, ServerSideEncryption: "AES256" }));
  }

  async get(key: string): Promise<StoredFile> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: safeStorageKey(key) }));
    // S3 ตอบมาโดยไม่มีเนื้อไฟล์ได้ในบางกรณี ต้องดักไว้ก่อนเอาไปใช้ต่อ
    if (!response.Body) throw new Error("Stored document is empty");
    const bytes = await response.Body.transformToByteArray();
    const body = Buffer.from(bytes);
    return { body, contentType: response.ContentType ?? "application/pdf", size: body.byteLength };
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeStorageKey(key) }));
  }
}

// สร้างครั้งเดียวแล้วใช้ซ้ำ เพราะ S3Client เปิดการเชื่อมต่อไว้ข้างใน
let storageAdapter: StorageAdapter | undefined;

// เลือกที่เก็บจากการตั้งค่า โค้ดส่วนอื่นเรียกตัวนี้อย่างเดียว ไม่ต้องรู้ว่าใช้แบบไหนอยู่
export function getStorageAdapter() {
  if (storageAdapter) return storageAdapter;
  const env = getServerEnv();
  storageAdapter = env.STORAGE_TYPE === "s3"
    // ใช้ ! ได้เพราะ getServerEnv ตรวจไว้แล้วว่าเลือก s3 ต้องมีสองค่านี้ครบ
    ? new S3StorageAdapter(env.AWS_S3_BUCKET!, env.AWS_REGION!)
    : new LocalStorageAdapter(env.LOCAL_STORAGE_PATH);
  return storageAdapter;
}
