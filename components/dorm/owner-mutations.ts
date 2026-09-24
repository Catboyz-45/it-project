"use client";
// คำขอแก้ข้อมูลของพื้นที่เจ้าของหอ แยกออกจากคอมโพเนนต์ตามหลักไม่เอา logic ไว้ใน React
// ทุกตัวโยน error พร้อมข้อความจากเซิร์ฟเวอร์ ผู้เรียกจึงจัดการการแสดงผลได้ที่เดียว
// การตรวจสิทธิ์จริงอยู่ที่เซิร์ฟเวอร์เสมอ ฝั่งนี้เป็นแค่การช่วยผู้ใช้ให้รู้ตัวก่อน

import type { Room, Tenant } from "@/types/dorm";

export type MeterReadingInput = {
  roomId: string;
  type: "WATER" | "ELECTRICITY";
  billingMonth: string;
  previousReading?: number;
  currentReading: number;
};

// ฐานข้อมูลเก็บ "-" แทนค่าว่างในบางฟิลด์ แปลงกลับเป็น null ก่อนส่งขึ้นเซิร์ฟเวอร์
function optionalTenantText(value: string) {
  const normalized = value.trim();
  return normalized && normalized !== "-" ? normalized : null;
}

// ยิงคำขอแก้ข้อมูลแล้วโยน error พร้อมข้อความจากเซิร์ฟเวอร์เมื่อไม่สำเร็จ
async function sendJson(url: string, method: string, body: unknown, fallbackMessage: string) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(((await response.json()) as { error?: string }).error || fallbackMessage);
  }
}

// ป้ายภาษาไทยที่ผู้ใช้เลือก แปลงเป็นค่า enum ที่เซิร์ฟเวอร์รู้จัก ไม่ตรงข้อไหนคือไม่มีรถ
const vehicleTypes = new Map<string, string>([
  ["รถจักรยานยนต์", "MOTORCYCLE"],
  ["รถยนต์", "CAR"],
  ["รถจักรยาน", "BICYCLE"],
  ["อื่น ๆ", "OTHER"],
]);

// ข้อมูลผู้เช่าส่วนที่ทุกหน้าต่างแก้ไขเหมือนกัน รวมไว้ที่เดียวกันไม่ให้เขียนซ้ำ
function tenantContactBody(tenant: Tenant) {
  return {
    displayName: tenant.name,
    phone: tenant.phone,
    address: optionalTenantText(tenant.address),
    emergencyName: optionalTenantText(tenant.guardianName),
    emergencyPhone: optionalTenantText(tenant.guardianPhone),
  };
}

// บันทึกมิเตอร์ทั้งชุดในคำขอเดียว ห้องเยอะจะได้ไม่ต้องยิงทีละห้อง
export function saveMetersRequest(propertyId: string, readings: MeterReadingInput[]) {
  return sendJson(`/api/v1/admin/properties/${propertyId}/meter-readings/bulk`, "POST", { readings }, "บันทึกมิเตอร์ไม่สำเร็จ");
}

export function saveRoomRequest(propertyId: string, room: Room) {
  if (!room.databaseId) throw new Error("ไม่พบรหัสห้องในฐานข้อมูล");
  return sendJson(`/api/v1/admin/properties/${propertyId}/rooms/${room.databaseId}`, "PATCH", {
    roomType: room.roomType,
    monthlyRent: room.rent,
    floorId: room.floorId,
    // ห้องที่มีคนอยู่เปลี่ยนสถานะจากหน้านี้ไม่ได้ ต้องไปทำผ่านขั้นตอนย้ายเข้าย้ายออก
    ...(room.status === "occupied" ? {} : { status: room.status === "maintenance" ? "MAINTENANCE" : "AVAILABLE" }),
    furniture: room.furniture,
  }, "บันทึกห้องไม่สำเร็จ");
}

export function saveTenantRequest(propertyId: string, tenant: Tenant) {
  return sendJson(`/api/v1/admin/properties/${propertyId}/tenants/${tenant.id}`, "PATCH", tenantContactBody(tenant), "บันทึกผู้เช่าไม่สำเร็จ");
}

// หน้ารายละเอียดผู้เช่าแก้ข้อมูลรถได้ด้วย จึงส่งฟิลด์มากกว่าหน้าต่างแก้ไขปกติ
export function saveTenantDetailRequest(propertyId: string, tenant: Tenant) {
  const vehicleType = vehicleTypes.get(tenant.vehicleType);
  return sendJson(`/api/v1/admin/properties/${propertyId}/tenants/${tenant.id}`, "PATCH", {
    ...tenantContactBody(tenant),
    vehicle: vehicleType ? {
      type: vehicleType,
      licensePlate: tenant.vehiclePlate,
      province: tenant.vehicleProvince || null,
      brandModel: tenant.vehicleBrand || null,
      color: tenant.vehicleColor || null,
      detail: tenant.vehicleDetail || null,
    } : null,
  }, "บันทึกผู้เช่าไม่สำเร็จ");
}
