import type { DocumentKind } from "@/lib/documents/types";
import { getDatabase } from "@/lib/server/db";

// ฐานข้อมูลใช้ตัวพิมพ์ใหญ่ ส่วนโค้ดฝั่งแอปใช้ตัวพิมพ์เล็ก แปลงกันที่นี่ที่เดียว
const databaseKinds = { contract: "CONTRACT", invoice: "INVOICE" } as const;

export function toDatabaseKind(kind: DocumentKind) {
  return databaseKinds[kind];
}

// หอหนึ่งมี Template ได้ชนิดละหนึ่งอัน จึงค้นด้วยคู่ของหอกับชนิด
export async function getTemplate(propertyId: string, kind: DocumentKind) {
  return getDatabase().documentTemplate.findUnique({ where: { propertyId_kind: { propertyId, kind: toDatabaseKind(kind) } } });
}

// upsert เพราะหอที่ยังไม่เคยแก้จะยังไม่มีแถวของตัวเอง ใช้ของกลางอยู่
export async function saveTemplate(propertyId: string, kind: DocumentKind, name: string, html: string) {
  return getDatabase().documentTemplate.upsert({
    where: { propertyId_kind: { propertyId, kind: toDatabaseKind(kind) } },
    create: { propertyId, kind: toDatabaseKind(kind), name, html },
    // เพิ่ม version ทุกครั้งที่บันทึก ใช้กันแก้ทับกันตอนสองคนแก้พร้อมกัน
    update: { name, html, version: { increment: 1 } },
  });
}
