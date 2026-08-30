/**
 * หน้าที่ของไฟล์นี้: คำสั่งดูแลระบบ run-with-test-env; รันจากเครื่องหรือเซิร์ฟเวอร์ที่เชื่อถือได้ตามคู่มือใน docs
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import dotenv from "dotenv";

dotenv.config({ path: ".env", quiet: true });
if (existsSync(".env.test"))
  dotenv.config({ path: ".env.test", override: true, quiet: true });

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: tsx scripts/run-with-test-env.ts <command> [...args]");
  process.exit(1);
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testDatabaseUrl) {
  console.error(
    "TEST_DATABASE_URL is required. Copy .env.test.example to .env.test and use an isolated test database.",
  );
  process.exit(1);
}

let databaseUrl: URL;
try {
  databaseUrl = new URL(testDatabaseUrl);
} catch {
  console.error("TEST_DATABASE_URL must be a valid PostgreSQL connection URL.");
  process.exit(1);
}

if (!/^postgres(ql)?:$/.test(databaseUrl.protocol)) {
  console.error("TEST_DATABASE_URL must use the PostgreSQL protocol.");
  process.exit(1);
}

const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
if (!/(test|e2e|sandbox)/i.test(databaseName)) {
  console.error(
    `Refusing to run data-writing tests against database "${databaseName || "(missing)"}". Its name must contain test, e2e, or sandbox.`,
  );
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: testDatabaseUrl,
  },
});

child.on("error", (error) => {
  console.error(`Unable to start test command: ${error.message}`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
