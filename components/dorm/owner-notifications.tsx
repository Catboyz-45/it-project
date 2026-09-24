"use client";
// ประกอบตัวเลขบนป้ายเมนูและรายการในกระดิ่งแจ้งเตือนของเจ้าของหอ
// แยกออกจาก DormDashboard เพราะเป็นการแปลงข้อมูลล้วน ๆ ไม่ได้ถือ state อะไร

import { AlertTriangle, Banknote, CreditCard, FileText, MessageSquare, PackageCheck, UserRound, Wrench } from "lucide-react";
import type { OwnerDashboardAggregation } from "@/types/dashboard";
import type { PageKey } from "@/types/navigation";
import type { SubscriptionUiAccessState } from "@/lib/client/subscription-access-state";
import type { NotificationCenterItem } from "@/components/ui/NotificationCenter";
import { ownerPagePath } from "@/lib/navigation-routes";

// เตือนล่วงหน้า 30 วัน 86_400_000 คือจำนวนมิลลิวินาทีในหนึ่งวัน
const EXPIRY_WARNING_MS = 30 * 86_400_000;

// ต้องเตือนเรื่องแพ็กเกจไหม ยังไม่มีแพ็กเกจกับใกล้หมดอายุถือว่าต้องเตือนทั้งคู่
export function needsSubscriptionAttention(aggregation: OwnerDashboardAggregation) {
  if (!aggregation.subscription) return true;
  return new Date(aggregation.subscription.expiresAt).getTime() - Date.now() <= EXPIRY_WARNING_MS;
}

// ใกล้หมดอายุแต่ยังไม่หมด ใช้ตัดสินว่าจะขึ้นแถบเตือนบาง ๆ ด้านบนหรือไม่
export function isSubscriptionExpiringSoon(aggregation: OwnerDashboardAggregation | null) {
  const expiresAt = aggregation?.subscription?.expiresAt;
  if (!expiresAt) return false;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  return remaining > 0 && remaining <= EXPIRY_WARNING_MS;
}

// ตัวเลขบนป้ายของแต่ละเมนู ไม่มีข้อมูลสรุปก็ไม่ขึ้นป้ายเลย
export function buildNotificationCounts(
  aggregation: OwnerDashboardAggregation | null,
  unreadTicketReplies: number,
): Partial<Record<PageKey, number>> {
  if (!aggregation) return {};
  const subscription = needsSubscriptionAttention(aggregation) ? 1 : 0;
  return {
    subscription,
    // หน้าภาพรวมรวมทุกอย่างที่ค้างอยู่ เพราะเป็นหน้าแรกที่เจ้าของหอเปิด
    overview: aggregation.pendingOccupancies
      + aggregation.finance.pendingPayments
      + aggregation.finance.overdueInvoices
      + aggregation.operations.openTickets
      + aggregation.operations.waitingParcels
      + aggregation.operations.unreadTenantMessages
      + aggregation.operations.expiringLeases
      + subscription,
    tenants: aggregation.pendingOccupancies,
    contracts: aggregation.operations.expiringLeases,
    invoices: aggregation.finance.pendingPayments + aggregation.finance.overdueInvoices,
    complaints: unreadTicketReplies || aggregation.operations.openTickets,
    parcels: aggregation.operations.waitingParcels,
  };
}

// ข้อความอธิบายต่างกันตามสิทธิ์ เพราะโหมดอ่านอย่างเดียวกดทำอะไรต่อไม่ได้
function describe(isReadOnly: boolean, readOnlyText: string, actionableText: string) {
  return isReadOnly ? readOnlyText : actionableText;
}

function subscriptionTitle(aggregation: OwnerDashboardAggregation, accessState: SubscriptionUiAccessState) {
  if (!aggregation.subscription) return "ยังไม่มีแพ็กเกจที่ใช้งานได้";
  return accessState === "read-only" ? "แพ็กเกจหมดอายุแล้ว" : "แพ็กเกจใกล้หมดอายุ";
}

