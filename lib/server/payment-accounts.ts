import type { z } from "zod";
import type { platformPaymentSettingsSchema } from "@/lib/domain/payment-account";
import { createPromptPayPayload } from "@/lib/domain/payments";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";

// ช่องทางรับเงินที่ผู้จ่ายเห็น ทั้งของหอ (ค่าเช่า) และของแพลตฟอร์ม (ค่าแพ็กเกจ)
// ตารางของแพลตฟอร์มมีแถวเดียว id คงที่ ฐานข้อมูลบังคับไว้ด้วย CHECK constraint

const platformSettingsId = "default";
const accountSelect = { bankName: true, bankAccountNumber: true, bankAccountName: true } as const;

type BankAccount = { bankName: string | null; bankAccountNumber: string | null; bankAccountName: string | null };

// ยังไม่เคยตั้งก็คืนค่าว่างทั้งชุด หน้าจอจะได้แสดงฟอร์มเปล่าแทนข้อผิดพลาด
export async function getPlatformPaymentSettings() {
  const settings = await getDatabase().platformPaymentSettings.findUnique({
    where: { id: platformSettingsId },
    select: { ...accountSelect, promptPayId: true, updatedAt: true },
  });
  return settings ?? { bankName: null, bankAccountNumber: null, bankAccountName: null, promptPayId: null, updatedAt: null };
}

// บันทึกทั้งชุด ช่องที่ไม่ส่งมาถือว่าล้างค่า เพราะฟอร์มส่งครบทุกช่องเสมอ
export function savePlatformPaymentSettings(input: z.infer<typeof platformPaymentSettingsSchema>) {
  const data = {
    bankName: input.bankName ?? null,
    bankAccountNumber: input.bankAccountNumber ?? null,
    bankAccountName: input.bankAccountName ?? null,
    promptPayId: input.promptPayId ?? null,
  };
  return getDatabase().platformPaymentSettings.upsert({
    where: { id: platformSettingsId },
    create: { id: platformSettingsId, ...data },
    update: data,
    select: { ...accountSelect, promptPayId: true, updatedAt: true },
  });
}

// QR ที่สร้างไม่ได้ไม่ได้แปลว่าจ่ายไม่ได้ ยังโอนเข้าบัญชีได้ จึงคืน null แทนการโยน error
function promptPayPayloadOrNull(promptPayId: string | null | undefined, amount: number) {
  if (!promptPayId) return null;
  try {
    return createPromptPayPayload(promptPayId, amount);
  } catch {
    return null;
  }
}

// วิธีโอนค่าแพ็กเกจของคำสั่งซื้อหนึ่งใบ ผู้เรียกต้องตรวจว่าเจ้าของหอเข้าถึงหอนี้ได้มาก่อน
// ตรวจว่าคำสั่งซื้อเป็นของหอนี้ในคำสั่งฐานข้อมูลเลย กันเปิดดูคำสั่งซื้อของหออื่นด้วยการเปลี่ยน id
export async function getSubscriptionPaymentInstructions(propertyId: string, orderId: string) {
  const [order, settings] = await Promise.all([
    getDatabase().subscriptionOrder.findFirst({
      where: { id: orderId, propertyId, status: "PENDING_PAYMENT" },
      select: { orderNumber: true, amount: true },
    }),
    getPlatformPaymentSettings(),
  ]);
  if (!order) throw new ApiError(404, "ไม่พบคำสั่งซื้อที่รอชำระ");
  return {
    orderNumber: order.orderNumber,
    amount: order.amount.toString(),
    bankName: settings.bankName,
    bankAccountNumber: settings.bankAccountNumber,
    bankAccountName: settings.bankAccountName,
    promptPayPayload: promptPayPayloadOrNull(settings.promptPayId, Number(order.amount)),
  };
}

// บัญชีรับค่าเช่าของหอที่ออกบิลใบนี้ เห็นได้เฉพาะผู้เช่าหลักที่ยังพักอยู่ เหมือนสิทธิ์ดู QR พร้อมเพย์
export async function getTenantPaymentAccount(tenantProfileId: string, invoiceId: string): Promise<BankAccount> {
  const invoice = await getDatabase().invoice.findFirst({
    where: {
      id: invoiceId, status: { in: ["PENDING", "OVERDUE"] },
      room: { occupancies: { some: { tenantProfileId, role: "PRIMARY", status: "ACTIVE" } } },
    },
    select: { property: { select: { settings: { select: accountSelect } } } },
  });
  if (!invoice) throw new ApiError(404, "ไม่พบบิลที่ชำระได้");
  return invoice.property.settings ?? { bankName: null, bankAccountNumber: null, bankAccountName: null };
}
