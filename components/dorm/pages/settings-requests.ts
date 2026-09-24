"use client";
// คำขอบันทึกการตั้งค่าหอ แยกออกจากคอมโพเนนต์ตามหลักไม่เอา logic ไว้ใน React
// ทั้งสองเส้นใช้ PUT ไม่ใช่ PATCH เพราะส่งค่าทั้งชุดไปแทนที่ของเดิม ไม่ได้แก้เฉพาะบางฟิลด์

import { createApiError } from "@/lib/client/api-error";
import type { RoomTypeSetting, ServiceChargeSetting } from "@/types/dashboard";

// ค่าทุกตัวในฟอร์มเก็บเป็นสตริง เพราะมาจากช่องกรอก แปลงเป็นตัวเลขตอนส่งที่นี่ที่เดียว
export type SettingsDraft = {
  businessName: string;
  contactEmail: string;
  contactPhone: string;
  dueDay: string;
  electricityUnitRate: string;
  invoicePrefix: string;
  lateFee: string;
  meterReadDay: string;
  paymentNote: string;
  promptPay: string;
  propertyAddress: string;
  waterExtraRate: string;
};

async function putJson(url: string, body: unknown, fallbackMessage: string) {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw createApiError(await response.json() as { error?: string; requestId?: string }, fallbackMessage);
  }
}

export function savePropertySettingsRequest(propertyId: string, settings: SettingsDraft) {
  return putJson(`/api/v1/admin/properties/${propertyId}/settings`, {
    legalName: settings.businessName.trim() || null,
    lessorName: null,
    address: settings.propertyAddress.trim(),
    contactPhone: settings.contactPhone.trim(),
    contactEmail: settings.contactEmail.trim() || null,
    promptPayId: settings.promptPay.trim() || null,
    waterUnitRate: Number(settings.waterExtraRate) || 0,
    electricityUnitRate: Number(settings.electricityUnitRate) || 0,
    // วันจดมิเตอร์เกิน 28 ไม่ได้ เพราะเดือนกุมภาพันธ์ไม่มีวันนั้น
    billingDay: Math.min(28, Math.max(1, Number(settings.meterReadDay) || 1)),
    dueDay: Math.min(31, Math.max(1, Number(settings.dueDay) || 5)),
    lateFeePerDay: Number(settings.lateFee) || 0,
    lateFeeCap: null,
    invoicePrefix: settings.invoicePrefix.trim() || "INV",
    invoiceFooter: settings.paymentNote.trim() || null,
  }, "บันทึกการตั้งค่าไม่สำเร็จ");
}

export function saveCatalogsRequest(propertyId: string, {
  defaultFurniture,
  furnitureOptions,
  roomTypes,
  serviceCharges,
}: {
  defaultFurniture: string[];
  furnitureOptions: string[];
  roomTypes: RoomTypeSetting[];
  serviceCharges: ServiceChargeSetting[];
}) {
  return putJson(`/api/v1/admin/properties/${propertyId}/catalogs`, {
    roomTypes: roomTypes.map(({ name, rent, deposit, capacity }) => ({ name, rent, deposit, capacity })),
    serviceCharges: serviceCharges.map(({ name, amount, frequency, calculation }) => ({ name, amount, frequency, calculation })),
    furnitureOptions: furnitureOptions.map((name) => ({ name, isDefault: defaultFurniture.includes(name) })),
  }, "บันทึกรายการตั้งค่าไม่สำเร็จ");
}
