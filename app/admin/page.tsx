import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LAST_PROPERTY_COOKIE } from "@/lib/last-property";
import { requirePageAuth } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";

// หน้ากลางของฝั่งเจ้าของหอ พาไปยังหอที่เปิดล่าสุด ไม่เคยเปิดก็ไปหอแรกที่บัญชีนี้ดูแล
export default async function PropertyAdminPage() {
  const auth = await requirePageAuth();
  // ผู้ดูแลระบบและผู้เช่ามีพื้นที่ของตัวเอง ไม่ใช่หน้าทำงานของหอพัก
  if (auth.role === "SUPER_ADMIN") redirect("/super-admin");
  if (auth.role === "TENANT") redirect("/tenant");
  const lastPropertyId = (await cookies()).get(LAST_PROPERTY_COOKIE)?.value;
  const [lastProperty, firstProperty] = await Promise.all([
    // คุกกี้แก้เองได้ จึงใช้ได้เฉพาะเมื่อบัญชียังดูแลหอนั้นและหอยังเปิดใช้งานอยู่
    lastPropertyId && auth.propertyIds.includes(lastPropertyId)
      ? getDatabase().property.findFirst({ where: { id: lastPropertyId, isActive: true }, select: { id: true } })
      : null,
    getDatabase().property.findFirst({
      where: { id: { in: auth.propertyIds }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true },
    }),
  ]);
  const property = lastProperty ?? firstProperty;
  if (property) redirect(`/admin/properties/${property.id}`);
  // ไม่มีหอที่ดูแลเลยก็บอกทางแก้ไปเลย ดีกว่าโชว์หน้าว่าง
  return <main><h1>ยังไม่มีหอพักที่ดูแล</h1><p>กรุณาติดต่อแอดมินใหญ่เพื่อมอบหมายหอพักให้บัญชีนี้</p></main>;
}
