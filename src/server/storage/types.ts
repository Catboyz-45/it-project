/**
 * หน้าที่ของไฟล์นี้: ตัวเชื่อม object storage types ซ่อนรายละเอียด S3 และจำกัดการเข้าถึงไฟล์ด้วย URL ชั่วคราว
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
export interface ObjectStorage {
  checkHealth(): Promise<void>;
  signPut(key: string, contentType: string, contentLength: number, expiresIn: number): Promise<string>;
  signGet(key: string, expiresIn: number, downloadName?: string): Promise<string>;
  head(key: string): Promise<{ size: number; contentType?: string }>;
  get(key: string): Promise<Uint8Array>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
}
