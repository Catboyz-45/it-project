// ชนิดเอกสารที่ระบบสร้างได้ as const ทำให้ TypeScript รู้ว่ามีแค่สองค่านี้
export const documentKinds = ["contract", "invoice"] as const;
export type DocumentKind = (typeof documentKinds)[number];

// Template ที่ส่งไปให้ฝั่งเบราว์เซอร์ version ใช้กันแก้ทับกันตอนสองคนแก้พร้อมกัน
export interface DocumentTemplateDto {
  html: string;
  kind: DocumentKind;
  name: string;
  updatedAt: string;
  version: number;
}

// ไฟล์ที่อ่านมาจากที่เก็บ แนบ contentType มาด้วยเพื่อให้ตอบกลับได้ถูกชนิด
export interface StoredFile {
  body: Buffer;
  contentType: string;
  size: number;
}
