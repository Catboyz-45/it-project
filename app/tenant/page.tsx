// หน้าแรกผู้เช่า ดึงสามรายการสรุปบนเซิร์ฟเวอร์แล้วส่งลงไปกับ HTML
// เบราว์เซอร์จึงไม่ต้องยิงสามคำขอหลัง hydrate เสร็จ ซึ่งบนมือถือคือหลักร้อยมิลลิวินาที
//
// ห้องกับยอดแจ้งเตือนไม่ได้ดึงที่นี่ เพราะเปลือกใน layout โหลดไว้แล้วและใช้ร่วมกับป้ายบนเมนู
// ดึงซ้ำตรงนี้จะกลายเป็นเพิ่มคำสั่งฐานข้อมูล ไม่ใช่ลด
import { cookies } from "next/headers";
import { TenantSectionPanel } from "@/components/tenant/TenantPortal";
import { requirePageAuth } from "@/lib/server/auth";
import { listTenantParcels, listTenantTickets } from "@/lib/server/property-operations";
import { findActiveOccupancyForPage, tenantOccupancyCookieName } from "@/lib/server/tenant-auth";
import { listTenantInvoices } from "@/lib/server/tenant-portal";

export default async function TenantPage() {
  const auth = await requirePageAuth();
  const selectedId = (await cookies()).get(tenantOccupancyCookieName)?.value;
  const occupancy = auth.tenantProfileId
    ? await findActiveOccupancyForPage(auth.tenantProfileId, selectedId)
    : null;
  if (!occupancy || !auth.tenantProfileId) return <TenantSectionPanel tab="home" />;

  const pagination = { page: 1, pageSize: 5 };
  // ยิงพร้อมกัน ไม่มีตัวไหนต้องรอผลของอีกตัว
  // บิลเป็นของผู้เช่าหลักเท่านั้น ผู้พักร่วมข้ามไปเลยไม่ต้องถาม
  const [invoices, parcels, tickets] = await Promise.all([
    occupancy.role === "PRIMARY"
      ? listTenantInvoices(auth.tenantProfileId, occupancy.roomId, occupancy.role, pagination)
      : null,
    listTenantParcels(auth.tenantProfileId, occupancy.roomId, pagination),
    listTenantTickets(auth.tenantProfileId, auth.userId, pagination),
  ]);

  // ปกติข้อมูลชุดนี้เดินทางผ่าน JSON วันที่กับ Decimal จึงถึงหน้าจอเป็นสตริง
  // ส่งตรงจากเซิร์ฟเวอร์จะยังเป็น Date กับ Decimal อยู่ แปลงให้เหมือนกันด้วยวิธีเดียวกับที่ API ทำ
  return <TenantSectionPanel
    initialSummary={{
      invoices: invoices ? JSON.parse(JSON.stringify(invoices.data)) : null,
      parcels: JSON.parse(JSON.stringify(parcels.data)),
      tickets: JSON.parse(JSON.stringify(tickets.data)),
    }}
    tab="home"
  />;
}