// รายการในกระดิ่งแจ้งเตือน ข้อความต่างกันตามสิทธิ์ เพราะโหมดอ่านอย่างเดียวทำอะไรต่อไม่ได้
export function buildOwnerNotifications({
  accessState,
  aggregation,
  isReadOnly,
  onOpenChat,
  propertyId,
  unreadTicketReplies,
}: {
  accessState: SubscriptionUiAccessState;
  aggregation: OwnerDashboardAggregation | null;
  isReadOnly: boolean;
  onOpenChat: () => void;
  propertyId: string;
  unreadTicketReplies: number;
}): NotificationCenterItem[] {
  if (!aggregation) return [];
  return [
    { id: "pending-occupancies", count: aggregation.pendingOccupancies, title: "คำขอเข้าพักที่ยังรอดำเนินการ", description: describe(isReadOnly, "เปิดดูรายละเอียดได้ การอนุมัติจะกลับมาใช้ได้หลังต่ออายุแพ็กเกจ", "ตรวจสอบข้อมูลผู้เช่าก่อนอนุมัติเข้าพัก"), href: `${ownerPagePath(propertyId, "tenants")}?tab=pending`, icon: <UserRound size={19} /> },
    { id: "pending-payments", count: aggregation.finance.pendingPayments, title: "หลักฐานชำระเงินที่ยังรอตรวจสอบ", description: describe(isReadOnly, "เปิดดูหลักฐานได้ การยืนยันรับชำระจะกลับมาใช้ได้หลังต่ออายุแพ็กเกจ", "ตรวจสอบสลิปและยืนยันการรับชำระ"), href: `${ownerPagePath(propertyId, "invoices")}?tab=payments`, icon: <Banknote size={19} /> },
    { id: "overdue-invoices", count: aggregation.finance.overdueInvoices, title: "บิลเกินกำหนดชำระ", description: describe(isReadOnly, "เปิดดูรายการและยอดค้างชำระได้ในโหมดอ่านอย่างเดียว", "ติดตามบิลที่ยังไม่ได้รับชำระ"), href: ownerPagePath(propertyId, "invoices"), icon: <AlertTriangle size={19} /> },
    { id: "open-tickets", count: aggregation.operations.openTickets, title: "เรื่องแจ้งที่ยังไม่เสร็จ", description: describe(isReadOnly, "เปิดดูสถานะและประวัติได้ การอัปเดตจะกลับมาใช้ได้หลังต่ออายุแพ็กเกจ", "ติดตามงานซ่อมและเรื่องร้องเรียนจากผู้เช่า"), href: ownerPagePath(propertyId, "complaints"), icon: <Wrench size={19} /> },
    { id: "ticket-replies", count: unreadTicketReplies, title: "ข้อความตอบกลับเรื่องแจ้ง", description: describe(isReadOnly, "เปิดอ่านข้อความและประวัติเดิมได้ในโหมดอ่านอย่างเดียว", "มีข้อความใหม่จากผู้เช่าที่ยังไม่ได้อ่าน"), href: ownerPagePath(propertyId, "complaints"), icon: <MessageSquare size={19} /> },
    { id: "waiting-parcels", count: aggregation.operations.waitingParcels, title: "พัสดุที่ยังรอผู้เช่ารับ", description: describe(isReadOnly, "เปิดดูรายการได้ การบันทึกรับพัสดุจะกลับมาใช้ได้หลังต่ออายุแพ็กเกจ", "รายการพัสดุที่ยังไม่ได้ส่งมอบ"), href: ownerPagePath(propertyId, "parcels"), icon: <PackageCheck size={19} /> },
    { id: "tenant-messages", count: aggregation.operations.unreadTenantMessages, title: "ข้อความใหม่จากผู้เช่า", description: describe(isReadOnly, "เปิดอ่านประวัติข้อความได้ แต่ยังตอบกลับไม่ได้", "เปิดกล่องข้อความเพื่อตอบกลับผู้เช่า"), onSelect: onOpenChat, icon: <MessageSquare size={19} /> },
    { id: "expiring-leases", count: aggregation.operations.expiringLeases, title: "สัญญาใกล้หมดอายุ", description: describe(isReadOnly, "คำนวณจากวันสิ้นสุดสัญญา เปิดดูรายละเอียดได้ในโหมดอ่านอย่างเดียว", "คำนวณจากวันสิ้นสุดอัตโนมัติ โปรดตรวจสอบและเตรียมต่อสัญญา"), href: ownerPagePath(propertyId, "contracts"), icon: <FileText size={19} /> },
    {
      id: "subscription",
      count: needsSubscriptionAttention(aggregation) ? 1 : 0,
      title: subscriptionTitle(aggregation, accessState),
      description: accessState === "read-only"
        ? "เปิดหน้าสมาชิกเพื่อเลือกแพ็กเกจและต่ออายุการใช้งาน"
        : "ตรวจสอบแพ็กเกจและดำเนินการต่ออายุ",
      href: ownerPagePath(propertyId, "subscription"),
      icon: <CreditCard size={19} />,
    },
  ];
}
