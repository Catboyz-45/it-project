// ตัวย่อชื่อในวงกลมของปุ่มบัญชี ใช้กับชื่อภาษาไทยและอังกฤษ

// สระที่เขียนไว้หน้าพยัญชนะในภาษาไทย ข้ามไปเอาพยัญชนะตัวแรกแทน ไม่งั้น "ใจดี" จะได้ "ใ"
const leadingThaiVowels = /^[เแโใไ]/u;
const thaiText = /[฀-๿]/u;

// ตัดทีละตัวอักษรที่มองเห็น ไม่ตัดกลางสระหรือวรรณยุกต์
function graphemesOf(word: string) {
  return Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(word), (part) => part.segment);
}

// ตัวอักษรแรกของคำ ภาษาไทยข้ามสระหน้าไปเอาพยัญชนะ
function firstLetterOf(word: string) {
  return graphemesOf(word.replace(leadingThaiVowels, ""))[0] ?? word[0];
}

// ตัวย่อชื่อ ชื่อสองคำเอาตัวแรกของแต่ละคำ เช่น "สมชาย ใจดี" ได้ "สจ"
// ชื่อไทยคำเดียวเอาตัวแรกตัวเดียว เพราะสองพยางค์แรกมักอ่านเป็นคำที่ความหมายเพี้ยน
// เช่น "ผู้ดูแลระบบ" ถ้าเอาสองตัวจะได้ "ผู้ดู" ส่วนชื่ออังกฤษคำเดียวยังเอาสองตัว เช่น "nestly" ได้ "NE"
export function accountInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    if (thaiText.test(words[0])) return firstLetterOf(words[0]);
    return graphemesOf(words[0]).slice(0, 2).join("").toLocaleUpperCase("th");
  }
  return words.slice(0, 2)
    .map(firstLetterOf)
    .join("")
    .toLocaleUpperCase("th");
}
