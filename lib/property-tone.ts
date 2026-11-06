// สีประจำหอในเมนูเลือกหอ แต่ละหอได้สีอ่อนของตัวเอง จะได้แยกด้วยตาได้เร็วกว่าอ่านชื่อ
// คิดจาก id ของหอ หอเดิมจึงได้สีเดิมทุกครั้งทุกเครื่อง ไม่เปลี่ยนตามลำดับในรายการ

export const propertyTones = ["blurple", "green", "teal", "pink", "orange", "sky"] as const;
export type PropertyTone = (typeof propertyTones)[number];

export function propertyTone(propertyId: string): PropertyTone {
  let hash = 0;
  for (const character of propertyId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return propertyTones[hash % propertyTones.length];
}
