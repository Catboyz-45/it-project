
import { defineConfig, devices } from "@playwright/test";

// อ่านจาก env ได้ เผื่อพอร์ต 3000 ถูกใช้อยู่แล้วตอนรันในเครื่อง
const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // เตรียมฐานข้อมูลและบัญชีทดสอบครั้งเดียวก่อนเริ่มทุกไฟล์
  globalSetup: "./tests/e2e/global-setup.ts",
  // ทุกไฟล์ใช้ฐานข้อมูลเดียวกัน รันขนานกันข้อมูลจะชนกัน จึงบังคับให้รันทีละอัน
  fullyParallel: false,
  workers: 1,
  // เผลอ commit test.only ติดไป CI จะฟ้องทันที ไม่ปล่อยให้ผ่านทั้งที่รันไม่ครบ
  forbidOnly: Boolean(process.env.CI),
  // ใน CI ให้ลองซ้ำได้ เพราะเครื่องช้าบางจังหวะทำให้เทสต์ตกเองโดยไม่ใช่บั๊ก
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL,
    // เก็บ trace กับภาพหน้าจอเฉพาะตอนที่พัง จะได้ไม่กินพื้นที่ตอนที่ผ่านหมด
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    // รอจนกว่า /api/health จะตอบ ค่อยเริ่มเทสต์ กันการยิงใส่เซิร์ฟเวอร์ที่ยังไม่พร้อม
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
