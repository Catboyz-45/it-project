import "dotenv/config";
import { spawnSync } from "node:child_process";

// ตัวช่วยรันเทสต์ E2E ยกฐานข้อมูลทดสอบขึ้นมา ลงไมเกรชัน แล้วค่อยสั่ง Playwright
const localTestUrl = "postgresql://nestly_test:nestly_test_local@127.0.0.1:55432/nestly_test?schema=public";
// เลือกฐานตามลำดับ ตัวที่ตั้งไว้เฉพาะ E2E ก่อน แล้วค่อยดู DATABASE_URL ถ้าชื่อมีคำว่า test
// ไม่เข้าเงื่อนไขไหนเลยก็ยกฐานของตัวเองขึ้นมาผ่าน docker
const configuredUrl = process.env.E2E_DATABASE_URL
  ?? (process.env.DATABASE_URL && /test/i.test(new URL(process.env.DATABASE_URL).pathname)
    ? process.env.DATABASE_URL
    : null);
const testUrl = configuredUrl ?? localTestUrl;
// ด่านกันพลาดสุดท้าย เทสต์ E2E ล้างข้อมูลทิ้ง ชี้ผิดฐานคือหายทั้งระบบ
if (!/test/i.test(new URL(testUrl).pathname)) {
  throw new Error("Refusing to run E2E against a database whose name does not contain 'test'");
}

// รันคำสั่งแล้วรอจนจบ พลาดเมื่อไหร่หยุดทั้งสคริปต์ทันที ไม่รันขั้นถัดไปต่อ
function run(command, args, environment = process.env) {
  const result = spawnSync(command, args, { env: environment, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!configuredUrl) {
  process.stdout.write("Starting isolated PostgreSQL database nestly_test on port 55432\n");
  run("docker", ["compose", "-f", "docker-compose.e2e.yml", "up", "-d", "--wait"]);
}

// สุ่มพอร์ตจากรหัสโปรเซส เซิร์ฟเวอร์ที่ค้างจากรอบก่อนจะได้ไม่ถูกเอามาใช้ซ้ำ
// เพราะมันอาจถือไฟล์เก่าหรือต่อฐานข้อมูลผิดตัวอยู่
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? String(3100 + (process.pid % 500));
const environment = {
  ...process.env,
  DATABASE_URL: testUrl,
  // บังคับใช้บัญชีทดสอบชุดเดียวเสมอ
  // บัญชีที่นักพัฒนาตั้งไว้ในเครื่องอาจเป็นคนละบัญชี ห้ามให้ปนเข้ามาในฐานทดสอบ
  BOOTSTRAP_ADMIN_EMAIL: "e2e-super-admin@example.test",
  BOOTSTRAP_ADMIN_PASSWORD: "E2E-Password-Strong-123",
  PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${playwrightPort}`,
  PLAYWRIGHT_PORT: playwrightPort,
};
const requestedSpecs = process.argv.slice(2);
const specs = requestedSpecs.length > 0
  ? requestedSpecs
  : ["tests/e2e"];
// ลงไมเกรชันก่อนเสมอ ฐานทดสอบจะได้มีโครงสร้างตรงกับโค้ดปัจจุบัน
run("npx", ["prisma", "migrate", "deploy"], environment);
run("npx", ["playwright", "test", ...specs], environment);
