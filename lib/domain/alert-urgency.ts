// แยกงานค้างเป็นสองระดับให้ป้ายแจ้งเตือนเลือกสีได้
// เลยกำหนดแล้วเป็นสีแดง ส่วนงานที่แค่รอทำเป็นสีเหลือง สีหลักของแบรนด์เก็บไว้ให้ปุ่มกับเมนูที่เลือกอยู่

export type AlertTone = "pending" | "urgent";

// แพ็กเกจที่ไม่มีเลยหรือหมดอายุแล้วนับเป็นเรื่องด่วน ส่วนใกล้หมดอายุยังเป็นแค่งานรอทำ
export function isSubscriptionLapsed(expiresAt: string | Date | null | undefined, now = new Date()) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < now.getTime();
}

// เมนูของเจ้าของหอที่มีเรื่องเลยกำหนด หน้าภาพรวมรวมทุกเรื่อง จึงด่วนตามเรื่องที่ด่วนที่สุด
export function ownerUrgentPages({ overdueInvoices, subscriptionExpiresAt, now = new Date() }: Readonly<{
  overdueInvoices: number;
  subscriptionExpiresAt: string | Date | null | undefined;
  now?: Date;
}>) {
  const hasOverdue = overdueInvoices > 0;
  const subscriptionLapsed = isSubscriptionLapsed(subscriptionExpiresAt, now);
  return {
    invoices: hasOverdue,
    overview: hasOverdue || subscriptionLapsed,
    subscription: subscriptionLapsed,
  };
}

export function alertTone(isUrgent: boolean | undefined): AlertTone {
  return isUrgent ? "urgent" : "pending";
}
