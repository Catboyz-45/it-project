/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นไฟล์ตั้งค่าหรือจุดเชื่อมระบบ “postcss.config” ของโปรเจกต์ Nestly
 * การทำงาน: กำหนดวิธีที่เครื่องมือ build, test หรือ runtime ทำงานร่วมกับโค้ดหลัก โดยไม่เก็บข้อมูลผู้ใช้งานจริง
 */

const postcssConfig = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default postcssConfig;
