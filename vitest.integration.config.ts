/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นไฟล์ตั้งค่าหรือจุดเชื่อมระบบ “vitest.integration.config” ของโปรเจกต์ Nestly
 * การทำงาน: กำหนดวิธีที่เครื่องมือ build, test หรือ runtime ทำงานร่วมกับโค้ดหลัก โดยไม่เก็บข้อมูลผู้ใช้งานจริง
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: projectRoot,
  resolve: { alias: { "@": projectRoot } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.next-*/**",
      "**/out/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
