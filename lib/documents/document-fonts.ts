// ฟอนต์ของเอกสาร ใช้ชุดเดียวกันทั้งในตัวแก้ไขและตอนสร้าง PDF ผลที่เห็นจะได้ตรงกับไฟล์จริง
// Sarabun เป็นฟอนต์ราชการไทยแบบเว็บ (สัญญาอนุญาต OFL ไฟล์อยู่ใน public/fonts/sarabun)
// แยกไฟล์ตามชุดอักษรไทยกับละติน เบราว์เซอร์จะโหลดเฉพาะชุดที่หน้านั้นใช้จริง

export const documentFontFamily = "Sarabun";

// ฟอนต์ที่เลือกได้ในตัวแก้ไข ต้องตรงกับรายการที่ sanitizeTemplate ยอมให้เก็บ
// ใส่เฉพาะฟอนต์ที่มีตัวไทย Arial กับ Georgia ไม่มีตัวไทย เลือกแล้วตัวไทยจะกลายเป็นฟอนต์สำรองที่ไม่ตรงกับ PDF
export const documentFontOptions = [
  { label: "Sarabun", value: "Sarabun" },
  { label: "Noto Sans Thai", value: "Noto Sans Thai" },
  { label: "Tahoma", value: "Tahoma" },
] as const;

const thaiRange = "U+02D7,U+0303,U+0331,U+0E01-0E5B,U+200C-200D,U+25CC";
const latinRange = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

export const documentFontFiles = (["thai", "latin"] as const).flatMap((subset) =>
  ([400, 700] as const).flatMap((weight) =>
    (["normal", "italic"] as const).map((style) => ({
      file: `sarabun-${subset}-${weight}${style === "italic" ? "-italic" : ""}.woff2`,
      style,
      unicodeRange: subset === "thai" ? thaiRange : latinRange,
      weight,
    })),
  ),
);

// สร้าง @font-face ทั้งชุด ผู้เรียกบอกเองว่าจะชี้ไฟล์ไปที่ไหน
// ตัวแก้ไขชี้ไปที่ /fonts/... ส่วน PDF ฝังเป็น data URL เพราะหน้าที่ใช้ทำ PDF ไม่มีที่อยู่เว็บให้โหลดไฟล์
export function documentFontFaceCss(sourceFor: (file: string) => string) {
  return documentFontFiles.map((font) =>
    `@font-face{font-family:${documentFontFamily};font-style:${font.style};font-weight:${font.weight};font-display:swap;src:url(${sourceFor(font.file)}) format("woff2");unicode-range:${font.unicodeRange}}`,
  ).join("");
}
