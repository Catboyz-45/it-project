/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Property Workspace Route” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { notFound, redirect } from "next/navigation";
import { DormDashboard } from "@/components/dorm/DormDashboard";
import { requirePageAuth } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import { getDashboardReadModel } from "@/lib/server/dashboard-read-model";
import { getOwnerDashboardAggregation } from "@/lib/server/dashboard-aggregation";
import type { PageKey } from "@/types/navigation";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Property Workspace Route” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { activePage, initialInvoiceView = "invoices", propertyId, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export async function PropertyWorkspaceRoute({
  activePage,
  initialInvoiceView = "invoices",
  propertyId,
}: {
  activePage: PageKey;
  initialInvoiceView?: "invoices" | "payments";
  propertyId: string;
}) {
  const auth = await requirePageAuth();
  if (auth.role === "SUPER_ADMIN") redirect("/super-admin");
  if (!auth.propertyIds.includes(propertyId)) notFound();

  const property = await getDatabase().property.findFirst({
    where: { id: propertyId, isActive: true },
    select: { id: true },
  });
  if (!property) notFound();

  const [availableProperties, initialData, initialAggregation] = await Promise.all([
    getDatabase().property.findMany({
      where: { id: { in: auth.propertyIds }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, shortName: true },
    }),
    getDashboardReadModel(propertyId),
    getOwnerDashboardAggregation(propertyId),
  ]);
  if (!initialAggregation) notFound();

  return (
    <DormDashboard
      activePage={activePage}
      authenticatedEmail={auth.email}
      authenticatedUser={auth.displayName}
      availableProperties={availableProperties}
      initialAggregation={initialAggregation}
      initialData={initialData}
      initialInvoiceView={initialInvoiceView}
      propertyId={propertyId}
    />
  );
}
