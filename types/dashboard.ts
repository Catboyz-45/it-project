/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: รวม TypeScript type ของ “dashboard” เพื่อบอกโครงสร้างข้อมูลที่ส่วนต่าง ๆ ต้องใช้ร่วมกัน
 * การทำงาน: ไม่มีข้อมูลจริงอยู่ในไฟล์นี้ แต่ช่วยให้ compiler แจ้งเตือนเมื่อส่งข้อมูลผิดรูปแบบก่อนนำระบบไปรัน
 */

import type { Invoice, Room, Tenant } from "@/types/dorm";
import type { OwnerRepairTicket } from "@/types/repairs";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Parcel Record” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Announcement Record” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type AnnouncementRecord = {
  audience: string;
  content: string;
  date: string;
  id: string;
  status: "เผยแพร่แล้ว" | "ตั้งเวลา";
  title: string;
  updatedAt?: string;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Complaint Record” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ComplaintRecord = {
  id: string;
  title: string;
  room: string;
  owner: string;
  date: string;
  status: "รับเรื่องแล้ว" | "กำลังตรวจสอบ" | "แก้ไขแล้ว";
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Room Type Setting” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type RoomTypeSetting = {
  id: string;
  name: string;
  rent: number;
  deposit: number;
  capacity: number;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Service Charge Setting” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ServiceChargeSetting = {
  id: string;
  name: string;
  amount: number;
  frequency: "monthly" | "once";
  calculation: "room" | "person";
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Floor Directory Setting” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type FloorDirectorySetting = {
  id: string;
  number: number;
  buildingId: string;
  buildingName: string;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Property Settings Read Model” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
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

/**
 * Owner-facing projection assembled exclusively from normalized relational
 * tables. This is a response DTO and is never persisted as a JSON document.
 */
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Owner Workspace Read Model” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Owner Dashboard Aggregation” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
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
  trends: Array<{
    month: string;
    billed: number;
    collected: number;
    outstanding: number;
  }>;
  generatedAt: string | Date;
};
