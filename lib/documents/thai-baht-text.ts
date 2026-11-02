// แปลงจำนวนเงินเป็นคำอ่านภาษาไทยแบบที่ใช้ในสัญญาและใบเสร็จ เช่น 4,500 เป็น "สี่พันห้าร้อยบาทถ้วน"
// สัญญาเช่ามักเขียนทั้งตัวเลขและตัวอักษร กันการแก้ตัวเลขทีหลัง

const digits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const places = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

// อ่านเลขไม่เกินหกหลัก มีกฎพิเศษสองข้อ หลักหน่วยที่เป็น 1 อ่านว่า "เอ็ด" เมื่อมีหลักอื่นนำหน้า
// และหลักสิบอ่าน 1 ว่า "สิบ" กับ 2 ว่า "ยี่สิบ"
function readUnderMillion(value: number) {
  const text = String(value);
  let words = "";
  for (let index = 0; index < text.length; index += 1) {
    const digit = Number(text[index]);
    const place = text.length - index - 1;
    if (digit === 0) continue;
    if (place === 1 && digit === 1) words += "สิบ";
    else if (place === 1 && digit === 2) words += "ยี่สิบ";
    else if (place === 0 && digit === 1 && text.length > 1) words += "เอ็ด";
    else words += digits[digit] + places[place];
  }
  return words;
}

// ตัวเลขเกินหกหลักแบ่งเป็นช่วงละล้าน แล้วต่อด้วยคำว่า "ล้าน" ทีละช่วง
function readInteger(value: number): string {
  if (value === 0) return "ศูนย์";
  const millions = Math.floor(value / 1_000_000);
  const rest = value % 1_000_000;
  const head = millions > 0 ? `${readInteger(millions)}ล้าน` : "";
  return head + (rest > 0 ? readUnderMillion(rest) : "");
}

export function thaiBahtText(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) return "";
  // ปัดเป็นสตางค์ก่อน กันเศษทศนิยมของ float ทำให้ 0.29 กลายเป็น 28 สตางค์
  const totalSatang = Math.round(amount * 100);
  const baht = Math.floor(totalSatang / 100);
  const satang = totalSatang % 100;
  const bahtText = baht > 0 || satang === 0 ? `${readInteger(baht)}บาท` : "";
  return satang === 0 ? `${bahtText}ถ้วน` : `${bahtText}${readUnderMillion(satang)}สตางค์`;
}
