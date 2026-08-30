/**
 * หน้าที่ของไฟล์นี้: ไฟล์ตั้งค่า playwright.config.ts อธิบายให้เครื่องมือ build, test หรือ lint ทำงานสอดคล้องกัน
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results",
  reporter: "list",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: existsSync(macChrome) ? { executablePath: macChrome } : undefined,
  },
  webServer: {
    command: process.env.CI ? `npm run build && npm run start -- -p ${port}` : `npm run dev -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
