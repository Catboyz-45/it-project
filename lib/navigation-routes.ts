import type { PageKey } from "@/types/navigation";

// เส้นทางของทุกหน้าอยู่ที่นี่ที่เดียว ไม่มีที่ไหนเขียน URL เป็นสตริงตรง ๆ
// Record บังคับให้ทุกหน้ามีเส้นทาง เพิ่มหน้าใหม่แล้วลืมจะคอมไพล์ไม่ผ่าน
const ownerRouteByPage: Record<PageKey, string> = {
  // หน้าแรกไม่มีส่วนต่อท้าย URL จึงเป็นของหอพักเลย
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

// สร้างตารางย้อนกลับจากตารางเดิม จะได้ไม่ต้องดูแลสองที่ให้ตรงกัน
const ownerPageByRoute = new Map(
  Object.entries(ownerRouteByPage).map(([page, route]) => [route, page as PageKey]),
);

export function ownerPagePath(propertyId: string, page: PageKey) {
  const suffix = ownerRouteByPage[page];
  return `/admin/properties/${propertyId}${suffix ? `/${suffix}` : ""}`;
}

// แปลง URL กลับเป็นชื่อหน้า ไม่รู้จักก็คืน null เพราะค่ามาจาก URL ที่ผู้ใช้พิมพ์เองได้
export function ownerPageFromSegments(segments: string[] | undefined): PageKey | null {
  return ownerPageByRoute.get(segments?.join("/") ?? "") ?? null;
}

// as const ทำให้ TypeScript รู้ว่ามีแค่แปดค่านี้ ไม่ใช่ string อะไรก็ได้
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

export type TenantTab = (typeof tenantTabs)[number];

export function tenantPagePath(tab: TenantTab) {
  return tab === "home" ? "/tenant" : `/tenant/${tab}`;
}

// ไม่มีส่วนต่อท้ายเลยคือหน้าแรก ส่วนค่าที่ไม่รู้จักคืน null ให้ผู้เรียกตอบว่าไม่พบหน้า
export function tenantTabFromSegments(segments: string[] | undefined): TenantTab | null {
  const route = segments?.join("/") ?? "";
  if (!route) return "home";
  return tenantTabs.find((tab) => tab === route) ?? null;
}
