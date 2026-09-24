"use client";
// ฟอร์มสร้างของผู้ดูแลระบบ แต่ละหน้าเรียกเฉพาะส่วนที่ต้องการ
// ตัวนี้ทำหน้าที่แค่เลือกว่าจะแสดงฟอร์มไหน ตัวฟอร์มเองถือ state ของตัวเอง

import { AdminAccountForm } from "@/components/admin/AdminAccountForm";
import { PropertyCreateForm } from "@/components/admin/PropertyCreateForm";
import { SubscriptionOverrideForm } from "@/components/admin/SubscriptionOverrideForm";

type SuperAdminFormSection = "property" | "account" | "subscription";

export function SuperAdminForms({
  sections = ["property", "account", "subscription"],
}: Readonly<{ sections?: SuperAdminFormSection[] }>) {
  return <>
    {sections.includes("property") ? <PropertyCreateForm /> : null}
    {sections.includes("account") ? <AdminAccountForm /> : null}
    {sections.includes("subscription") ? <SubscriptionOverrideForm /> : null}
  </>;
}
