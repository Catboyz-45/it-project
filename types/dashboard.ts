import type { Invoice, Room, Tenant } from "@/types/dorm";
import type { OwnerRepairTicket } from "@/types/repairs";

// พัสดุหนึ่งชิ้น receivedAt ว่างแปลว่ายังไม่มีคนมารับ จึงเป็น optional
export type ParcelRecord = {
  id: string;
  imageUrl?: string;
  note: string;
  roomId: string;
  tenantName: string;
  receivedAt?: string;
  registeredAt: string;
  status: "waiting" | "received";
};

// ประกาศหนึ่งเรื่อง สถานะเก็บเป็นข้อความไทยตรง ๆ เพราะใช้แสดงบนป้ายโดยไม่ต้องแปลอีกรอบ
export type AnnouncementRecord = {
  audience: string;
  content: string;
  date: string;
  id: string;
  status: "เผยแพร่แล้ว" | "ตั้งเวลา";
  title: string;
  updatedAt?: string;
};

// เรื่องร้องเรียนหนึ่งเรื่อง owner คือคนที่รับผิดชอบติดตาม ไม่ใช่คนที่ร้องเรียน
export type ComplaintRecord = {
  id: string;
  title: string;
  room: string;
  owner: string;
  date: string;
  status: "รับเรื่องแล้ว" | "กำลังตรวจสอบ" | "แก้ไขแล้ว";
};

// ประเภทห้องที่หอตั้งเอง ใช้เป็นค่าตั้งต้นของค่าเช่าและค่ามัดจำตอนสร้างห้องใหม่
export type RoomTypeSetting = {
  id: string;
  name: string;
  rent: number;
  deposit: number;
  capacity: number;
};

// ค่าบริการเพิ่มเติม calculation บอกว่าคิดต่อห้องหรือต่อคน ทำให้ห้องที่อยู่หลายคนคิดเงินต่างกันได้
export type ServiceChargeSetting = {
  id: string;
  name: string;
  amount: number;
  frequency: "monthly" | "once";
  calculation: "room" | "person";
};

// ชั้นหนึ่งชั้น พ่วงชื่อตึกมาด้วยเพื่อให้ dropdown แสดงได้เลยโดยไม่ต้องไปหาชื่อตึกอีกรอบ
export type FloorDirectorySetting = {
  id: string;
  number: number;
  buildingId: string;
  buildingName: string;
};

// ค่าตั้งของหอทั้งหมดที่หน้าตั้งค่าใช้ รวมมาเป็นก้อนเดียวเพื่อยิงขอครั้งเดียวจบ
// lateFeeCap เป็น null ได้ หมายถึงไม่จำกัดเพดานค่าปรับ ต่างจาก undefined ที่แปลว่ายังไม่ได้ตั้ง
export type PropertySettingsReadModel = {
  propertyName: string;
  legalName?: string;
  address?: string;
  contactPhone?: string;
  contactEmail?: string;
  promptPayId?: string;
  waterExtraRate?: number;
  electricityUnitRate?: number;
  invoicePrefix?: string;
  meterReadDay?: number;
  dueDay?: number;
  lateFeePerDay?: number;
  lateFeeCap?: number | null;
  invoiceFooter?: string;
  floorDirectory: FloorDirectorySetting[];
  roomTypes: RoomTypeSetting[];
  serviceCharges: ServiceChargeSetting[];
  furnitureOptions: string[];
  defaultFurniture: string[];
};

// ข้อมูลทั้งพื้นที่ทำงานของเจ้าของหอในก้อนเดียว ประกอบจากตารางปกติทุกครั้งที่ขอ
// เป็นแค่รูปของคำตอบ ไม่เคยถูกเก็บเป็น JSON ลงฐานข้อมูล
export type OwnerWorkspaceReadModel = {
  rooms: Room[];
  tenants: Tenant[];
  invoices: Invoice[];
  repairs: OwnerRepairTicket[];
  parcels: ParcelRecord[];
  announcements: AnnouncementRecord[];
  complaints: ComplaintRecord[];
  settings: PropertySettingsReadModel;
};

// ตัวเลขสรุปของแดชบอร์ดเจ้าของหอ นับมาจากฝั่งเซิร์ฟเวอร์ทั้งหมด
export type OwnerDashboardAggregation = {
  property: { id: string; name: string };
  rooms: {
    total: number;
    occupied: number;
    available: number;
    maintenance: number;
    occupancyRate: number;
  };
  activeOccupancies: number;
  pendingOccupancies: number;
  finance: {
    billed: number;
    collected: number;
    outstanding: number;
    overdueInvoices: number;
    pendingPayments: number;
  };
  operations: {
    openTickets: number;
    waitingParcels: number;
    unreadTenantMessages: number;
    expiringLeases: number;
  };
  // เป็น null ได้ หอที่ยังไม่ซื้อแพ็กเกจจะไม่มีข้อมูลส่วนนี้
  subscription: {
    accessMode: "FULL" | "GRACE" | "READ_ONLY";
    graceEndsAt: string | Date | null;
    isReadOnly: boolean;
    planCode: string | null;
    planName: string;
    status: string;
    billingInterval: string;
    priceAmount: string;
    startsAt: string | Date;
    expiresAt: string | Date;
    maxRooms: number;
    usedRooms: number;
    roomUsagePercent: number;
  } | null;
  // ข้อมูลกราฟย้อนหลังรายเดือน ให้เห็นว่าเก็บเงินได้ตามที่ออกบิลไปหรือไม่
  trends: Array<{
    month: string;
    billed: number;
    collected: number;
    outstanding: number;
  }>;
  generatedAt: string | Date;
};
