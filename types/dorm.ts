// สถานะห้องฝั่งหน้าจอ เขียนเป็นตัวพิมพ์เล็กเพราะใช้เป็นคลาส CSS และคีย์ของป้ายสีด้วย
export type RoomStatus = "available" | "occupied" | "maintenance";
// สถานะบิล เรียงตามวงจรจริง ตั้งแต่ร่างจนจ่ายเสร็จหรือยกเลิก
export type PaymentStatus = "draft" | "paid" | "pending" | "overdue" | "cancelled";
// สถานะแจ้งซ่อมแบบย่อที่ผู้เช่าเห็น ฝั่งเจ้าของหอมีสถานะละเอียดกว่าอยู่ใน types/repairs.ts
export type RepairStatus = "new" | "scheduled" | "done";
// เอกสารของผู้เช่ามีสามสถานะ รวม notRequired ไว้ด้วยเพราะบางหอไม่ได้บังคับเก็บทุกใบ
export type TenantDocumentStatus = "received" | "pending" | "notRequired";

// ห้องในมุมของหน้าจอ id เป็นเลขห้องที่คนอ่าน ส่วน databaseId คือคีย์จริงในฐานข้อมูล
// แยกสองตัวเพราะหน้าจอโชว์เลขห้อง แต่ตอนยิง API ต้องใช้คีย์จริง
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

// ข้อมูลผู้เช่าหนึ่งคน ฟิลด์ที่เป็น optional คือของที่กรอกเพิ่มทีหลังได้ ไม่บังคับตอนสร้าง
// วันที่ทุกตัวเป็นสตริงรูปแบบ ISO เพราะส่งผ่าน JSON มาจากฝั่งเซิร์ฟเวอร์
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
  // ผู้พักร่วมเก็บแค่ชื่อกับบทบาทพอ รายละเอียดเต็มอยู่ที่แถวของคนนั้นเอง
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

// บิลหนึ่งใบฝั่งหน้าจอ แยกค่าเช่า น้ำ ไฟ ส่วนกลาง ออกจากกันเพื่อให้แสดงเป็นรายการย่อยได้
// version ใช้กันการแก้ทับกัน ส่งเลขเดิมกลับไปแล้วไม่ตรงแปลว่ามีคนแก้ไปก่อนแล้ว
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

// ใบแจ้งซ่อมแบบย่อ ใช้ในรายการรวม ส่วนของเจ้าของหอที่มีรายละเอียดมากกว่าอยู่ใน types/repairs.ts
export interface RepairTicket {
  id: string;
  roomId: string;
  title: string;
  detail: string;
  status: RepairStatus;
  requestedAt: string;
}
