
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// import.meta.url คือพาธของไฟล์นี้ แปลงเป็นพาธจริงเพื่อใช้เป็นรากของโปรเจกต์
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: projectRoot,
  resolve: { alias: { "@": projectRoot } },
  test: {
    // แยกไฟล์ตั้งค่าจากชุดเร็ว เพราะชุดนี้ต้องมีฐานข้อมูลทดสอบจริงถึงจะรันได้
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
    // ใช้ฐานข้อมูลเดียวกันทุกไฟล์ รันพร้อมกันข้อมูลจะทับกัน จึงรันทีละไฟล์
    fileParallelism: false,
    // ยืดเวลารอเป็น 30 วินาที เพราะแต่ละเทสต์ต้องรอฐานข้อมูลจริงตอบ
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // แยกโฟลเดอร์จากชุด unit ไม่งั้นรายงานของสองชุดจะเขียนทับกัน
    // ชุดนี้คือชุดเดียวที่วิ่งผ่าน route handler ใน app/api จริง ๆ
    coverage: { reporter: ["text", "lcov"], reportsDirectory: "coverage-integration" },
  },
});
