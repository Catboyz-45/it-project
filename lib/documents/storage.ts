/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: ดูแลขั้นตอนสร้างหรือจัดรูปแบบเอกสารในหัวข้อ “storage”
 * การทำงาน: รับข้อมูลที่ผ่านการตรวจแล้ว สร้างผลลัพธ์เอกสารอย่างสม่ำเสมอ และส่งต่อให้ storage โดยไม่เปิดเผยตำแหน่งไฟล์จริงแก่ผู้ใช้
 */

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getServerEnv } from "@/lib/server/env";
import type { StoredFile } from "@/lib/documents/types";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: interface “Storage Adapter” ระบุว่าข้อมูลต้องมีฟิลด์อะไร เพื่อให้หลายส่วนส่งข้อมูลตรงรูปแบบกัน
 */
export interface StorageAdapter {
  get(key: string): Promise<StoredFile>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “safe Storage Key” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function safeStorageKey(key: string) {
  if (!/^[a-z0-9][a-z0-9/_.-]*\.(pdf|png|jpe?g|webp)$/i.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  return key;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คลาส “Local Storage Adapter” รวมข้อมูลและพฤติกรรมที่ต้องทำงานร่วมกันเป็นออบเจ็กต์เดียว
 */
class LocalStorageAdapter implements StorageAdapter {
  private readonly root: string;

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เตรียมค่าเริ่มต้นเมื่อสร้างออบเจ็กต์ storage
   * รับค่า:
   * - root: ค่า “root” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: ไม่มีค่าคืน; ผลคือออบเจ็กต์หรือสถานะภายในได้รับการตั้งค่า
   */
  constructor(root: string) {
    this.root = path.isAbsolute(root)
      ? path.normalize(root)
      : path.resolve(/* turbopackIgnore: true */ process.cwd(), root);
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “resolve” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  private resolve(key: string) {
    const resolved = path.resolve(this.root, safeStorageKey(key));
    if (!resolved.startsWith(`${this.root}${path.sep}`)) throw new Error("Invalid storage path");
    return resolved;
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “put” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - body: ค่า “body” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async put(key: string, body: Buffer) {
    const filePath = this.resolve(key);
    await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    await writeFile(filePath, body, { mode: 0o600 });
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลชนิด Promise<StoredFile> ตามสัญญา TypeScript ของฟังก์ชัน
   */
  async get(key: string): Promise<StoredFile> {
    const body = await readFile(this.resolve(key));
    const extension = path.extname(key).toLowerCase();
    const contentType = extension === ".png" ? "image/png"
      : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg"
      : extension === ".webp" ? "image/webp" : "application/pdf";
    return { body, contentType, size: body.byteLength };
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “delete” ตามกฎของระบบ
   * รับค่า:
   * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async delete(key: string) {
    try {
      await unlink(this.resolve(key));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คลาส “S3 Storage Adapter” รวมข้อมูลและพฤติกรรมที่ต้องทำงานร่วมกันเป็นออบเจ็กต์เดียว
 */
class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เตรียมค่าเริ่มต้นเมื่อสร้างออบเจ็กต์ storage
   * รับค่า:
   * - bucket: ค่า “bucket” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - region: ค่า “region” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: ไม่มีค่าคืน; ผลคือออบเจ็กต์หรือสถานะภายในได้รับการตั้งค่า
   */
  constructor(private readonly bucket: string, region: string) {
    this.client = new S3Client({ region });
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “put” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - body: ค่า “body” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - contentType: ค่า “content Type” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: safeStorageKey(key), Body: body, ContentType: contentType, ServerSideEncryption: "AES256" }));
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลชนิด Promise<StoredFile> ตามสัญญา TypeScript ของฟังก์ชัน
   */
  async get(key: string): Promise<StoredFile> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: safeStorageKey(key) }));
    if (!response.Body) throw new Error("Stored document is empty");
    const bytes = await response.Body.transformToByteArray();
    const body = Buffer.from(bytes);
    return { body, contentType: response.ContentType ?? "application/pdf", size: body.byteLength };
  }

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “delete” ตามกฎของระบบ
   * รับค่า:
   * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeStorageKey(key) }));
  }
}

let storageAdapter: StorageAdapter | undefined;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Storage Adapter” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function getStorageAdapter() {
  if (storageAdapter) return storageAdapter;
  const env = getServerEnv();
  storageAdapter = env.STORAGE_TYPE === "s3"
    ? new S3StorageAdapter(env.AWS_S3_BUCKET!, env.AWS_REGION!)
    : new LocalStorageAdapter(env.LOCAL_STORAGE_PATH);
  return storageAdapter;
}
