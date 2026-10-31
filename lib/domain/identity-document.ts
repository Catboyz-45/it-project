// เลขบัตรประชาชนไทยหรือเลขหนังสือเดินทาง ใช้ทั้งฝั่งหน้าจอและเซิร์ฟเวอร์ให้ตัดสินตรงกัน

// ผู้ใช้มักพิมพ์ขีดหรือเว้นวรรคตามที่เห็นบนบัตร ตัดทิ้งก่อนตรวจและก่อนเก็บ
export function normalizeIdentityDocumentNumber(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

// หลักที่ 13 ของบัตรประชาชนคือเลขตรวจสอบ คูณหลักที่ 1-12 ด้วย 13 ลงไปถึง 2 แล้วนำผลรวมมาคำนวณ
// ช่วยจับเลขที่พิมพ์ผิดหนึ่งหลักหรือสลับหลักได้ตั้งแต่ตอนกรอก
export function isValidThaiNationalId(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  const sum = [...value.slice(0, 12)].reduce((total, digit, index) => total + Number(digit) * (13 - index), 0);
  return (11 - (sum % 11)) % 10 === Number(value[12]);
}

// ตัวเลขล้วน 13 หลักถือเป็นบัตรประชาชน ต้องผ่านเลขตรวจสอบ
// แบบอื่นถือเป็นหนังสือเดินทาง ยอมเฉพาะตัวอักษรอังกฤษกับตัวเลข 6-20 ตัว
export function isValidIdentityDocumentNumber(value: string) {
  const normalized = normalizeIdentityDocumentNumber(value);
  if (/^\d{13}$/.test(normalized)) return isValidThaiNationalId(normalized);
  return /^[A-Z0-9]{6,20}$/.test(normalized);
}
