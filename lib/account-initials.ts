// ตัวย่อชื่อในวงกลมของปุ่มบัญชี ใช้กับชื่อภาษาไทยและอังกฤษ

// สระที่เขียนไว้หน้าพยัญชนะในภาษาไทย ข้ามไปเอาพยัญชนะตัวแรกแทน ไม่งั้น "ใจดี" จะได้ "ใ"
const leadingThaiVowels = /^[เแโใไ]/u;

// ตัดทีละตัวอักษรที่มองเห็น ไม่ตัดกลางสระหรือวรรณยุกต์
function graphemesOf(word: string) {
  return Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(word), (part) => part.segment);
}

// ตัวย่อชื่อสองตัว ชื่อสองคำเอาตัวแรกของแต่ละคำ เช่น "สมชาย ใจดี" ได้ "สจ"
// ชื่อคำเดียวเอาสองตัวแรกของคำนั้น เช่น "แอดมินใหญ่" ได้ "แอ" ไม่งั้นจะเหลือตัวเดียวดูไม่ออก
export function accountInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return graphemesOf(words[0]).slice(0, 2).join("").toLocaleUpperCase("th");
  return words.slice(0, 2)
    .map((word) => graphemesOf(word.replace(leadingThaiVowels, ""))[0] ?? word[0])
    .join("")
    .toLocaleUpperCase("th");
}
