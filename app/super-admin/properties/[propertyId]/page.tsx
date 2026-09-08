/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นหน้าจอของเส้นทาง /super-admin/properties/[propertyId] ใน Next.js App Router
 * การทำงาน: ประกอบข้อมูลจากฝั่งเซิร์ฟเวอร์กับคอมโพเนนต์ที่นำมาใช้ซ้ำ; การตรวจสิทธิ์สำคัญต้องเกิดบนเซิร์ฟเวอร์ก่อนแสดงข้อมูล
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { requirePageAuth } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Property Detail Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { params, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const auth = await requirePageAuth();
  if (auth.role !== "SUPER_ADMIN") redirect("/admin");
  const { propertyId } = await params;
  const property = await getDatabase().property.findUnique({
    where: { id: propertyId },
    select: {
      name: true,
      shortName: true,
      isActive: true,
      createdAt: true,
      _count: { select: { rooms: true, occupancies: true, memberships: true } },
      memberships: {
        select: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              isActive: true,
            },
          },
        },
      },
      subscription: {
        select: {
          planName: true,
          status: true,
          billingInterval: true,
          startsAt: true,
          expiresAt: true,
          maxRooms: true,
        },
      },
      subscriptionOrders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          orderNumber: true,
          planName: true,
          type: true,
          status: true,
          billingInterval: true,
          amount: true,
          createdAt: true,
          paidAt: true,
        },
      },
    },
  });
  if (!property) notFound();
  return (
    <>
      <SuperAdminPageHeader
        description={`${property.shortName} · สร้างเมื่อ ${property.createdAt.toLocaleDateString("th-TH")}`}
        title={property.name}
      />
      <Link
        className="secondary-button inline-flex"
        href="/super-admin/properties"
      >
        ← กลับรายการหอพัก
      </Link>
      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["สถานะ", property.isActive ? "ใช้งาน" : "ปิดใช้งาน"],
          ["ห้อง", property._count.rooms],
          ["ผู้ดูแล", property._count.memberships],
          ["รายการเข้าพัก", property._count.occupancies],
        ].map(([label, value]) => (
          <article className="panel" key={label}>
            <small className="text-[#62646c]">{label}</small>
            <strong className="mt-2 block text-2xl">{value}</strong>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2 className="mb-4 text-xl font-black">แพ็กเกจปัจจุบัน</h2>
        {property.subscription ? (
          <div className="grid gap-3 md:grid-cols-4">
            <p>
              <small className="block text-[#62646c]">แพ็กเกจ</small>
              {property.subscription.planName}
            </p>
            <p>
              <small className="block text-[#62646c]">สถานะ</small>
              {property.subscription.status}
            </p>
            <p>
              <small className="block text-[#62646c]">รอบ</small>
              {property.subscription.billingInterval === "YEARLY"
                ? "รายปี"
                : "รายเดือน"}
            </p>
            <p>
              <small className="block text-[#62646c]">หมดอายุ</small>
              {property.subscription.expiresAt.toLocaleDateString("th-TH")}
            </p>
          </div>
        ) : (
          <p className="text-[#62646c]">ยังไม่มีแพ็กเกจ</p>
        )}
      </section>
      <section className="panel overflow-hidden p-0">
        <div className="p-5">
          <h2 className="text-xl font-black">ประวัติ Subscription</h2>
          <p className="text-sm text-[#62646c]">คำสั่งซื้อและการต่ออายุล่าสุด</p>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>คำสั่งซื้อ</th>
                <th>แพ็กเกจ</th>
                <th>ประเภท</th>
                <th>ยอด</th>
                <th>สถานะ</th>
                <th>วันที่</th>
              </tr>
            </thead>
            <tbody>
              {property.subscriptionOrders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.planName}</td>
                  <td>{order.type === "RENEWAL" ? "ต่ออายุ" : "สมัครใหม่"}</td>
                  <td>฿{Number(order.amount).toLocaleString("th-TH")}</td>
                  <td>{order.status}</td>
                  <td>{order.createdAt.toLocaleString("th-TH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {property.subscriptionOrders.length === 0 ? (
            <p className="p-8 text-center text-[#62646c]">ยังไม่มีประวัติ</p>
          ) : null}
        </div>
      </section>
      <section className="panel">
        <h2 className="mb-4 text-xl font-black">บัญชีผู้ดูแล</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {property.memberships.map(({ user }) => (
            <div
              className="rounded-xl border border-[#d9dae0] p-3"
              key={user.id}
            >
              <strong>{user.displayName}</strong>
              <small className="block text-[#62646c]">
                {user.email} · {user.isActive ? "ใช้งาน" : "ระงับ"}
              </small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
