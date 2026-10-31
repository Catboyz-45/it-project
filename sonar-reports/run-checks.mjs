/**
 * รันชุดตรวจว่า "แก้ตาม SonarQube แล้วระบบยังใช้งานได้" แล้วเก็บผลจริงเป็นไฟล์ JSON
 * ให้ build-sonar-reports.mjs เอาไปพิมพ์ลงรายงานภาพรวม
 *
 * เทสต์ integration ต่อฐานข้อมูลจริง ต้องตั้ง TEST_DATABASE_URL เป็นฐานทดสอบที่ชื่อมีคำว่า test
 * ใช้งาน: TEST_DATABASE_URL=postgresql://... node sonar-reports/run-checks.mjs  →  sonar-reports/checks-<วันที่>.json
 *
 * ผลที่บันทึกคือ exit code + ตัวเลขที่เครื่องมือรายงานเอง ไม่ได้ตีความเพิ่ม
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const UNIT_JSON = path.join(os.tmpdir(), `sonar-checks-unit-${process.pid}.json`);
const INTEGRATION_JSON = path.join(os.tmpdir(), `sonar-checks-integration-${process.pid}.json`);

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || !/test/i.test(new URL(testDatabaseUrl).pathname)) {
  console.error("ต้องตั้ง TEST_DATABASE_URL เป็นฐานข้อมูลทดสอบที่ชื่อมีคำว่า test");
  process.exit(1);
}
const integrationEnv = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  STORAGE_TYPE: "local",
  LOCAL_STORAGE_PATH: "./storage/test-documents",
};

const CHECKS = [
  { id: "typecheck", label: "ตรวจ type (TypeScript strict)", cmd: "npm run typecheck" },
  { id: "lint", label: "ตรวจรูปแบบโค้ด (ESLint)", cmd: 'npx eslint . --ignore-pattern "deliverables/**"' },
  { id: "unit", label: "เทสต์ unit (Vitest)", cmd: `npx vitest run --reporter=json --outputFile="${UNIT_JSON}"`, json: UNIT_JSON },
  {
    id: "integration",
    label: "เทสต์ integration ผ่าน API และฐานข้อมูลจริง (Vitest)",
    cmd: `npx vitest run --config vitest.integration.config.ts --reporter=json --outputFile="${INTEGRATION_JSON}"`,
    json: INTEGRATION_JSON,
    env: integrationEnv,
  },
  { id: "build", label: "build สำหรับ production (next build)", cmd: "npm run build" },
];

const results = [];
for (const c of CHECKS) {
  process.stdout.write(`${c.id} ... `);
  const started = Date.now();
  const r = spawnSync(c.cmd, { cwd: ROOT, shell: true, encoding: "utf8", env: c.env ?? process.env, maxBuffer: 64 * 1024 * 1024 });
  const entry = {
    id: c.id,
    label: c.label,
    command: c.cmd.replace(UNIT_JSON, "<tmp>.json").replace(INTEGRATION_JSON, "<tmp>.json"),
    exitCode: r.status,
    passed: r.status === 0,
    seconds: Math.round((Date.now() - started) / 1000),
  };
  if (c.json && fs.existsSync(c.json)) {
    // รูปแบบ JSON ของ Vitest ตามแบบ Jest จึงอ่านช่องเดียวกับรายงานของ SystemBOQ ได้
    const j = JSON.parse(fs.readFileSync(c.json, "utf8"));
    entry.detail = {
      suites: j.numTotalTestSuites,
      suitesPassed: j.numPassedTestSuites,
      tests: j.numTotalTests,
      passed: j.numPassedTests,
      failed: j.numFailedTests,
      pending: j.numPendingTests,
    };
    entry.failures = j.testResults
      .flatMap((s) => s.assertionResults.filter((a) => a.status === "failed").map((a) => `${path.basename(s.name)} › ${a.fullName}`))
      .slice(0, 20);
    fs.rmSync(c.json, { force: true });
  }
  if (!entry.passed) entry.tail = `${r.stdout}\n${r.stderr}`.trim().split("\n").slice(-15).join("\n");
  results.push(entry);
  const counts = entry.detail ? ` ${entry.detail.passed}/${entry.detail.tests}` : "";
  console.log(`${entry.passed ? "PASS" : "FAIL"} (${entry.seconds}s)${counts}`);
}

const ranAt = new Date();
const stamp = ranAt.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
const out = path.join(SCRIPT_DIR, `checks-${stamp}.json`);
fs.writeFileSync(
  out,
  JSON.stringify({ ranAt: ranAt.toISOString(), node: process.version, platform: `${os.type()} ${os.release()}`, results }, null, 1),
);
console.log(`saved ${path.basename(out)}`);
process.exit(results.every((r) => r.passed) ? 0 : 1);
