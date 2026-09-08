/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นหน้าจอของเส้นทาง /admin/properties/[propertyId]/[...section] ใน Next.js App Router
 * การทำงาน: ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล
 */

import { notFound } from "next/navigation";
import { PropertyWorkspaceRoute } from "@/components/dorm/PropertyWorkspaceRoute";
import { ownerPageFromSegments } from "@/lib/navigation-routes";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Property Workspace Section Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { params, searchParams, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export default async function PropertyWorkspaceSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string; section: string[] }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { propertyId, section } = await params;
  const { tab } = await searchParams;
  const activePage = ownerPageFromSegments(section);
  if (!activePage || activePage === "overview") notFound();
  const initialInvoiceView = activePage === "invoices" && tab === "payments" ? "payments" : "invoices";
  return <PropertyWorkspaceRoute activePage={activePage} initialInvoiceView={initialInvoiceView} propertyId={propertyId} />;
}
