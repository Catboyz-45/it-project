/**
 * หน้าที่ของไฟล์นี้: ฟังก์ชันช่วยเหลือ date ที่รวมตรรกะใช้ซ้ำและไม่มีหน้าจอเป็นของตัวเอง
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
export type DateInput = Date | string | number | null | undefined;

/** แปลงหรือจัดรูปข้อมูลด้วย toValidDate ให้ส่วนอื่นใช้รูปแบบเดียวกันอย่างคาดเดาได้ */
export function toValidDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** แปลงหรือจัดรูปข้อมูลด้วย formatThaiDate ให้ส่วนอื่นใช้รูปแบบเดียวกันอย่างคาดเดาได้ */
export function formatThaiDate(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string | undefined {
  const date = toValidDate(value);
  return date ? new Intl.DateTimeFormat("th-TH", options).format(date) : undefined;
}

/** แปลงหรือจัดรูปข้อมูลด้วย toIsoDate ให้ส่วนอื่นใช้รูปแบบเดียวกันอย่างคาดเดาได้ */
export function toIsoDate(value: DateInput): string | undefined {
  return toValidDate(value)?.toISOString();
}
