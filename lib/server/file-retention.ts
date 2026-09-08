/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “file retention” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { getStorageAdapter, type StorageAdapter } from "@/lib/documents/storage";
import { getDatabase } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";

const DAY_MS = 86_400_000;
const ACTIVE_LEASE_STATUSES = ["DRAFT", "PENDING_SIGNATURE", "ACTIVE", "EXPIRING"] as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Retention Policy” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type RetentionPolicy = {
  slipDays: number;
  documentDays: number;
  chatAttachmentDays: number;
  batchSize: number;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “File Retention Result” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type FileRetentionResult = {
  paymentSlipsPurged: number;
  generatedDocumentsPurged: number;
  signedDocumentsPurged: number;
  chatAttachmentsPurged: number;
  failedFiles: number;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “retention Cutoff” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - runAt: ค่า “run At” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - days: ค่า “days” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function retentionCutoff(runAt: Date, days: number) {
  return new Date(runAt.getTime() - days * DAY_MS);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Retention Policy” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลชนิด RetentionPolicy ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function getRetentionPolicy(): RetentionPolicy {
  const env = getServerEnv();
  return {
    slipDays: env.SLIP_RETENTION_DAYS,
    documentDays: env.DOCUMENT_RETENTION_DAYS,
    chatAttachmentDays: env.CHAT_ATTACHMENT_RETENTION_DAYS,
    batchSize: env.RETENTION_BATCH_SIZE,
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “delete File” ตามกฎของระบบ
 * รับค่า:
 * - storage: ค่า “storage” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - key: ค่า “key” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function deleteFile(storage: StorageAdapter, key: string) {
  try {
    await storage.delete(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “enforce File Retention” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - runAt: ค่า “run At” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - policy: ค่า “policy” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - storage: ค่า “storage” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<FileRetentionResult> ตามสัญญา TypeScript ของฟังก์ชัน
 */
export async function enforceFileRetention(
  runAt = new Date(),
  policy = getRetentionPolicy(),
  storage = getStorageAdapter(),
): Promise<FileRetentionResult> {
  const database = getDatabase();
  const result: FileRetentionResult = {
    paymentSlipsPurged: 0,
    generatedDocumentsPurged: 0,
    signedDocumentsPurged: 0,
    chatAttachmentsPurged: 0,
    failedFiles: 0,
  };
  const slipCutoff = retentionCutoff(runAt, policy.slipDays);
  const documentCutoff = retentionCutoff(runAt, policy.documentDays);
  const chatCutoff = retentionCutoff(runAt, policy.chatAttachmentDays);

  const slips = await database.paymentSubmission.findMany({
    where: {
      slipStorageKey: { not: null },
      slipPurgedAt: null,
      reviewedAt: { not: null, lte: slipCutoff },
      status: { in: ["APPROVED", "REJECTED"] },
    },
    orderBy: [{ reviewedAt: "asc" }, { id: "asc" }],
    take: policy.batchSize,
    select: { id: true, slipStorageKey: true },
  });
  for (const slip of slips) {
    if (!slip.slipStorageKey || !await deleteFile(storage, slip.slipStorageKey)) {
      result.failedFiles += 1;
      continue;
    }
    const updated = await database.paymentSubmission.updateMany({
      where: { id: slip.id, slipStorageKey: slip.slipStorageKey, slipPurgedAt: null },
      data: { slipStorageKey: null, slipMime: null, slipSize: null, slipPurgedAt: runAt },
    });
    result.paymentSlipsPurged += updated.count;
  }

  const documents = await database.generatedDocument.findMany({
    where: {
      storageKey: { not: null },
      filePurgedAt: null,
      createdAt: { lte: documentCutoff },
      leaseVersions: {
        none: {
          lease: {
            OR: [
              { status: { in: [...ACTIVE_LEASE_STATUSES] } },
              { endedAt: { gt: documentCutoff } },
            ],
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: policy.batchSize,
    select: { id: true, storageKey: true },
  });
  for (const document of documents) {
    if (!document.storageKey || !await deleteFile(storage, document.storageKey)) {
      result.failedFiles += 1;
      continue;
    }
    const updated = await database.generatedDocument.updateMany({
      where: { id: document.id, storageKey: document.storageKey, filePurgedAt: null },
      data: { storageKey: null, filePurgedAt: runAt },
    });
    result.generatedDocumentsPurged += updated.count;
  }

  const signedVersions = await database.leaseVersion.findMany({
    where: {
      signedStorageKey: { not: null },
      lease: {
        status: { in: ["EXPIRED", "CANCELLED"] },
        endedAt: { lte: documentCutoff },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: policy.batchSize,
    select: { signedStorageKey: true },
    distinct: ["signedStorageKey"],
  });
  for (const version of signedVersions) {
    const key = version.signedStorageKey;
    if (!key || !await deleteFile(storage, key)) {
      result.failedFiles += 1;
      continue;
    }
    await database.$transaction([
      database.leaseVersion.updateMany({
        where: {
          signedStorageKey: key,
          lease: {
            status: { in: ["EXPIRED", "CANCELLED"] },
            endedAt: { lte: documentCutoff },
          },
        },
        data: { signedStorageKey: null },
      }),
      database.lease.updateMany({
        where: {
          signedStorageKey: key,
          status: { in: ["EXPIRED", "CANCELLED"] },
          endedAt: { lte: documentCutoff },
        },
        data: { signedStorageKey: null, signedDocumentPurgedAt: runAt },
      }),
    ]);
    result.signedDocumentsPurged += 1;
  }

  const messages = await database.chatMessage.findMany({
    where: {
      attachmentKey: { not: null },
      attachmentPurgedAt: null,
      createdAt: { lte: chatCutoff },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: policy.batchSize,
    select: { id: true, attachmentKey: true },
  });
  for (const message of messages) {
    if (!message.attachmentKey || !await deleteFile(storage, message.attachmentKey)) {
      result.failedFiles += 1;
      continue;
    }
    const updated = await database.chatMessage.updateMany({
      where: { id: message.id, attachmentKey: message.attachmentKey, attachmentPurgedAt: null },
      data: {
        attachmentKey: null,
        attachmentName: null,
        attachmentMime: null,
        attachmentSize: null,
        attachmentPurgedAt: runAt,
      },
    });
    result.chatAttachmentsPurged += updated.count;
  }

  return result;
}
