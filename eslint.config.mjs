import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

// ต่อกฎสองชุดของ Next เข้าด้วยกัน ชุดหนึ่งเรื่องคุณภาพหน้าเว็บ อีกชุดเรื่อง TypeScript
export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    // โค้ดเดิมใช้ useEffect ดึงข้อมูลหลังคอมโพเนนต์ขึ้นจอ ซึ่งกฎสองข้อนี้ห้ามไว้
    // ปิดไปก่อนแล้วค่อยทยอยย้ายไปเป็น Server Component ทีละจุด
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // ข้ามโฟลเดอร์ที่เครื่องมือสร้างให้ ไม่ใช่โค้ดที่เราเขียนเอง จึงไม่ต้องตรวจ
  globalIgnores([
    ".next/**",
    ".next-*/**",
    "coverage/**",
    "coverage-integration/**",
    "generated/**",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
