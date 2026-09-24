
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// import.meta.url คือพาธของไฟล์นี้ แปลงเป็นพาธจริงเพื่อใช้เป็นรากของโปรเจกต์
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// ไคลเอนต์ Prisma กับไฟล์ตั้งค่าไม่ใช่โค้ดที่เราเขียน จึงไม่นับรวมใน coverage
// ถ้าปล่อยไว้ พาธพวกนี้จะโผล่ใน lcov แล้ว SonarQube หาไฟล์จริงไม่เจอ
const coverageExclude = ["generated/**", "**/*.config.*", "**/.next/**", "node_modules/**"];

export default defineConfig({
  root: projectRoot,
  // ให้ "@/..." ในเทสต์ชี้ที่เดียวกับที่ TypeScript ตั้งไว้
  resolve: { alias: { "@": projectRoot } },
  test: {
    // ชุดนี้รันเฉพาะเทสต์ที่ไม่ต้องต่อฐานข้อมูล จึงรันเร็วและใช้ใน CI ทุกครั้ง
    include: ["lib/**/*.test.{ts,tsx}"],
    // ตัดโฟลเดอร์ผลลัพธ์ของ build ออก ไม่งั้นจะไปเจอไฟล์ที่คอมไพล์แล้วแล้วรันซ้ำ
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
    // lcov คือรูปแบบที่ SonarQube อ่านได้ (ดู sonar-project.properties)
    coverage: { exclude: coverageExclude, reporter: ["text", "html", "lcov"] },
  },
});
