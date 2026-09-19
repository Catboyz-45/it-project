import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";

// หน้ากลางของฝั่งเจ้าของหอ พาไปยังหอแรกที่บัญชีนี้ดูแล
export default async function PropertyAdminPage() {
  const auth = await requirePageAuth();
  // ผู้ดูแลระบบมีพื้นที่ของตัวเอง ไม่ใช่หน้าทำงานของหอพัก
  if (auth.role === "SUPER_ADMIN") redirect("/super-admin");
  const property = await getDatabase().property.findFirst({
    where: { id: { in: auth.propertyIds }, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  if (property) redirect(`/admin/properties/${property.id}`);
  // ไม่มีหอที่ดูแลเลยก็บอกทางแก้ไปเลย ดีกว่าโชว์หน้าว่าง
  return <main><h1>ยังไม่มีหอพักที่ดูแล</h1><p>กรุณาติดต่อแอดมินใหญ่เพื่อมอบหมายหอพักให้บัญชีนี้</p></main>;
}
