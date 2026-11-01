
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PropertyEditForm } from "@/components/admin/PropertyEditForm";
import { SubscriptionOverrideButton } from "@/components/admin/SubscriptionOverrideForm";
import { SuperAdminPageHeader } from "@/components/admin/SuperAdminPageHeader";
import { requirePageAuth } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import { formatStatus } from "@/lib/ui-labels";
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai-format";

// หน้าดูรายละเอียดหอหนึ่งหอในมุมของซูเปอร์แอดมิน แก้ชื่อ เปิดปิดหอ และเปลี่ยนแพ็กเกจได้จากหน้านี้
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
      id: true,
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
  // การเปลี่ยนแพ็กเกจโดยผู้ดูแลระบบไม่มีคำสั่งซื้อ จึงดึงจากบันทึกการใช้งานมารวมในประวัติ
  const overrides = await getDatabase().auditLog.findMany({
    where: { propertyId, action: "PROPERTY_SUBSCRIPTION_ASSIGN", result: "SUCCESS" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, createdAt: true, targetType: true, targetId: true, user: { select: { displayName: true } } },
  });
  // บันทึกรุ่นเก่าเก็บ id หอไว้แทน id แพ็กเกจ แบบนั้นไม่รู้ชื่อแพ็กเกจ
  const overridePlanIds = overrides.flatMap((item) => item.targetType === "SaasPlan" && item.targetId ? [item.targetId] : []);
  const overridePlans = overridePlanIds.length
    ? await getDatabase().saasPlan.findMany({ where: { id: { in: overridePlanIds } }, select: { id: true, name: true } })
    : [];
  const planNames = new Map(overridePlans.map((plan) => [plan.id, plan.name]));
  const history = [
    ...property.subscriptionOrders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      reference: order.orderNumber,
      planName: order.planName,
      type: order.type === "RENEWAL" ? "ต่ออายุ" : "สมัครใหม่",
      amount: `฿${Number(order.amount).toLocaleString("th-TH")}`,
      status: formatStatus(order.status),
    })),
    ...overrides.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      reference: item.user?.displayName ?? "ผู้ดูแลระบบ",
      planName: (item.targetType === "SaasPlan" && item.targetId && planNames.get(item.targetId)) || "-",
      type: "ผู้ดูแลระบบเปลี่ยนแพ็กเกจ",
      amount: "-",
      status: "มีผลทันที",
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return (
    <>
      <SuperAdminPageHeader
        actions={<>
          <PropertyEditForm property={{ id: property.id, name: property.name, shortName: property.shortName, isActive: property.isActive }} />
          <SubscriptionOverrideButton property={{ id: property.id, name: property.name }} />
        </>}
        description={`${property.shortName} · สร้างเมื่อ ${formatThaiDate(property.createdAt)}`}
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
              {formatStatus(property.subscription.status)}
            </p>
            <p>
              <small className="block text-[#62646c]">รอบ</small>
              {property.subscription.billingInterval === "YEARLY"
                ? "รายปี"
                : "รายเดือน"}
            </p>
            <p>
              <small className="block text-[#62646c]">หมดอายุ</small>
              {formatThaiDate(property.subscription.expiresAt)}
            </p>
          </div>
        ) : (
          <p className="text-[#62646c]">ยังไม่มีแพ็กเกจ</p>
        )}
      </section>
      <section className="panel overflow-hidden p-0">
        <div className="p-5">
          <h2 className="text-base font-semibold">ประวัติแพ็กเกจและคำสั่งซื้อ</h2>
          <p className="text-sm text-[#62646c]">คำสั่งซื้อของเจ้าของหอ และการเปลี่ยนแพ็กเกจโดยผู้ดูแลระบบ</p>
        </div>
        <div className="figma-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">คำสั่งซื้อ / ผู้เปลี่ยน</th>
                <th scope="col">แพ็กเกจ</th>
                <th scope="col">ประเภท</th>
                <th scope="col">ยอด</th>
                <th scope="col">สถานะ</th>
                <th scope="col">วันที่</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.reference}</td>
                  <td>{item.planName}</td>
                  <td>{item.type}</td>
                  <td>{item.amount}</td>
                  <td>{item.status}</td>
                  <td>{formatThaiDateTime(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* ตารางว่างก็ยังแสดงหัวตารางไว้ แล้วเติมข้อความบอกไว้ใต้ตารางแทน */}
          {history.length === 0 ? (
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
