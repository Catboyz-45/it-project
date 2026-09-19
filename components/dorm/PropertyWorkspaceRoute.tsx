
import { notFound, redirect } from "next/navigation";
import { DormDashboard } from "@/components/dorm/DormDashboard";
import { requirePageAuth } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import { getDashboardReadModel } from "@/lib/server/dashboard-read-model";
import { getOwnerDashboardAggregation } from "@/lib/server/dashboard-aggregation";
import type { PageKey } from "@/types/navigation";

// Server Component ที่ตรวจสิทธิ์และดึงข้อมูลตั้งต้น ก่อนส่งให้หน้าจอฝั่งเบราว์เซอร์
export async function PropertyWorkspaceRoute({
  activePage,
  initialInvoiceView = "invoices",
  propertyId,
}: {
  activePage: PageKey;
  initialInvoiceView?: "invoices" | "payments";
  propertyId: string;
}) {
  // ตรวจสิทธิ์บนเซิร์ฟเวอร์ก่อนแตะข้อมูลใด ๆ ไม่เชื่อค่าที่ส่งมาจากฝั่งผู้ใช้
  const auth = await requirePageAuth();
  // ผู้ดูแลระบบมีหน้าของตัวเอง ไม่ใช่หน้าทำงานของหอพัก
  if (auth.role === "SUPER_ADMIN") redirect("/super-admin");
  // ไม่มีสิทธิ์ในหอนี้ก็ตอบว่าไม่พบ ไม่บอกว่ามีอยู่จริงแต่เข้าไม่ได้
  if (!auth.propertyIds.includes(propertyId)) notFound();

  // เช็คว่าหอยังเปิดใช้งานอยู่ เลือกมาแค่ id เพราะต้องการรู้แค่ว่ามีหรือไม่มี
  const property = await getDatabase().property.findFirst({
    where: { id: propertyId, isActive: true },
    select: { id: true },
  });
  if (!property) notFound();

  // ยิงสามคำสั่งพร้อมกัน เพราะไม่มีตัวไหนต้องรอผลของอีกตัว
  const [availableProperties, initialData, initialAggregation] = await Promise.all([
    getDatabase().property.findMany({
      where: { id: { in: auth.propertyIds }, isActive: true },
      orderBy: { name: "asc" },
      // เลือกเฉพาะฟิลด์ที่ตัวสลับหอพักใช้จริง ไม่ดึงข้อมูลหอมาทั้งก้อน
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
