// สถานะ "อ่านแล้ว" ของกระดิ่งแจ้งเตือน เก็บว่าแต่ละหัวข้อรับทราบไปแล้วกี่รายการ
// แบบเดิมจำเป็นคู่ "หัวข้อ:จำนวน" พอจัดการงานไปบางส่วนจนจำนวนลด เช่นจาก 3 เหลือ 2
// คู่ใหม่ไม่เคยถูกอ่าน กระดิ่งจึงเด้งเลขแดงกลับมาทั้งที่ไม่มีเรื่องใหม่เข้ามาเลย
// แบบนี้ถือว่ามีเรื่องใหม่เฉพาะตอนจำนวนเพิ่มเกินที่รับทราบไว้เท่านั้น

export type NotificationReadState = Record<string, number>;

type CountedItem = { count: number; id: string };

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// รูปแบบเก่า อาร์เรย์ของ "หัวข้อ:จำนวน" หัวข้อเดียวกันมีหลายคู่ได้ เอาจำนวนที่มากที่สุด
function parseLegacyEntries(entries: unknown[]): NotificationReadState {
  const state: NotificationReadState = {};
  for (const entry of entries) {
    if (typeof entry !== "string") continue;
    const separator = entry.lastIndexOf(":");
    const count = Number(entry.slice(separator + 1));
    const id = entry.slice(0, separator);
    if (separator > 0 && isCount(count)) state[id] = Math.max(state[id] ?? 0, count);
  }
  return state;
}

// รูปแบบปัจจุบัน object ของ หัวข้อ -> จำนวน เก็บเฉพาะค่าที่เป็นจำนวนนับจริง
function parseCountRecord(record: object): NotificationReadState {
  const state: NotificationReadState = {};
  for (const [id, count] of Object.entries(record)) {
    if (isCount(count)) state[id] = count;
  }
  return state;
}

// ค่าที่อ่านมาจาก localStorage เชื่อไม่ได้ทั้งหมด เสียหรือแปลกก็เริ่มใหม่จากว่าง
// รองรับรูปแบบเก่าที่เป็นอาร์เรย์ "หัวข้อ:จำนวน" ด้วย ผู้ใช้เดิมจะได้ไม่เห็นทุกอย่างกลับเป็นยังไม่อ่าน
export function parseNotificationReadState(raw: string | null): NotificationReadState {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (Array.isArray(parsed)) return parseLegacyEntries(parsed);
  if (parsed && typeof parsed === "object") return parseCountRecord(parsed);
  return {};
}

export function isNotificationUnread(state: NotificationReadState, item: CountedItem) {
  return item.count > (state[item.id] ?? 0);
}

// รับทราบตามจำนวนที่เห็นตอนนี้ ไม่ลดค่าที่รับทราบไว้มากกว่า
export function acknowledgeNotifications(state: NotificationReadState, items: CountedItem[]): NotificationReadState {
  const next = { ...state };
  for (const item of items) next[item.id] = Math.max(next[item.id] ?? 0, item.count);
  return next;
}

// งานลดลงเมื่อไหร่ ก็ลดค่าที่รับทราบตาม ไม่งั้นงานใหม่ที่เข้ามาแทนจะไม่ถูกนับว่าใหม่
// เช่นรับทราบไว้ 3 จัดการไป 1 เหลือ 2 แล้วมีใหม่เข้ามาเป็น 3 ต้องขึ้นว่ามีเรื่องใหม่
// คืน state เดิมกลับไปถ้าไม่มีอะไรเปลี่ยน ผู้เรียกจะได้ไม่ต้องเขียน localStorage ซ้ำทุกรอบ
export function settleNotificationReadState(state: NotificationReadState, items: CountedItem[]): NotificationReadState {
  let next: NotificationReadState | null = null;
  for (const item of items) {
    const acknowledged = state[item.id];
    if (acknowledged === undefined || acknowledged <= item.count) continue;
    next ??= { ...state };
    if (item.count > 0) next[item.id] = item.count;
    else delete next[item.id];
  }
  return next ?? state;
}
