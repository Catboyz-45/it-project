/**
 * หน้าที่ของไฟล์นี้: ไฟล์ตั้งค่า postcss.config.mjs อธิบายให้เครื่องมือ build, test หรือ lint ทำงานสอดคล้องกัน
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
const postcssConfig = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default postcssConfig;
