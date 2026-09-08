/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นหน้าจอของเส้นทาง /settings/documents/[kind]/edit ใน Next.js App Router
 * การทำงาน: ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล
 */

import { notFound, redirect } from "next/navigation";
import { DocumentTemplateEditorRoute } from "@/components/dorm/DocumentTemplateEditorRoute";
import type { DocumentKind } from "@/lib/documents/types";
import { requirePageAuth } from "@/lib/server/auth";
import { getPropertySubscriptionAccess } from "@/lib/server/subscription-guard";
import { ownerPagePath } from "@/lib/navigation-routes";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Document Editor Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { params, searchParams }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export default async function DocumentEditorPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ propertyId?: string }> }) {
  const auth = await requirePageAuth();
  const { kind } = await params;
  if (kind !== "contract" && kind !== "invoice") notFound();
  const { propertyId } = await searchParams;
  if (!propertyId) redirect(auth.role === "SUPER_ADMIN" ? "/super-admin" : "/admin");
  if (auth.role !== "SUPER_ADMIN" && !auth.propertyIds.includes(propertyId)) notFound();
  const subscriptionAccess = await getPropertySubscriptionAccess(propertyId);
  if (subscriptionAccess.isReadOnly) redirect(ownerPagePath(propertyId, "settings"));
  return <DocumentTemplateEditorRoute kind={kind as DocumentKind} propertyId={propertyId} />;
}
