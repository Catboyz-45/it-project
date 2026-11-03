import { isMeterUsageWithinLimit, MAX_MONTHLY_METER_USAGE } from "@/lib/domain/billing";

export type MeterDraftField = "previous" | "latest";
export type MeterDraftProblem = { field: MeterDraftField; message: string };

// ตรวจเลขที่กรอกไว้ของหนึ่งห้องก่อนบันทึก คืนปัญหาแรกที่เจอพร้อมบอกว่าช่องไหน หรือ null ถ้าผ่าน
// แยกข้อความตามสาเหตุ คนจดจะได้รู้ทันทีว่าลืมกรอกหรือพิมพ์ผิด ไม่ต้องเดาจากข้อความรวม ๆ
// previousText ว่างได้ คือห้องใหม่ที่ยังไม่มีเลขตั้งต้น
export function meterDraftProblem(previousText: string, latestText: string): MeterDraftProblem | null {
  const previousValue = previousText.trim();
  const latestValue = latestText.trim();
  const previous = Number(previousValue);
  const latest = Number(latestValue);
  if (previousValue !== "" && (!Number.isFinite(previous) || previous < 0)) {
    return { field: "previous", message: "เลขครั้งก่อนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป" };
  }
  if (latestValue === "") return { field: "latest", message: "ยังไม่ได้กรอกเลขล่าสุด" };
  if (!Number.isFinite(latest) || latest < 0) return { field: "latest", message: "เลขล่าสุดต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป" };
  if (previousValue === "") return null;
  if (latest < previous) {
    return { field: "latest", message: `เลขล่าสุด (${latest.toLocaleString("th-TH")}) น้อยกว่าเลขครั้งก่อน (${previous.toLocaleString("th-TH")}) มิเตอร์เดินหน้าอย่างเดียว` };
  }
  if (!isMeterUsageWithinLimit(previous, latest)) {
    return { field: "latest", message: `ใช้ไป ${(latest - previous).toLocaleString("th-TH")} หน่วย เกิน ${MAX_MONTHLY_METER_USAGE.toLocaleString("th-TH")} หน่วยต่อเดือน น่าจะพิมพ์ผิด` };
  }
  return null;
}
