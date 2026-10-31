"use client";
// ฟอร์มสร้างของผู้ดูแลระบบ แต่ละหน้าเรียกเฉพาะส่วนที่ต้องการ
// ตัวนี้ทำหน้าที่แค่เลือกว่าจะแสดงฟอร์มไหน ตัวฟอร์มเองถือ state ของตัวเอง

import { AdminAccountForm } from "@/components/admin/AdminAccountForm";
import { PropertyCreateForm } from "@/components/admin/PropertyCreateForm";

// การแก้แพ็กเกจด้วยตนเองย้ายไปเป็นป็อปอัพบนหน้าการชำระสมาชิกแล้ว (SubscriptionOverrideButton)
type SuperAdminFormSection = "property" | "account";

export function SuperAdminForms({
  sections = ["property", "account"],
}: Readonly<{ sections?: SuperAdminFormSection[] }>) {
  return <>
    {sections.includes("property") ? <PropertyCreateForm /> : null}
    {sections.includes("account") ? <AdminAccountForm /> : null}
  </>;
}
