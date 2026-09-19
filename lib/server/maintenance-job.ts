import { getDatabase } from "@/lib/server/db";
import { enforceFileRetention, type FileRetentionResult } from "@/lib/server/file-retention";
import { recalculateOverdueInvoicesWithDatabase } from "@/lib/server/invoices";

// เลขล็อกที่ตั้งขึ้นเอง ใช้กับ advisory lock ของ Postgres
// ต้องเป็นค่าคงที่ ทุกเครื่องจะได้ชนกันที่ล็อกเดียวกันและมีแค่เครื่องเดียวที่ได้ทำงาน
const maintenanceLockId = BigInt("7391540284102271");

export type MaintenanceJobResult = {
  status: "completed" | "already_running";
  runAt: string;
  overdueInvoices: number;
  publishedAnnouncements: number;
  expiredSubscriptions: number;
  expiredSubscriptionOrders: number;
} & FileRetentionResult;

const emptyRetentionResult = (): FileRetentionResult => ({
  paymentSlipsPurged: 0,
  generatedDocumentsPurged: 0,
  signedDocumentsPurged: 0,
  chatAttachmentsPurged: 0,
  failedFiles: 0,
});

// งานเบื้องหลังที่รันตามเวลา ปรับสถานะที่เปลี่ยนเองตามเวลาและลบไฟล์ที่เลยระยะเก็บ
export async function runMaintenanceJob(runAt = new Date()): Promise<MaintenanceJobResult> {
  const databaseResult = await getDatabase().$transaction<MaintenanceJobResult>(async (database) => {
    // ขอล็อกแบบไม่รอ ได้ก็ทำ ไม่ได้ก็ถอยไปเลย
    // ตัวตั้งเวลาอาจยิงซ้อนกัน หรือมีหลายเครื่องรันพร้อมกัน ต้องกันไม่ให้ทำงานทับกัน
    // xact แปลว่าล็อกหลุดเองเมื่อ transaction จบ ไม่ว่าจะสำเร็จหรือพัง จึงไม่มีทางค้าง
    const lock = await database.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(${maintenanceLockId}) AS "locked"
    `;
    // มีเครื่องอื่นทำอยู่แล้วก็ตอบไปตรง ๆ ไม่ถือว่าเป็นข้อผิดพลาด
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
      // เอาแค่รายชื่อหอที่มีบิลเลยกำหนด ไม่ต้องดึงบิลมาทั้งหมด
      select: { propertyId: true },
      distinct: ["propertyId"],
    });
    let overdueInvoices = 0;
    for (const property of properties) {
      const result = await recalculateOverdueInvoicesWithDatabase(database, property.propertyId, runAt, false);
      overdueInvoices += result.updated;
    }

    // ประกาศที่ตั้งเวลาไว้และถึงเวลาแล้ว ก็เปลี่ยนเป็นเผยแพร่
    const announcements = await database.announcement.updateMany({
      where: { status: "SCHEDULED", publishAt: { lte: runAt } },
      data: { status: "PUBLISHED", publishedAt: runAt },
    });
    // แพ็กเกจที่เลยวันหมดอายุ เปลี่ยนสถานะให้ตรงกับความจริง
    const subscriptions = await database.propertySubscription.updateMany({
      where: { status: { in: ["TRIAL", "ACTIVE"] }, expiresAt: { lte: runAt } },
      data: { status: "EXPIRED" },
    });
    // คำสั่งซื้อที่รอชำระจนเลยกำหนด ก็ปิดไป เจ้าของหอจะได้สั่งใหม่ได้
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
