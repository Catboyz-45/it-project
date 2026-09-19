import { createPromptPayPayload } from "@/lib/domain/payments";
import type { PaymentSubmissionStatus } from "@/lib/domain/enums";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";

// สร้าง QR พร้อมเพย์ให้ผู้เช่าจ่ายบิลใบหนึ่ง
export async function getTenantPromptPay(tenantProfileId: string, invoiceId: string) {
  const invoice = await getDatabase().invoice.findFirst({
    where: {
      id: invoiceId, status: { in: ["PENDING", "OVERDUE"] },
      // ตรวจความเป็นเจ้าของในคำสั่งฐานข้อมูลเลย ไม่ใช่ดึงมาแล้วค่อยเช็คในโค้ด
      // ผู้เช่าหลักที่ยังอยู่จริงเท่านั้นที่เห็นบิลใบนี้ได้
      room: { occupancies: { some: { tenantProfileId, role: "PRIMARY", status: "ACTIVE" } } },
    },
    select: {
      id: true, invoiceNumber: true, total: true,
      property: { select: { settings: { select: { promptPayId: true } } } },
    },
  });
  // ไม่เจอตอบว่าไม่พบ ไม่แยกว่าไม่มีบิลจริงหรือมีแต่ไม่ใช่ของคนนี้
  if (!invoice) throw new ApiError(404, "ไม่พบบิลที่ชำระได้");
  const promptPayId = invoice.property.settings?.promptPayId;
  if (!promptPayId) throw new ApiError(409, "หอพักยังไม่ได้ตั้งค่า PromptPay");
  let payload: string;
  try {
    payload = createPromptPayPayload(promptPayId, Number(invoice.total));
  } catch {
    // แปลงเป็นข้อความที่ผู้ใช้เข้าใจ ไม่ปล่อยรายละเอียดของตัวสร้าง QR ออกไป
    throw new ApiError(409, "การตั้งค่า PromptPay ของหอพักไม่ถูกต้อง");
  }
  return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: invoice.total.toString(), payload };
}

// รับหลักฐานการโอนจากผู้เช่า
export async function createPaymentSubmission(input: {
  tenantProfileId: string;
  invoiceId: string;
  storageKey: string;
  mimeType: string;
  size: number;
}) {
  return getDatabase().$transaction(async (database) => {
    const invoice = await database.invoice.findFirst({
      where: {
        id: input.invoiceId, status: { in: ["PENDING", "OVERDUE"] },
        room: { occupancies: { some: { tenantProfileId: input.tenantProfileId, role: "PRIMARY", status: "ACTIVE" } } },
      },
      select: { id: true, propertyId: true, total: true },
    });
    if (!invoice) throw new ApiError(404, "ไม่พบบิลที่ส่งหลักฐานได้");
    const pending = await database.paymentSubmission.count({
      where: { invoiceId: invoice.id, tenantProfileId: input.tenantProfileId, status: "PENDING_REVIEW" },
    });
    // ส่งซ้ำระหว่างรอตรวจไม่ได้ กันคิวของเจ้าของหอเต็มไปด้วยรายการเดียวกันหลายใบ
    if (pending > 0) throw new ApiError(409, "มีหลักฐานการชำระที่รอตรวจสอบอยู่แล้ว");
    return database.paymentSubmission.create({
      data: {
        propertyId: invoice.propertyId, invoiceId: invoice.id,
        // เอายอดจากบิลในฐานข้อมูล ไม่เอาที่ผู้เช่าส่งมา กันแจ้งยอดไม่ตรงกับที่ต้องจ่ายจริง
        tenantProfileId: input.tenantProfileId, amount: invoice.total,
        slipStorageKey: input.storageKey, slipMime: input.mimeType, slipSize: input.size,
      },
      select: { id: true, invoiceId: true, amount: true, status: true, submittedAt: true },
    });
  // Serializable เพราะเช็คว่ามีใบค้างอยู่ไหมแล้วค่อยสร้าง กดสองครั้งพร้อมกันจะได้ไม่ผ่านทั้งคู่
  }, { isolationLevel: "Serializable" });
}

