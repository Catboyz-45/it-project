/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: รวม TypeScript type ของ “dorm” เพื่อบอกโครงสร้างข้อมูลที่ส่วนต่าง ๆ ต้องใช้ร่วมกัน
 * การทำงาน: ไม่มีข้อมูลจริงอยู่ในไฟล์นี้ แต่ช่วยให้ compiler แจ้งเตือนเมื่อส่งข้อมูลผิดรูปแบบก่อนนำระบบไปรัน
 */

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Room Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type RoomStatus = "available" | "occupied" | "maintenance";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Payment Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type PaymentStatus = "draft" | "paid" | "pending" | "overdue" | "cancelled";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Repair Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type RepairStatus = "new" | "scheduled" | "done";
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Tenant Document Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type TenantDocumentStatus = "received" | "pending" | "notRequired";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: interface “Room” ระบุว่าข้อมูลต้องมีฟิลด์อะไร เพื่อให้หลายส่วนส่งข้อมูลตรงรูปแบบกัน
 */
export interface Room {
  id: string;
  databaseId?: string;
  buildingId?: string;
  buildingName?: string;
  floorId?: string;
  floor: number;
  rent: number;
  roomType: string;
  furniture: string[];
  status: RoomStatus;
  tenantId?: string;
  waterMeter: number;
  electricMeter: number;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: interface “Tenant” ระบุว่าข้อมูลต้องมีฟิลด์อะไร เพื่อให้หลายส่วนส่งข้อมูลตรงรูปแบบกัน
 */
export interface Tenant {
  id: string;
  role?: "PRIMARY" | "CO_OCCUPANT";
  name: string;
  prefix?: string;
  nickname?: string;
  birthDate?: string;
  nationality?: string;
  nationalId?: string;
  phone: string;
  email?: string;
  lineId?: string;
  roomId: string;
  address: string;
  occupation?: string;
  organization?: string;
  studentOrEmployeeId?: string;
  guardianName: string;
  guardianRelation?: string;
  guardianPhone: string;
  occupantCount?: number;
  coOccupants?: Array<{
    id: string;
    name: string;
    role: "PRIMARY" | "CO_OCCUPANT";
  }>;
  vehicleType: string;
  vehiclePlate: string;
  vehicleProvince?: string;
  vehicleBrand?: string;
  vehicleColor?: string;
  vehicleDetail: string;
  startDate: string;
  contractEnd?: string;
  deposit: number;
  monthlyRent?: number;
  leaseNumber?: string;
  leaseStatus?: "DRAFT" | "PENDING_SIGNATURE" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "CANCELLED";
  idDocumentStatus?: TenantDocumentStatus;
  contractDocumentStatus?: TenantDocumentStatus;
  note?: string;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: interface “Invoice” ระบุว่าข้อมูลต้องมีฟิลด์อะไร เพื่อให้หลายส่วนส่งข้อมูลตรงรูปแบบกัน
 */
export interface Invoice {
  id: string;
  databaseId?: string;
  version?: number;
  roomId: string;
  tenantName: string;
  month: string;
  rent: number;
  water: number;
  electricity: number;
  service: number;
  status: PaymentStatus;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: interface “Repair Ticket” ระบุว่าข้อมูลต้องมีฟิลด์อะไร เพื่อให้หลายส่วนส่งข้อมูลตรงรูปแบบกัน
 */
export interface RepairTicket {
  id: string;
  roomId: string;
  title: string;
  detail: string;
  status: RepairStatus;
  requestedAt: string;
}
