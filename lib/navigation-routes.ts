/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโมดูลกลาง “navigation routes” ที่รวม type ค่าคงที่ หรือฟังก์ชันซึ่งหลายส่วนของระบบใช้ร่วมกัน
 * การทำงาน: ช่วยให้กฎและรูปแบบข้อมูลมีแหล่งอ้างอิงเดียว ลดความซ้ำ และทำให้เปลี่ยนพฤติกรรมได้โดยแก้จุดเดียว
 */

import type { PageKey } from "@/types/navigation";

const ownerRouteByPage: Record<PageKey, string> = {
  overview: "",
  rooms: "rooms",
  tenants: "tenants",
  contracts: "contracts",
  waterMeter: "meters/water",
  electricMeter: "meters/electricity",
  invoices: "invoices",
  complaints: "tickets",
  repairHistory: "tickets/history",
  parcels: "parcels",
  announcements: "announcements",
  invitations: "invitations",
  subscription: "subscription",
  help: "help",
  properties: "properties",
  account: "account",
  settings: "settings",
};

const ownerPageByRoute = new Map(
  Object.entries(ownerRouteByPage).map(([page, route]) => [route, page as PageKey]),
);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “owner Page Path” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function ownerPagePath(propertyId: string, page: PageKey) {
  const suffix = ownerRouteByPage[page];
  return `/admin/properties/${propertyId}${suffix ? `/${suffix}` : ""}`;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “owner Page From Segments” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - segments: ค่า “segments” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด PageKey | null ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function ownerPageFromSegments(segments: string[] | undefined): PageKey | null {
  return ownerPageByRoute.get(segments?.join("/") ?? "") ?? null;
}

export const tenantTabs = [
  "home",
  "invoices",
  "lease",
  "announcements",
  "parcels",
  "tickets",
  "chat",
  "account",
] as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Tenant Tab” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type TenantTab = (typeof tenantTabs)[number];

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “tenant Page Path” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - tab: ค่า “tab” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function tenantPagePath(tab: TenantTab) {
  return tab === "home" ? "/tenant" : `/tenant/${tab}`;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “tenant Tab From Segments” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - segments: ค่า “segments” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด TenantTab | null ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function tenantTabFromSegments(segments: string[] | undefined): TenantTab | null {
  const route = segments?.join("/") ?? "";
  if (!route) return "home";
  return tenantTabs.find((tab) => tab === route) ?? null;
}
