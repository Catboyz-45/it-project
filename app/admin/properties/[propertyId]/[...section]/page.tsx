import { notFound } from "next/navigation";
import { OwnerSectionPanel } from "@/components/dorm/DormDashboard";
import { ownerPageFromSegments } from "@/lib/navigation-routes";
import { listLeases } from "@/lib/server/leases";
import { listParcels } from "@/lib/server/property-operations";

// [...section] รับได้ทุกเส้นทางย่อยของหอ ทำให้ทุกหน้าใช้ไฟล์เดียวกัน
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
  // เส้นทางที่ไม่รู้จักตอบว่าไม่พบ ค่ามาจาก URL ที่ผู้ใช้พิมพ์เองได้
  // ส่วน overview มีไฟล์ของตัวเองที่ระดับบน จึงไม่ควรมาโผล่ที่นี่
  if (!activePage || activePage === "overview") notFound();
  // หน้าบิลรับ ?tab=payments เพื่อเปิดมาที่แท็บตรวจการชำระเลย ใช้กับลิงก์จากการแจ้งเตือน
  const invoiceView = activePage === "invoices" && tab === "payments" ? "payments" : "invoices";
  // layout ตรวจสิทธิ์ในหอนี้ไปแล้ว ตรงนี้จึงดึงข้อมูลของหน้าได้เลย
  // ดึงเฉพาะหน้าที่ต้องใช้ หน้าอื่นได้ข้อมูลจาก read model ใน layout อยู่แล้ว
  // ดึงพร้อมกัน แต่ละหน้าใช้แค่ของตัวเอง หน้าอื่นได้ null ไปแล้วโหลดเองเหมือนเดิม
  const [initialParcels, initialLeases] = await Promise.all([
    activePage === "parcels" ? loadParcels(propertyId) : null,
    // สัญญาเปิดมาที่หน้าแรกโดยไม่มีคำค้น ตรงกับที่แผงยิงเองตอน mount
    activePage === "contracts" ? listLeases(propertyId, { page: 1, pageSize: 20 }) : null,
  ]);
  return <OwnerSectionPanel
    initialLeases={initialLeases ? JSON.parse(JSON.stringify(initialLeases)) : null}
    initialParcels={initialParcels}
    invoiceView={invoiceView}
    page={activePage}
  />;
}

// แปลงให้เป็นรูปเดียวกับที่หน้าจอใช้ ซึ่งปกติได้มาจาก API หลัง hydrate เสร็จ
async function loadParcels(propertyId: string) {
  const result = await listParcels(propertyId, { page: 1, pageSize: 50 });
  return {
    hasNextPage: result.pageInfo.hasNextPage,
    items: result.data.map((item) => ({
      id: item.id,
      imageUrl: item.imageUrl ?? undefined,
      note: item.note ?? "",
      roomId: item.room.number,
      tenantName: item.recipientTenant?.user.displayName ?? "พัสดุส่วนกลางของห้อง",
      registeredAt: item.registeredAt.toLocaleString("th-TH"),
      receivedAt: item.receivedAt ? item.receivedAt.toLocaleString("th-TH") : undefined,
      status: item.status === "WAITING" ? "waiting" as const : item.status === "RECEIVED" ? "received" as const : "cancelled" as const,
      updatedAt: item.updatedAt.toISOString(),
    })),
    summary: result.summary,
  };
}
