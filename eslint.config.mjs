/**
 * หน้าที่ของไฟล์นี้: ไฟล์ตั้งค่า eslint.config.mjs อธิบายให้เครื่องมือ build, test หรือ lint ทำงานสอดคล้องกัน
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "node_modules/**", "coverage/**"]),
]);
