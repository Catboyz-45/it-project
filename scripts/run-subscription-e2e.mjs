/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคำสั่งสำหรับนักพัฒนา/ระบบอัตโนมัติในงาน “run subscription e2e”
 * การทำงาน: เรียกใช้จาก terminal หรือ package script เพื่อทำงานบำรุงรักษาที่ทำซ้ำได้; ควรทดลองในสภาพแวดล้อมที่ไม่ใช่ production ก่อนเมื่อมีการเขียนข้อมูล
 */

import "dotenv/config";
import { spawnSync } from "node:child_process";

const localTestUrl = "postgresql://nestly_test:nestly_test_local@127.0.0.1:55432/nestly_test?schema=public";
const configuredUrl = process.env.E2E_DATABASE_URL
  ?? (process.env.DATABASE_URL && /test/i.test(new URL(process.env.DATABASE_URL).pathname)
    ? process.env.DATABASE_URL
    : null);
const testUrl = configuredUrl ?? localTestUrl;
if (!/test/i.test(new URL(testUrl).pathname)) {
  throw new Error("Refusing to run E2E against a database whose name does not contain 'test'");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “run” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - command: ค่า “command” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - args: ค่า “args” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - environment: ค่า “environment” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
function run(command, args, environment = process.env) {
  const result = spawnSync(command, args, { env: environment, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!configuredUrl) {
  process.stdout.write("Starting isolated PostgreSQL database nestly_test on port 55432\n");
  run("docker", ["compose", "-f", "docker-compose.e2e.yml", "up", "-d", "--wait"]);
}

// A per-run port prevents a crashed development server from being reused with
// stale chunks or the wrong database connection.
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? String(3100 + (process.pid % 500));
const environment = {
  ...process.env,
  DATABASE_URL: testUrl,
  // Keep every Playwright suite on the canonical isolated fixture account.
  // Local developer bootstrap credentials may point at a different account
  // and must never leak into the deterministic E2E database.
  BOOTSTRAP_ADMIN_EMAIL: "e2e-super-admin@example.test",
  BOOTSTRAP_ADMIN_PASSWORD: "E2E-Password-Strong-123",
  PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${playwrightPort}`,
  PLAYWRIGHT_PORT: playwrightPort,
};
const requestedSpecs = process.argv.slice(2);
const specs = requestedSpecs.length > 0
  ? requestedSpecs
  : ["tests/e2e"];
run("npx", ["prisma", "migrate", "deploy"], environment);
run("npx", ["playwright", "test", ...specs], environment);
