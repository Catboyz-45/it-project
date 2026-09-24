
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { requirePageAuth } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";

// หน้าดูรายละเอียดหอหนึ่งหอในมุมของซูเปอร์แอดมิน อ่านอย่างเดียว ไม่มีปุ่มแก้ไข
export default async function PropertyDetailPage({
  params,
}: Readonly<{
  params: Promise<{ propertyId: string }>;
}>) {
  // เช็คบทบาทซ้ำที่หน้านี้ด้วย ถึงแม้ layout จะเช็คไปแล้ว เพราะหน้านี้อ่านข้อมูลของทุกหอ
  const auth = await requirePageAuth();
  if (auth.role !== "SUPER_ADMIN") redirect("/admin");
  // Next 16 ส่ง params มาเป็น Promise ต้อง await ก่อนใช้
  const { propertyId } = await params;
  // ดึงทุกอย่างที่หน้านี้ใช้ในคำสั่งเดียว หอ ผู้ดูแล แพ็กเกจ และประวัติคำสั่งซื้อ
  const property = await getDatabase().property.findUnique({
    where: { id: propertyId },
    select: {
      name: true,
      shortName: true,
      isActive: true,
      createdAt: true,
      // ให้ฐานข้อมูลนับให้ ไม่ต้องดึงทุกแถวออกมานับเองที่นี่
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
      // จำกัด 50 รายการล่าสุด หอที่ต่ออายุมานานจะได้ไม่ดึงประวัติทั้งหมดออกมา
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
  // ไม่เจอก็ตอบ 404 ไม่ต้องแยกว่าไม่มีจริงหรือถูกลบไปแล้ว
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
      {/* การ์ดสรุปสี่ใบ เขียนเป็นอาร์เรย์แล้ววนออกมา จะได้ไม่ต้องก๊อป markup ซ้ำสี่รอบ */}
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
        <h2 className="mb-4 text-base font-semibold">แพ็กเกจปัจจุบัน</h2>
        {/* หอที่เพิ่งสร้างยังไม่มีแพ็กเกจ ต้องมีข้อความรองรับ ไม่ใช่ปล่อยว่าง */}
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
          <h2 className="text-base font-semibold">ประวัติ Subscription</h2>
          <p className="text-sm text-[#62646c]">คำสั่งซื้อและการต่ออายุล่าสุด</p>
        </div>
        <div className="figma-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">คำสั่งซื้อ</th>
                <th scope="col">แพ็กเกจ</th>
                <th scope="col">ประเภท</th>
                <th scope="col">ยอด</th>
                <th scope="col">สถานะ</th>
                <th scope="col">วันที่</th>
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
          {/* ตารางว่างก็ยังแสดงหัวตารางไว้ แล้วเติมข้อความบอกไว้ใต้ตารางแทน */}
          {property.subscriptionOrders.length === 0 ? (
            <p className="p-8 text-center text-[#62646c]">ยังไม่มีประวัติ</p>
          ) : null}
        </div>
      </section>
      <section className="panel">
        <h2 className="mb-4 text-base font-semibold">บัญชีผู้ดูแล</h2>
        {/* แสดงอีเมลผู้ดูแลได้เพราะหน้านี้เปิดให้เฉพาะซูเปอร์แอดมิน */}
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
