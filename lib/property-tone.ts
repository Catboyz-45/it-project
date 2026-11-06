// สีประจำหอในเมนูเลือกหอ แต่ละหอได้สีอ่อนของตัวเอง จะได้แยกด้วยตาได้เร็วกว่าอ่านชื่อ
// คิดจาก id ของหอ หอชุดเดิมจึงได้สีเดิมทุกครั้งทุกเครื่อง ไม่เปลี่ยนตามลำดับในรายการ

export const propertyTones = ["blurple", "green", "teal", "pink", "orange", "sky"] as const;
export type PropertyTone = (typeof propertyTones)[number];

function toneIndex(propertyId: string) {
  let hash = 0;
  for (const character of propertyId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % propertyTones.length;
}

// แจกสีให้ทั้งรายการทีเดียว สองหอที่สีจาก id ชนกันจะได้ไม่ดูเหมือนกัน หอหลังเลื่อนไปสีถัดไปที่ยังว่าง
// เรียงตาม id ก่อนแจก ผลจึงไม่ขึ้นกับลำดับที่แสดง หอชุดเดิมได้สีชุดเดิมเสมอ
// เกินหกหอค่อยยอมให้สีซ้ำ
export function assignPropertyTones(propertyIds: readonly string[]) {
  const tones = new Map<string, PropertyTone>();
  const used = new Set<number>();
  for (const id of [...new Set(propertyIds)].sort()) {
    let index = toneIndex(id);
    for (let step = 0; step < propertyTones.length && used.has(index); step += 1) index = (index + 1) % propertyTones.length;
    used.add(index);
    if (used.size === propertyTones.length) used.clear();
    tones.set(id, propertyTones[index]);
  }
  return tones;
}
