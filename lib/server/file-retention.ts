import { getStorageAdapter, type StorageAdapter } from "@/lib/documents/storage";
import { getDatabase } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";

const DAY_MS = 86_400_000;
// สัญญาที่ยังไม่จบ เอกสารของสัญญาเหล่านี้ห้ามลบ ไม่ว่าจะสร้างมานานแค่ไหน
const ACTIVE_LEASE_STATUSES = ["DRAFT", "PENDING_SIGNATURE", "ACTIVE", "EXPIRING"] as const;

export type RetentionPolicy = {
  slipDays: number;
  documentDays: number;
  chatAttachmentDays: number;
  batchSize: number;
};

export type FileRetentionResult = {
  paymentSlipsPurged: number;
  generatedDocumentsPurged: number;
  signedDocumentsPurged: number;
  chatAttachmentsPurged: number;
  failedFiles: number;
};

// ย้อนหลังไปตามจำนวนวันที่กำหนด สร้าง Date ใหม่ ไม่แก้ค่าที่ส่งเข้ามา
export function retentionCutoff(runAt: Date, days: number) {
  return new Date(runAt.getTime() - days * DAY_MS);
}

// ระยะเก็บมาจากการตั้งค่าของระบบ ไม่ได้ฝังไว้ในโค้ด เพราะแต่ละที่มีข้อกำหนดต่างกัน
export function getRetentionPolicy(): RetentionPolicy {
  const env = getServerEnv();
  return {
    slipDays: env.SLIP_RETENTION_DAYS,
    documentDays: env.DOCUMENT_RETENTION_DAYS,
    chatAttachmentDays: env.CHAT_ATTACHMENT_RETENTION_DAYS,
    batchSize: env.RETENTION_BATCH_SIZE,
  };
}

// ลบไฟล์แล้วบอกว่าสำเร็จไหม ไม่โยน error เพราะไฟล์อันหนึ่งพังต้องไม่หยุดทั้งงาน
async function deleteFile(storage: StorageAdapter, key: string) {
  try {
    await storage.delete(key);
    return true;
  } catch {
    return false;
  }
}

// ลบไฟล์ที่เลยระยะเก็บแล้ว รันเป็นงานเบื้องหลังตามเวลาที่ตั้งไว้
// รับ runAt กับ policy เข้ามาได้ จะได้ตรึงเวลาและค่าตั้งค่าในการทดสอบ
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
      // นับจากวันที่ตรวจเสร็จ ไม่ใช่วันที่ส่ง และต้องตรวจไปแล้วจริง ๆ
      // สลิปที่ยังรอตรวจอยู่ห้ามลบ ไม่ว่าจะส่งมานานแค่ไหน
      reviewedAt: { not: null, lte: slipCutoff },
      status: { in: ["APPROVED", "REJECTED"] },
    },
    // ทำทีละชุด ไม่ลบทีเดียวทั้งหมด งานจะได้ไม่ค้างนานและไม่กินหน่วยความจำ
    // เรียงเก่าสุดก่อน และใช้ id เป็นตัวตัดสินเมื่อเวลาเท่ากัน ลำดับจะได้คงที่ทุกรอบ
    orderBy: [{ reviewedAt: "asc" }, { id: "asc" }],
    take: policy.batchSize,
    select: { id: true, slipStorageKey: true },
  });
  for (const slip of slips) {
    // ลบไฟล์จริงให้สำเร็จก่อน แล้วค่อยล้างข้อมูลในฐาน
    // ถ้าสลับลำดับ ลบในฐานสำเร็จแต่ลบไฟล์พลาด ไฟล์นั้นจะค้างอยู่ตลอดไปโดยไม่มีใครรู้
    if (!slip.slipStorageKey || !await deleteFile(storage, slip.slipStorageKey)) {
      result.failedFiles += 1;
      continue;
    }
    const updated = await database.paymentSubmission.updateMany({
      // ใส่ค่าเดิมไว้ใน where ด้วย ถ้ามีคนอื่นแก้ระหว่างนั้นจะไม่เขียนทับ
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
      // ห้ามลบเอกสารที่ยังผูกกับสัญญาที่ยังไม่จบ หรือสัญญาที่เพิ่งจบไปยังไม่พ้นระยะเก็บ
      // none แปลว่าต้องไม่มีสัญญาที่เข้าเงื่อนไขเหล่านี้เลย
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
