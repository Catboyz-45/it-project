// ป้ายและตัวเลขที่ช่วยให้หน้าประกาศ พัสดุ และสัญญาฝั่งผู้เช่าอ่านง่ายขึ้น
// เป็นฟังก์ชันล้วน ใช้ได้ทั้งบนเซิร์ฟเวอร์และในเบราว์เซอร์ เทียบวันตามเวลาไทยเสมอ
import { chatDayKey } from "@/lib/chat-time";

const timeZone = "Asia/Bangkok";
const dayMs = 86_400_000;

export type AnnouncementAudience = "ALL_TENANTS" | "BUILDING" | "FLOOR" | "ROOM";

// บอกว่าประกาศนี้ส่งถึงใคร ผู้เช่าจะรู้ทันทีว่าเรื่องนี้เกี่ยวกับตัวเองแค่ไหน
export function announcementAudienceLabel(input: {
  audience: AnnouncementAudience;
  buildingName?: string | null;
  floorLabel?: string | null;
  floorNumber?: number | null;
}) {
  if (input.audience === "ROOM") return "ห้องของคุณ";
  if (input.audience === "FLOOR") return input.floorLabel || (input.floorNumber != null ? `ชั้น ${input.floorNumber}` : "ชั้นของคุณ");
  if (input.audience === "BUILDING") return input.buildingName || "อาคารของคุณ";
  return "ทั้งหอ";
}

// ประกาศที่ออกไม่เกินเจ็ดวันนับว่าใหม่
export function isRecentAnnouncement(value: string | Date, now = new Date()) {
  const age = now.getTime() - new Date(value).getTime();
  return age >= 0 && age < 7 * dayMs;
}

// เวลาแบบ "2 ชั่วโมงที่แล้ว" ใช้เฉพาะในสัปดาห์นี้ เก่ากว่านั้นคืน null ให้แสดงวันที่แทน
export function relativeThaiTime(value: string | Date, now = new Date()) {
  const minutes = Math.floor((now.getTime() - new Date(value).getTime()) / 60_000);
  if (minutes < 0) return null;
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} ชั่วโมงที่แล้ว`;
  const days = calendarDaysBetween(value, now);
  if (days === 1) return "เมื่อวาน";
  if (days < 7) return `${days} วันที่แล้ว`;
  return null;
}

// คีย์เดือนแบบ YYYY-MM ตามเวลาไทย ใช้จัดกลุ่มรายการตามเดือน
export function thaiMonthKey(value: string | Date) {
  return chatDayKey(value).slice(0, 7);
}

export function thaiMonthLabel(value: string | Date) {
  return new Date(value).toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone });
}

// นับเป็นวันตามปฏิทินไทย ไม่ใช่ทุก 24 ชั่วโมง รับเข้าห้าทุ่มแล้วดูตอนเช้าก็นับเป็นหนึ่งวันแล้ว
export function calendarDaysBetween(from: string | Date, to: string | Date) {
  const start = Date.parse(`${chatDayKey(from)}T00:00:00.000Z`);
  const end = Date.parse(`${chatDayKey(to)}T00:00:00.000Z`);
  return Math.round((end - start) / dayMs);
}

// เกณฑ์เดียวกับฝั่งเจ้าของหอ ค้างเกินสามวันนับว่านานแล้ว
const parcelOverdueDays = 3;

export function parcelWaitBadge(registeredAt: string | Date, now = new Date()) {
  const days = Math.max(0, calendarDaysBetween(registeredAt, now));
  return {
    label: days === 0 ? "มาถึงวันนี้" : `รอ ${days} วัน`,
    tone: days > parcelOverdueDays ? "overdue" as const : "waiting" as const,
  };
}

// พัสดุที่รับไปแล้ว บอกว่ารอที่หอนานเท่าไรก่อนมารับ
export function parcelPickupSummary(registeredAt: string | Date, receivedAt: string | Date) {
  const days = Math.max(0, calendarDaysBetween(registeredAt, receivedAt));
  return days === 0 ? "รับในวันเดียวกัน" : `รอที่หอ ${days} วัน`;
}

// สัญญาใกล้หมดเหลือไม่เกินหกสิบวัน เวลาพอให้ตัดสินใจต่อสัญญาหรือแจ้งย้ายออก
const leaseEndingSoonDays = 60;

// วันเริ่มและวันสิ้นสุดเก็บเป็นวันที่ล้วน (เที่ยงคืน UTC) จึงเทียบกับวันนี้ตามเวลาไทยแบบวันต่อวัน
export function leaseTerm(startDate: string | Date, endDate: string | Date, now = new Date()) {
  const start = Date.parse(`${new Date(startDate).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const end = Date.parse(`${new Date(endDate).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const today = Date.parse(`${chatDayKey(now)}T00:00:00.000Z`);
  const totalDays = Math.max(1, Math.round((end - start) / dayMs));
  const elapsed = Math.min(totalDays, Math.max(0, Math.round((today - start) / dayMs)));
  const daysLeft = Math.round((end - today) / dayMs);
  const daysUntilStart = Math.round((start - today) / dayMs);
  return {
    daysLeft,
    daysUntilStart,
    months: Math.max(1, Math.round(totalDays / 30.4)),
    percent: Math.round((elapsed / totalDays) * 100),
    remainingLabel: leaseRemainingLabel(daysLeft, daysUntilStart),
    tone: daysLeft <= leaseEndingSoonDays ? "ending" as const : "normal" as const,
  };
}

function leaseRemainingLabel(daysLeft: number, daysUntilStart: number) {
  if (daysUntilStart > 0) return `เริ่มในอีก ${daysUntilStart} วัน`;
  if (daysLeft < 0) return "สิ้นสุดแล้ว";
  if (daysLeft === 0) return "สิ้นสุดวันนี้";
  if (daysLeft <= leaseEndingSoonDays) return `เหลืออีก ${daysLeft} วัน`;
  return `เหลืออีกประมาณ ${Math.round(daysLeft / 30)} เดือน`;
}