export async function listPaymentSubmissions(
  propertyId: string,
  pagination: PaginationInput,
  status?: PaymentSubmissionStatus,
) {
  const rows = await getDatabase().paymentSubmission.findMany({
    where: { propertyId, ...(status ? { status } : {}) },
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    ...paginationQuery(pagination),
    select: {
      id: true, amount: true, status: true, submittedAt: true, reviewedAt: true,
      rejectionNote: true, slipStorageKey: true,
      invoice: { select: { id: true, invoiceNumber: true, total: true, room: { select: { number: true } } } },
      tenantProfile: { select: { user: { select: { displayName: true } } } },
    },
  });
  // ตัด slipStorageKey ออกก่อนส่งไปฝั่งเบราว์เซอร์ ส่งแค่ว่ามีไฟล์อยู่ไหม
  // ที่อยู่จริงของไฟล์ไม่ควรหลุดออกไป ต้องเข้าผ่าน API ที่ตรวจสิทธิ์เท่านั้น
  return toPaginatedResult(rows.map(({ slipStorageKey, ...row }) => ({
    ...row, amount: row.amount.toString(), slipAvailable: slipStorageKey !== null,
    invoice: { ...row.invoice, total: row.invoice.total.toString() },
  })), pagination);
}

// ประวัติการส่งหลักฐานของผู้เช่าเอง ตรวจความเป็นเจ้าของซ้ำในเงื่อนไข ถึงจะรู้ tenantProfileId อยู่แล้ว
export async function listTenantPaymentSubmissions(tenantProfileId: string, invoiceId: string) {
  const rows = await getDatabase().paymentSubmission.findMany({
    where: {
      tenantProfileId, invoiceId,
      invoice: { room: { occupancies: { some: { tenantProfileId, role: "PRIMARY", status: "ACTIVE" } } } },
    },
    orderBy: { submittedAt: "desc" },
    select: { id: true, amount: true, status: true, submittedAt: true, reviewedAt: true, rejectionNote: true },
  });
  return rows.map((row) => ({ ...row, amount: row.amount.toString() }));
}

export async function reviewPaymentSubmission(input: {
  propertyId: string;
  paymentId: string;
  reviewerId: string;
  status: "APPROVED" | "REJECTED";
  rejectionNote?: string;
}) {
  return getDatabase().$transaction(async (database) => {
    const payment = await database.paymentSubmission.findFirst({
      where: { id: input.paymentId, propertyId: input.propertyId, status: "PENDING_REVIEW" },
      select: { id: true, invoiceId: true, amount: true, invoice: { select: { status: true, total: true } } },
    });
    if (!payment) throw new ApiError(404, "ไม่พบหลักฐานที่รอตรวจสอบ");
    if (input.status === "APPROVED") {
      if (!["PENDING", "OVERDUE"].includes(payment.invoice.status)) throw new ApiError(409, "สถานะบิลไม่พร้อมรับชำระ");
      if (!payment.amount.equals(payment.invoice.total)) throw new ApiError(409, "ยอดหลักฐานไม่ตรงกับยอดบิลปัจจุบัน");
    }
    const reviewedAt = new Date();
    const updated = await database.paymentSubmission.update({
      where: { id: payment.id },
      data: {
        status: input.status, reviewedAt, reviewedById: input.reviewerId,
        rejectionNote: input.status === "REJECTED" ? input.rejectionNote : null,
      },
      select: { id: true, status: true, reviewedAt: true, invoiceId: true },
    });
    if (input.status === "APPROVED") {
      await database.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: "PAID", paidAt: reviewedAt },
      });
      await database.paymentSubmission.updateMany({
        where: { invoiceId: payment.invoiceId, id: { not: payment.id }, status: "PENDING_REVIEW" },
        data: {
          status: "REJECTED", reviewedAt, reviewedById: input.reviewerId,
          rejectionNote: "บิลนี้มีหลักฐานอื่นที่ได้รับการอนุมัติแล้ว",
        },
      });
    }
    return updated;
  }, { isolationLevel: "Serializable" });
}

export async function getAdminSlip(propertyId: string, paymentId: string) {
  const payment = await getDatabase().paymentSubmission.findFirst({
    where: { id: paymentId, propertyId },
    select: { slipStorageKey: true, slipMime: true, submittedAt: true },
  });
  if (!payment?.slipStorageKey || !payment.slipMime) {
    throw new ApiError(404, "ไม่พบสลิปหรือไฟล์พ้นระยะเวลาจัดเก็บแล้ว");
  }
  return {
    slipStorageKey: payment.slipStorageKey,
    slipMime: payment.slipMime,
    submittedAt: payment.submittedAt,
  };
}
