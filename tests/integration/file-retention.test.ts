import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "@/lib/documents/storage";
import { ensureTenantConversation } from "@/lib/server/chat";
import { getDatabase } from "@/lib/server/db";
import { enforceFileRetention } from "@/lib/server/file-retention";
import { createLease } from "@/lib/server/leases";
import { createWorkspaceFixture } from "./helpers";

// งานลบไฟล์ที่เก็บครบกำหนดแล้ว ต้องลบเฉพาะไฟล์ที่พ้นกำหนดจริง
// ต้องเก็บแถวข้อมูลธุรกิจไว้ และถ้าลบไฟล์ไม่สำเร็จต้องนับเป็นความล้มเหลวโดยไม่แตะแถวนั้น
// ใช้ที่เก็บไฟล์ปลอมที่จดว่าถูกสั่งลบอะไรบ้าง ไฟล์ที่ชื่อมีคำว่า fail จะลบไม่สำเร็จ

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;
const longAgo = new Date("2010-01-01T00:00:00Z");
const deleted: string[] = [];
const storage: StorageAdapter = {
  put: vi.fn(async () => undefined),
  get: vi.fn(async () => ({ body: Buffer.alloc(0), contentType: "application/pdf", size: 0 })),
  delete: vi.fn(async (key: string) => {
    if (key.includes("fail")) throw new Error("storage unavailable");
    deleted.push(key);
  }),
};
const policy = { slipDays: 30, documentDays: 30, chatAttachmentDays: 30, batchSize: 1000 };
const keyOf = (label: string) => `retention-${label}-${randomUUID()}.pdf`;
const keys = { document: keyOf("doc"), failingDocument: keyOf("fail-doc"), signed: keyOf("signed"), chat: keyOf("chat"), recentChat: keyOf("recent") };
let documentId = "";
let failingDocumentId = "";
let leaseId = "";

beforeAll(async () => {
  w = await createWorkspaceFixture("RETENTION");
  const template = await getDatabase().documentTemplate.create({
    data: { propertyId: w.property.id, kind: "INVOICE", name: "บิล", html: "<p>{{room_number}}</p>" },
    select: { id: true },
  });
  const documentBase = { propertyId: w.property.id, kind: "INVOICE" as const, checksum: "0".repeat(64), sizeBytes: 10, metadata: {}, templateId: template.id, createdAt: longAgo };
  documentId = (await getDatabase().generatedDocument.create({ data: { ...documentBase, referenceId: "OLD-1", storageKey: keys.document }, select: { id: true } })).id;
  failingDocumentId = (await getDatabase().generatedDocument.create({ data: { ...documentBase, referenceId: "OLD-2", storageKey: keys.failingDocument }, select: { id: true } })).id;

  // สัญญาที่จบไปนานแล้ว ไฟล์ฉบับลงนามถึงเวลาลบ
  const lease = await createLease(w.property.id, w.owner.id, {
    roomId: w.room.id, startDate: new Date("2009-01-01"), endDate: new Date("2009-12-31"), monthlyRent: 3000, depositAmount: 0,
  });
  leaseId = lease.id;
  await getDatabase().lease.update({ where: { id: leaseId }, data: { status: "EXPIRED", endedAt: longAgo, signedStorageKey: keys.signed } });
  await getDatabase().leaseVersion.updateMany({ where: { leaseId }, data: { signedStorageKey: keys.signed } });

  const conversation = await ensureTenantConversation({
    propertyId: w.property.id, tenantProfileId: w.tenantProfileId, tenantName: "Retention Tenant", roomNumber: w.room.number,
  });
  const messageBase = { propertyId: w.property.id, conversationId: conversation.id, senderRole: "TENANT" as const, body: "ไฟล์แนบ", attachmentMime: "application/pdf", attachmentName: "a.pdf", attachmentSize: 10 };
  await getDatabase().chatMessage.create({ data: { ...messageBase, clientId: randomUUID(), attachmentKey: keys.chat, createdAt: longAgo } });
  // ไฟล์แนบที่เพิ่งส่ง ยังไม่ถึงกำหนดลบ
  await getDatabase().chatMessage.create({ data: { ...messageBase, clientId: randomUUID(), attachmentKey: keys.recentChat } });
}, 60_000);

afterAll(async () => {
  if (!w) return;
  await getDatabase().generatedDocument.deleteMany({ where: { propertyId: w.property.id } });
  await getDatabase().documentTemplate.deleteMany({ where: { propertyId: w.property.id } });
  await w.cleanup();
  await getDatabase().$disconnect();
});

describe("file retention", () => {
  it("purges expired files, keeps the records, and leaves recent files alone", async () => {
    const result = await enforceFileRetention(new Date(), policy, storage);

    expect(deleted).toEqual(expect.arrayContaining([keys.document, keys.signed, keys.chat]));
    expect(deleted).not.toContain(keys.recentChat);
    expect(result.generatedDocumentsPurged).toBeGreaterThanOrEqual(1);
    expect(result.signedDocumentsPurged).toBeGreaterThanOrEqual(1);
    expect(result.chatAttachmentsPurged).toBeGreaterThanOrEqual(1);

    // แถวของเอกสารยังอยู่ แค่ไม่มีไฟล์แล้ว พร้อมเวลาที่ลบ
    const document = await getDatabase().generatedDocument.findUniqueOrThrow({ where: { id: documentId }, select: { storageKey: true, filePurgedAt: true } });
    expect(document.storageKey).toBeNull();
    expect(document.filePurgedAt).not.toBeNull();
    const lease = await getDatabase().lease.findUniqueOrThrow({ where: { id: leaseId }, select: { signedStorageKey: true, signedDocumentPurgedAt: true } });
    expect(lease).toMatchObject({ signedStorageKey: null });
    expect(lease.signedDocumentPurgedAt).not.toBeNull();
  });

  // ลบไฟล์ไม่สำเร็จต้องไม่ทำเหมือนลบแล้ว รอบหน้าจะได้ลองใหม่
  it("counts a failed delete and keeps the file reference for the next run", async () => {
    const result = await enforceFileRetention(new Date(), policy, storage);
    expect(result.failedFiles).toBeGreaterThanOrEqual(1);
    const failing = await getDatabase().generatedDocument.findUniqueOrThrow({ where: { id: failingDocumentId }, select: { storageKey: true, filePurgedAt: true } });
    expect(failing).toEqual({ storageKey: keys.failingDocument, filePurgedAt: null });
  });
});
