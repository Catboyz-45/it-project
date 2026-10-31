// แปลงข้อมูลจากฐานข้อมูลให้เป็น JSON ล้วน ก่อนส่งจาก Server Component ไปให้ Client Component
// Prisma คืน Decimal กับ Date เป็น object ซึ่งส่งข้ามไปฝั่ง client ไม่ได้ การแปลงผ่าน JSON
// ทำให้ Decimal กลายเป็นสตริง (ผ่าน toJSON) และ Date เป็นสตริง ISO ตามที่หน้าจอฝั่ง client รอรับ
//
// ตั้งใจไม่ใช้ structuredClone เพราะมันคัดลอก Date และ Decimal เป็น object เหมือนเดิม
// ซึ่งไม่ได้ทำให้ข้อมูลส่งข้ามไปฝั่ง client ได้ จุดประสงค์ของฟังก์ชันนี้คือการแปลงชนิด ไม่ใช่การคัดลอก
// ชนิดเริ่มต้นเท่ากับที่ JSON.parse คืน เพื่อให้จุดที่เคยแปลงเองใช้แทนกันได้ทันที
export function toClientData<T = ReturnType<typeof JSON.parse>>(value: unknown): T {
  const json = JSON.stringify(value);
  // undefined แปลงเป็น JSON ไม่ได้ (stringify คืน undefined) จึงคืนค่าเดิมกลับไปตรง ๆ
  return (json === undefined ? value : JSON.parse(json)) as T;
}
