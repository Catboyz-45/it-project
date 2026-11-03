// วันที่และเวลาในหน้าต่างแชท อิงเวลาประเทศไทยเสมอ เครื่องผู้ใช้ตั้งเขตเวลาอื่นก็ยังขึ้น "วันนี้" ถูก

const timeZone = "Asia/Bangkok";
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone, year: "numeric" });

// คีย์วันแบบ YYYY-MM-DD ตามเวลาไทย ใช้เทียบว่าสองข้อความอยู่วันเดียวกันไหม
export function chatDayKey(value: string | Date) {
  return dayKeyFormat.format(new Date(value));
}

function isYesterday(value: string | Date, now: Date) {
  return chatDayKey(value) === chatDayKey(new Date(now.getTime() - 86_400_000));
}

// ป้ายคั่นวันในห้องสนทนา
export function chatDayLabel(value: string | Date, now = new Date()) {
  if (chatDayKey(value) === chatDayKey(now)) return "วันนี้";
  if (isYesterday(value, now)) return "เมื่อวาน";
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone });
}

export function chatTime(value: string | Date) {
  return new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", hour12: false, minute: "2-digit", timeZone });
}

// เวลาท้ายแถวในรายชื่อแชท วันนี้บอกเป็นเวลา เมื่อวานบอกเป็นคำ เก่ากว่านั้นบอกวันที่สั้น ๆ
export function chatListTime(value: string | Date, now = new Date()) {
  if (chatDayKey(value) === chatDayKey(now)) return chatTime(value);
  if (isYesterday(value, now)) return "เมื่อวาน";
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone });
}

// เลขห้องในวงกลมรูปโปรไฟล์ ตัดตัวอักษรอาคารออกให้เหลือเลขที่พอดีวง เช่น E101 เป็น 101
// ชื่อเต็มยังอยู่ข้าง ๆ วงกลม จึงไม่สับสนว่าอาคารไหน
export function chatRoomBadge(roomNumber: string) {
  const digits = roomNumber.match(/\d+$/)?.[0];
  if (digits && digits.length <= 4) return digits;
  return roomNumber.slice(0, 3);
}
