/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “maintenance job” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { getDatabase } from "@/lib/server/db";
import { enforceFileRetention, type FileRetentionResult } from "@/lib/server/file-retention";
import { recalculateOverdueInvoicesWithDatabase } from "@/lib/server/invoices";

const maintenanceLockId = BigInt("7391540284102271");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Maintenance Job Result” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type MaintenanceJobResult = {
  status: "completed" | "already_running";
  runAt: string;
  overdueInvoices: number;
  publishedAnnouncements: number;
  expiredSubscriptions: number;
  expiredSubscriptionOrders: number;
} & FileRetentionResult;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “empty Retention Result” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลชนิด FileRetentionResult ตามสัญญา TypeScript ของฟังก์ชัน
 */
const emptyRetentionResult = (): FileRetentionResult => ({
  paymentSlipsPurged: 0,
  generatedDocumentsPurged: 0,
  signedDocumentsPurged: 0,
  chatAttachmentsPurged: 0,
  failedFiles: 0,
});

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “run Maintenance Job” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - runAt: ค่า “run At” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<MaintenanceJobResult> ตามสัญญา TypeScript ของฟังก์ชัน
 */
export async function runMaintenanceJob(runAt = new Date()): Promise<MaintenanceJobResult> {
  const databaseResult = await getDatabase().$transaction<MaintenanceJobResult>(async (database) => {
    const lock = await database.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(${maintenanceLockId}) AS "locked"
    `;
    if (!lock[0]?.locked) {
      return {
        status: "already_running",
        runAt: runAt.toISOString(),
        overdueInvoices: 0,
        publishedAnnouncements: 0,
        expiredSubscriptions: 0,
        expiredSubscriptionOrders: 0,
        ...emptyRetentionResult(),
      };
    }

    const properties = await database.invoice.findMany({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { lt: runAt },
      },
      select: { propertyId: true },
      distinct: ["propertyId"],
    });
    let overdueInvoices = 0;
    for (const property of properties) {
      const result = await recalculateOverdueInvoicesWithDatabase(database, property.propertyId, runAt, false);
      overdueInvoices += result.updated;
    }

    const announcements = await database.announcement.updateMany({
      where: { status: "SCHEDULED", publishAt: { lte: runAt } },
      data: { status: "PUBLISHED", publishedAt: runAt },
    });
    const subscriptions = await database.propertySubscription.updateMany({
      where: { status: { in: ["TRIAL", "ACTIVE"] }, expiresAt: { lte: runAt } },
      data: { status: "EXPIRED" },
    });
    const subscriptionOrders = await database.subscriptionOrder.updateMany({
      where: { status: "PENDING_PAYMENT", expiresAt: { lte: runAt } },
      data: { status: "EXPIRED" },
    });

    return {
      status: "completed",
      runAt: runAt.toISOString(),
      overdueInvoices,
      publishedAnnouncements: announcements.count,
      expiredSubscriptions: subscriptions.count,
      expiredSubscriptionOrders: subscriptionOrders.count,
      ...emptyRetentionResult(),
    };
  }, { isolationLevel: "Serializable", timeout: 60_000 });
  if (databaseResult.status === "already_running") return databaseResult;

  const retention = await enforceFileRetention(runAt);
  return { ...databaseResult, ...retention };
}
