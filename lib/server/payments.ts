/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “payments” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { createPromptPayPayload } from "@/lib/domain/payments";
import type { PaymentSubmissionStatus } from "@/lib/domain/enums";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { paginationQuery, toPaginatedResult, type PaginationInput } from "@/lib/server/pagination";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Tenant Prompt Pay” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - invoiceId: รหัสภายในของบิล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function getTenantPromptPay(tenantProfileId: string, invoiceId: string) {
  const invoice = await getDatabase().invoice.findFirst({
    where: {
      id: invoiceId, status: { in: ["PENDING", "OVERDUE"] },
      room: { occupancies: { some: { tenantProfileId, role: "PRIMARY", status: "ACTIVE" } } },
    },
    select: {
      id: true, invoiceNumber: true, total: true,
      property: { select: { settings: { select: { promptPayId: true } } } },
    },
  });
  if (!invoice) throw new ApiError(404, "ไม่พบบิลที่ชำระได้");
  const promptPayId = invoice.property.settings?.promptPayId;
  if (!promptPayId) throw new ApiError(409, "หอพักยังไม่ได้ตั้งค่า PromptPay");
  let payload: string;
  try {
    payload = createPromptPayPayload(promptPayId, Number(invoice.total));
  } catch {
    throw new ApiError(409, "การตั้งค่า PromptPay ของหอพักไม่ถูกต้อง");
  }
  return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: invoice.total.toString(), payload };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Payment Submission” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
    if (pending > 0) throw new ApiError(409, "มีหลักฐานการชำระที่รอตรวจสอบอยู่แล้ว");
    return database.paymentSubmission.create({
      data: {
        propertyId: invoice.propertyId, invoiceId: invoice.id,
        tenantProfileId: input.tenantProfileId, amount: invoice.total,
        slipStorageKey: input.storageKey, slipMime: input.mimeType, slipSize: input.size,
      },
      select: { id: true, invoiceId: true, amount: true, status: true, submittedAt: true },
    });
  }, { isolationLevel: "Serializable" });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Payment Submissions” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - pagination: ค่า “pagination” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - status: ค่า “status” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
  return toPaginatedResult(rows.map(({ slipStorageKey, ...row }) => ({
    ...row, amount: row.amount.toString(), slipAvailable: slipStorageKey !== null,
    invoice: { ...row.invoice, total: row.invoice.total.toString() },
  })), pagination);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Tenant Payment Submissions” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - tenantProfileId: รหัสโปรไฟล์ผู้เช่า
 * - invoiceId: รหัสภายในของบิล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “review Payment Submission” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Admin Slip” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - paymentId: รหัสภายในของ payment
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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
