/**
 * สร้างรายงาน PDF ผลการแก้ไขตาม SonarQube ของ Nestly — หนึ่งไฟล์ต่อหนึ่งชุด export
 * (issues_page1.json, issues_page2.json, ...) และอีกหนึ่งไฟล์ภาพรวมทั้งโปรเจกต์
 * รูปแบบเดียวกับรายงานของโปรเจกต์ SystemBOQ
 *
 * การสแกนก่อนแก้ของ Nestly (31 ต.ค. 2569 17:16 น.) มี 150 ข้อ export หน้าละ 200 ข้อจึงได้ชุดเดียว
 * ถ้ารอบหน้ามีเกิน 200 ข้อ ให้เพิ่มไฟล์ใน PAGES ข้างล่าง
 *
 * ทำไมไม่ใช้ sonar_report.py ของคู่มือตรง ๆ
 *   1. reportlab ไม่จัดตำแหน่งสระ/วรรณยุกต์ไทย — ต่อให้ใส่ฟอนต์ไทยแล้ว "ที่" ก็ยังพิมพ์ออกมาเป็น "ที"
 *      เพราะวรรณยุกต์ทับสระบน ที่นี่จึงให้ Chrome (puppeteer) พิมพ์แทน ซึ่งจัดตัวอักษรไทยถูก
 *   2. สคริปต์เดิมเรียก /api/issues/search โดยไม่ใส่ resolved=false จึงนับข้อที่แก้แล้ว (CLOSED)
 *      รวมเข้าไปด้วย ตัวเลขตาม severity เลยขัดกับตารางตัวชี้วัดบนหน้าเดียวกัน
 *
 * วิธีเทียบก่อน/หลัง: ทุกข้อใน export มี `key` ประจำตัว เมื่อสแกนรอบใหม่แล้วไม่เจอปัญหานั้นอีก
 * SonarQube จะปิดข้อนั้นเองเป็น CLOSED/FIXED โดยใช้ key เดิม — รายงานนี้แค่ถามเซิร์ฟเวอร์ว่า
 * แต่ละ key ตอนนี้สถานะอะไร ไม่ได้ตัดสินเองว่าข้อไหนแก้แล้ว
 *
 * ข้อจำกัด: SonarQube ลบข้อที่ปิดแล้วทิ้งหลัง 30 วัน (sonar.dbcleaner.daysBeforeDeletingClosedIssues)
 * สคริปต์จึงเซฟสถานะที่ดึงมาไว้เป็น issues_after_<วันที่>.json ข้างไฟล์ก่อนแก้ทุกครั้ง
 *
 * SonarQube ปิดข้อที่ถูกยกเว้นด้วย sonar.issue.ignore หรืออยู่ในโฟลเดอร์ที่ตัดออกจากการสแกน
 * เป็น CLOSED/FIXED เหมือนข้อที่แก้จริง รายงานนี้จึงจับข้อพวกนั้นก่อน (EXCEPTIONS และ EXCLUDED_PATHS)
 * แล้วแสดงแยกเป็น "ตั้งใจไม่แก้ / false positive" และ "ตัดออกจากการสแกน" ไม่นับเป็น "แก้แล้ว"
 *
 * ใช้งาน (จากโฟลเดอร์ราก):
 *   SONAR_TOKEN=<token> node sonar-reports/build-sonar-reports.mjs
 *   ตัวเลือก: SONAR_HOST (ค่าเริ่มต้น http://localhost:9000) · SONAR_PROJECT (nestly)
 *   รันแบบไม่ต่อเซิร์ฟเวอร์ด้วยไฟล์สถานะที่เซฟไว้: node sonar-reports/build-sonar-reports.mjs --from issues_after_2026-10-31.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import RULE_GUIDE from "./rule-guide.mjs";

// fileURLToPath แปลง URL กลับเป็นพาธจริง รองรับชื่อโฟลเดอร์ภาษาไทยบน Windows
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const OUT_DIR = SCRIPT_DIR;
// ตัด / ท้าย URL ด้วยการวนเช็ก ไม่ใช้ regex /\/+$/ ที่ช้าแบบกำลังสองเมื่อเจอ / ยาว ๆ
function trimTrailingSlashes(value) {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end--;
  return value.slice(0, end);
}

const HOST = trimTrailingSlashes(process.env.SONAR_HOST || "http://localhost:9000");
const PROJECT = process.env.SONAR_PROJECT || "nestly";
const TOKEN = process.env.SONAR_TOKEN || "";

// ไฟล์ export ก่อนแก้ อยู่ที่โฟลเดอร์ราก (สำเนาเดียวกับ docs/sonarqube-history/run-62_.../issues_page1.json)
const PAGES = [
  { n: 1, file: "issues_page1.json", out: "sonar-report-page1.pdf" },
];
// ตัวชี้วัดของการสแกนก่อนแก้ ใช้ทำตาราง "ก่อน / หลัง" ในรายงานภาพรวม
const BEFORE_MEASURES = "docs/sonarqube-history/run-62_2026-10-31_1716_before-fix/measures.json";
const BEFORE_LABEL = "31 ต.ค. 2569 17:16 น.";

const SEVERITIES = ["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "INFO"];
const TYPES = [
  ["BUG", "Bug"],
  ["VULNERABILITY", "Vulnerability"],
  ["CODE_SMELL", "Code Smell"],
];
// เทียบตามลำดับ ตัวแรกที่ขึ้นต้นตรงชนะ app/api/ จึงต้องมาก่อน app/
const APPS = [
  ["app/api/", "API (app/api)"],
  ["app/", "หน้าเว็บ (app)"],
  ["components/", "คอมโพเนนต์หน้าจอ (components)"],
  ["lib/", "ตรรกะระบบ (lib)"],
  ["scripts/", "สคริปต์ (scripts)"],
  ["prisma.config.ts", "ตั้งค่า Prisma"],
  ["deliverables/", "สคริปต์ทำคู่มือ (deliverables)"],
];

// โฟลเดอร์ที่ตัดออกจากการสแกนใน sonar-project.properties ไม่ใช่โค้ดของระบบ จึงไม่ได้แก้
const EXCLUDED_PATHS = [
  {
    prefix: "deliverables/",
    reason: "ตัดออกจากการสแกน — สคริปต์ถ่ายภาพหน้าจอทำคู่มือ ไม่ใช่โค้ดของระบบและไม่ได้อยู่ใน git (sonar.exclusions) ไม่ได้แก้โค้ด",
  },
];

/**
 * ข้อที่ตั้งใจไม่แก้ — ทุกข้อต้องมีเหตุผลที่อธิบายได้ ไม่ใช่แค่ "ไม่ได้ทำ"
 * จับคู่ด้วยกฎ + ไฟล์ (ไม่ใช้เลขบรรทัด เพราะบรรทัดเลื่อนทุกครั้งที่แก้ไฟล์)
 */
// ตรงกับ sonar.issue.ignore.multicriteria ใน sonar-project.properties ทุกข้อ
// ตัวแก้ไข rich text ยกเว้นเฉพาะ role="textbox" ส่วนข้ออื่นของกฎเดียวกันในไฟล์อื่นแก้จริง จึงจับด้วยข้อความด้วย
const EXCEPTIONS = [
  {
    rule: "S2068",
    files: ["lib/ui-labels.ts"],
    kind: "fp",
    reason:
      "False positive — เป็นตารางแปลงชื่อเหตุการณ์ audit เช่น PASSWORD_RESET_REQUEST เป็นคำไทย ไม่มีรหัสผ่านจริง SonarQube เห็นคำว่า PASSWORD ในชื่อแล้วเดาว่าเป็นรหัสผ่าน",
  },
  {
    rule: "S6819",
    files: ["components/dorm/DocumentTemplatePanel.tsx"],
    kind: "intentional",
    reason:
      "ตั้งใจไม่แก้ — กฎแนะนำ <textarea> แทน role=\"textbox\" แต่ตัวแก้ไขแม่แบบเอกสารเป็น rich text (ตัวหนา ตาราง รูป) ที่ textarea ทำไม่ได้ WAI-ARIA แนะนำให้ตัวแก้ไขแบบ contentEditable ใส่ role=\"textbox\"",
  },
  {
    rule: "S6481",
    files: ["components/dorm/DormDashboard.tsx"],
    kind: "intentional",
    reason:
      "ตั้งใจไม่แก้ — ค่า context ของหน้านี้รวม state เกือบทั้งหน้าจึงเปลี่ยนแทบทุก render อยู่แล้ว และการครอบ useMemo ทำให้ lint ของ React Compiler ฟ้องเป็น error การแก้ให้ถูกต้องต้องแยก context เป็นหลายตัว ซึ่งเป็นงานแยกต่างหาก",
  },
];

// ตาราง "ก่อน / หลัง" ในรายงานภาพรวม — rating แบบ MQR คือค่าที่หน้าเว็บ SonarQube รุ่นนี้แสดง
const METRIC_ROWS = [
  ["violations", "Issues ทั้งหมด", "int"],
  ["software_quality_security_rating", "Security Rating", "rating"],
  ["software_quality_reliability_rating", "Reliability Rating", "rating"],
  ["software_quality_maintainability_rating", "Maintainability Rating", "rating"],
  ["security_review_rating", "Security Review Rating (Hotspots)", "rating"],
  ["coverage", "Test Coverage (%)", "text"],
  ["duplicated_lines_density", "Duplicated Lines (%)", "text"],
  ["bugs", "Bugs", "int"],
  ["vulnerabilities", "Vulnerabilities", "int"],
  ["security_hotspots", "Security Hotspots", "int"],
  ["code_smells", "Code Smells", "int"],
  ["ncloc", "Lines of Code", "int"],
  ["alert_status", "Quality Gate", "gate"],
];

const QUALITIES = [
  ["SECURITY", "Security", "ความปลอดภัย"],
  ["RELIABILITY", "Reliability", "ความถูกต้องของการทำงาน"],
  ["MAINTAINABILITY", "Maintainability", "ความง่ายในการดูแลแก้ไข"],
];

const EFFORT_UNIT_MINUTES = { d: 480, h: 60, min: 1 };

/** เวลาแก้ที่ SonarQube ประเมิน ("5min", "1h30min", "1d" = 8 ชม.) → นาที อ่านทีละตัวอักษร ไม่ใช้ regex */
function effortMinutes(effort) {
  const text = String(effort || "");
  let total = 0;
  let digits = "";
  let unit = "";
  const flush = () => {
    if (digits && EFFORT_UNIT_MINUTES[unit]) total += Number(digits) * EFFORT_UNIT_MINUTES[unit];
    digits = "";
    unit = "";
  };
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") {
      if (unit) flush();
      digits += ch;
    } else {
      unit += ch;
    }
  }
  flush();
  return total;
}

function hoursText(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} นาที`;
  return m === 0 ? `${fmt(h)} ชม.` : `${fmt(h)} ชม. ${m} นาที`;
}

/** ผลรันชุดตรวจล่าสุด (run-checks.mjs) — ไม่มีไฟล์ก็ข้ามหัวข้อนั้นไป ไม่แต่งตัวเลขขึ้นมาเอง */
function latestChecks() {
  // ชื่อไฟล์มีวันที่แบบ YYYY-MM-DD เรียงตามตัวอักษรก็คือเรียงตามวันที่
  const files = fs.readdirSync(OUT_DIR)
    .filter((f) => /^checks-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort((a, b) => a.localeCompare(b));
  if (files.length === 0) return null;
  return { file: files.at(-1), ...JSON.parse(fs.readFileSync(path.join(OUT_DIR, files.at(-1)), "utf8")) };
}

const STATUS = {
  fixed: { label: "แก้แล้ว", note: "SonarQube ปิดเป็น FIXED" },
  fp: { label: "False positive", note: "ตรวจแล้วโค้ดถูกต้อง" },
  intentional: { label: "ตั้งใจไม่แก้", note: "มีเหตุผลกำกับ" },
  excluded: { label: "ตัดออกจากการสแกน", note: "ไม่ใช่โค้ดของระบบ" },
  open: { label: "ยังไม่ได้แก้", note: "ยังเปิดอยู่" },
  gone: { label: "ไม่พบบนเซิร์ฟเวอร์", note: "ถูกลบหลังปิดครบ 30 วัน" },
};

// ---------------------------------------------------------------------------
// ข้อมูล
// ---------------------------------------------------------------------------

async function api(pathAndQuery) {
  const res = await fetch(`${HOST}${pathAndQuery}`, {
    headers: { Authorization: "Basic " + Buffer.from(`${TOKEN}:`).toString("base64") },
  });
  if (!res.ok) throw new Error(`${res.status} ${pathAndQuery}`);
  return res.json();
}

async function apiOrNull(pathAndQuery) {
  try {
    return await api(pathAndQuery);
  } catch {
    return null;
  }
}

async function fetchAfter() {
  if (!TOKEN) throw new Error("ต้องตั้ง SONAR_TOKEN (หรือใช้ --from <ไฟล์สถานะที่เซฟไว้>)");
  const fetched = [];
  for (let p = 1; ; p++) {
    const d = await api(`/api/issues/search?components=${PROJECT}&ps=500&p=${p}`);
    fetched.push(...d.issues);
    if (fetched.length >= d.total || d.issues.length === 0) break;
  }
  // ไม่เก็บข้อที่มาจากไฟล์ .env ลงไฟล์สถานะที่จะ commit เพราะช่อง hash คือค่าตรวจสอบของบรรทัดที่มีรหัสผ่านจริง
  // (มีอยู่ช่วงหนึ่งก่อนตัด .env ออกจากการสแกน) ข้อพวกนี้ไม่อยู่ในไฟล์ export ก่อนแก้ จึงไม่กระทบตัวเลขในรายงาน
  const issues = fetched.filter((i) => !/^\.env(\.|$)/.test(path.basename(relFile(i.component))));
  const ruleKeys = [...new Set(issues.map((i) => i.rule))].sort((a, b) => a.localeCompare(b));
  const rules = {};
  for (const k of ruleKeys) {
    const r = await apiOrNull(`/api/rules/show?key=${encodeURIComponent(k)}`);
    rules[k] = r ? r.rule.name : "";
  }
  // software_quality_* คือ rating ที่หน้าเว็บ SonarQube รุ่นนี้ (โหมด MQR) แสดงจริง ส่วนสามตัวท้ายเป็นแบบเดิม
  const metricKeys = [
    "violations", "bugs", "vulnerabilities", "security_hotspots", "code_smells", "coverage",
    "duplicated_lines_density", "ncloc", "software_quality_security_rating",
    "software_quality_reliability_rating", "software_quality_maintainability_rating",
    "security_review_rating", "reliability_rating", "security_rating", "sqale_rating", "alert_status",
  ];
  const m = await apiOrNull(`/api/measures/component?component=${PROJECT}&metricKeys=${metricKeys.join(",")}`);
  const measures = m ? Object.fromEntries(m.component.measures.map((x) => [x.metric, x.value])) : {};
  const gate = await apiOrNull(`/api/qualitygates/project_status?projectKey=${PROJECT}`);
  const status = await apiOrNull(`/api/system/status`);
  return {
    fetchedAt: new Date().toISOString(),
    host: HOST,
    project: PROJECT,
    serverVersion: status ? status.version : null,
    measures,
    gate: gate ? gate.projectStatus : null,
    rules,
    issues,
  };
}

function loadBefore() {
  return PAGES.map((p) => {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, p.file), "utf8"));
    return { ...p, total: d.total, issues: d.issues };
  });
}

const relFile = (component) => component.slice(component.indexOf(":") + 1);
const ruleId = (rule) => rule.slice(rule.indexOf(":") + 1);

function classify(before, after) {
  // ตรวจข้อยกเว้นกับโฟลเดอร์ที่ตัดออกก่อน เพราะ SonarQube ปิดข้อพวกนี้เป็น FIXED เหมือนข้อที่แก้จริง
  const ex = EXCEPTIONS.find(
    (e) => e.rule === ruleId(before.rule) && e.files.includes(relFile(before.component)),
  );
  if (ex) return { kind: ex.kind, reason: ex.reason };
  const excluded = EXCLUDED_PATHS.find((e) => relFile(before.component).startsWith(e.prefix));
  if (excluded) return { kind: "excluded", reason: excluded.reason };
  if (!after) return { kind: "gone" };
  if (after.status === "CLOSED" || after.resolution === "FIXED" || after.resolution === "REMOVED") {
    return { kind: "fixed" };
  }
  if (after.resolution === "FALSE-POSITIVE" || after.issueStatus === "FALSE_POSITIVE") {
    return { kind: "fp", reason: "ทำเครื่องหมาย False positive ใน SonarQube แล้ว" };
  }
  if (after.resolution === "WONTFIX" || after.issueStatus === "ACCEPTED") {
    return { kind: "intentional", reason: "ทำเครื่องหมาย Accepted / Won't fix ใน SonarQube แล้ว" };
  }
  return { kind: "open" };
}

function tally(rows, keyOf) {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (!map.has(k)) map.set(k, { key: k, total: 0, fixed: 0, fp: 0, intentional: 0, excluded: 0, open: 0, gone: 0 });
    const t = map.get(k);
    t.total++;
    t[r.state.kind]++;
  }
  return map;
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const thDateTime = (iso) =>
  new Date(iso).toLocaleString("th-TH", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok",
  }) + " น.";

const fmt = (n) => Number(n).toLocaleString("en-US");

function fontFace() {
  // ฟอนต์ Sarabun (OFL) เก็บไว้ข้างสคริปต์ Chrome จะจัดสระและวรรณยุกต์ไทยได้ถูกต้อง
  const dir = path.join(SCRIPT_DIR, "fonts");
  const face = (file, weight) =>
    `@font-face{font-family:"Sarabun";font-weight:${weight};src:url(data:font/ttf;base64,${fs
      .readFileSync(path.join(dir, file))
      .toString("base64")}) format("truetype");}`;
  return face("Sarabun-Regular.ttf", 400) + face("Sarabun-Bold.ttf", 700);
}

const CSS = `
:root{
  --ink:#1b1f2e; --muted:#5a6078; --faint:#8a8fa3; --rule:#dcdfe8; --band:#f4f5f9;
  --brand:#000099;
  --fixed:#1d6b45; --fixed-bg:#e7f3ec;
  --held:#58607a; --held-bg:#eceef4;
  --excluded:#6b5a2e; --excluded-bg:#f4efe2;
  --open:#9a4a00; --open-bg:#fbefdf;
}
*{box-sizing:border-box}
html,body{margin:0;background:#fff;color:var(--ink)}
body{font-family:"Sarabun",Tahoma,sans-serif;font-size:10.5pt;line-height:1.65}
h1,h2,h3{margin:0;font-weight:700;color:var(--ink)}
.eyebrow{font-size:9pt;letter-spacing:.06em;color:var(--brand);font-weight:700}
h1{font-size:19pt;line-height:1.3;margin-top:2mm;text-wrap:balance}
h2{break-after:avoid;font-size:13pt;line-height:1.6;margin:7mm 0 2.5mm;padding:1.5mm 0 1.5mm;border-bottom:1.5px solid var(--brand);color:var(--brand)}
h3{break-after:avoid;font-size:11pt;margin:5mm 0 2mm}
.keep,table.keep{break-inside:avoid}
p{margin:0 0 2.5mm}
.lede{color:var(--muted);max-width:165mm}
.meta{display:grid;grid-template-columns:34mm 1fr;gap:1mm 4mm;margin:5mm 0 0;font-size:9.5pt}
.meta dt{color:var(--muted)} .meta dd{margin:0}
.header{padding-bottom:4mm;border-bottom:1px solid var(--rule)}
.tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:3mm;margin:5mm 0 3mm}
.tile{border:1px solid var(--rule);border-radius:2mm;padding:3mm 3.5mm}
.tile .n{font-size:20pt;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums}
.tile .l{font-size:9pt;color:var(--muted)}
.tile.fixed .n{color:var(--fixed)} .tile.held .n{color:var(--held)} .tile.excluded .n{color:var(--excluded)} .tile.open .n{color:var(--open)}
.bar{display:flex;gap:2px;height:4mm;border-radius:1mm;overflow:hidden;margin:1mm 0 1.5mm}
.bar span{display:block;height:100%}
.bar .fixed{background:var(--fixed)} .bar .held{background:#9aa1b8} .bar .excluded{background:#c9b98f} .bar .open{background:#d9892b}
.legend{display:flex;gap:6mm;font-size:9pt;color:var(--muted)}
.legend i{display:inline-block;width:3mm;height:3mm;border-radius:.6mm;margin-right:1.5mm;vertical-align:-.3mm}
table{width:100%;border-collapse:collapse;font-size:9.5pt;margin:1mm 0 2mm}
thead{display:table-header-group}
/* Chrome พิมพ์ tfoot ซ้ำท้ายทุกหน้า — แถว "รวม" จะโผล่กลางตารางที่ยาวข้ามหน้า */
tfoot{display:table-row-group}
th{background:var(--brand);color:#fff;font-weight:700;text-align:left;padding:1.6mm 2.2mm;font-size:9pt}
td{padding:1.4mm 2.2mm;border-bottom:1px solid var(--rule);vertical-align:top}
tr{break-inside:avoid}
tbody tr:nth-child(even) td{background:var(--band)}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tfoot td{font-weight:700;border-top:1.5px solid var(--ink);border-bottom:none;background:#fff}
.zero{color:var(--faint)}
.pill{display:inline-block;padding:.2mm 2mm;border-radius:10mm;font-size:8.5pt;font-weight:700;white-space:nowrap}
.pill.fixed{color:var(--fixed);background:var(--fixed-bg)}
.pill.fp,.pill.intentional{color:var(--held);background:var(--held-bg)}
.pill.excluded{color:var(--excluded);background:var(--excluded-bg)}
.pill.open,.pill.gone{color:var(--open);background:var(--open-bg)}
.sev{font-size:8.5pt;font-weight:700;letter-spacing:.02em}
.code{font-family:Consolas,"Courier New",monospace;font-size:8.6pt;word-break:break-all}
.small{font-size:8.8pt}
.muted{color:var(--muted)}
.reason{font-size:8.8pt;color:var(--muted);margin-top:.6mm}
.note{break-inside:avoid;border-left:2px solid var(--brand);padding:2mm 3.5mm;background:var(--band);font-size:9.5pt;margin:3mm 0}
.note p:last-child{margin:0}
.gate{display:inline-block;padding:1mm 4mm;border-radius:1.5mm;font-weight:700;color:#fff}
.gate.ok{background:var(--fixed)} .gate.error{background:#a32020}
ol.method{padding-left:5mm;margin:0} ol.method li{margin-bottom:1.5mm}
.page-break{break-before:page}
.debt{display:flex;align-items:baseline;gap:4mm;border:1px solid var(--rule);border-radius:2mm;padding:2.5mm 3.5mm;margin-top:3mm;font-size:9.5pt}
.debt .t{color:var(--muted);min-width:34mm}
.debt b{font-size:13pt;font-variant-numeric:tabular-nums}
.debt .arrow{color:var(--faint)}
.debt .down{color:var(--fixed);font-weight:700}
.rg{margin-top:1mm;font-size:8.8pt;line-height:1.5}
.rg .k{color:var(--muted);font-weight:700}
td.rulecell{width:62%}
.pass{color:var(--fixed);font-weight:700} .fail{color:#a32020;font-weight:700}
`;

function ruleCell(ruleKey) {
  const g = RULE_GUIDE[ruleId(ruleKey)];
  return `<span class="code"><b>${esc(ruleId(ruleKey))}</b></span> <span class="small muted">${esc(RULES_NAME[ruleKey] || "")}</span>${
    g
      ? `<div class="rg"><span class="k">ปัญหา:</span> ${esc(g.problem)}</div><div class="rg"><span class="k">แก้โดย:</span> ${esc(g.fix)}</div>`
      : ""
  }`;
}

let RULES_NAME = {};

function pill(kind) {
  return `<span class="pill ${kind}">${esc(STATUS[kind].label)}</span>`;
}

function num(n) {
  return n === 0 ? `<span class="zero">0</span>` : fmt(n);
}

function breakdownTable(title, map, order, labelOf, opts = {}) {
  const rows = order.filter((k) => map.has(k)).map((k) => map.get(k));
  const sum = (f) => rows.reduce((s, r) => s + r[f], 0);
  const held = (r) => r.fp + r.intentional;
  const extraHead = opts.extraHead ?? "";
  const firstCellAttr = opts.firstClass ? ` class="${opts.firstClass}"` : "";
  return `
  <table>
    <thead><tr><th>${esc(title)}</th>${extraHead}<th class="num">ก่อนแก้</th><th class="num">แก้แล้ว</th><th class="num">ตั้งใจไม่แก้ / FP</th><th class="num">ตัดออกจากสแกน</th><th class="num">ยังไม่ได้แก้</th></tr></thead>
    <tbody>${rows
      .map(
        (r) =>
          `<tr><td${firstCellAttr}>${labelOf(r.key)}</td>${opts.extraCell ? opts.extraCell(r.key) : ""}<td class="num">${num(r.total)}</td><td class="num">${num(r.fixed)}</td><td class="num">${num(held(r))}</td><td class="num">${num(r.excluded)}</td><td class="num">${num(r.open + r.gone)}</td></tr>`,
      )
      .join("")}</tbody>
    <tfoot><tr><td>รวม</td>${opts.extraCell ? "<td></td>" : ""}<td class="num">${fmt(sum("total"))}</td><td class="num">${fmt(sum("fixed"))}</td><td class="num">${fmt(sum("fp") + sum("intentional"))}</td><td class="num">${fmt(sum("excluded"))}</td><td class="num">${fmt(sum("open") + sum("gone"))}</td></tr></tfoot>
  </table>`;
}

function summaryBlock(rows) {
  const c = { fixed: 0, fp: 0, intentional: 0, excluded: 0, open: 0, gone: 0 };
  for (const r of rows) c[r.state.kind]++;
  const total = rows.length;
  const held = c.fp + c.intentional;
  const open = c.open + c.gone;
  const pct = (n) => ((n / total) * 100).toFixed(1);
  const w = (n) => (n === 0 ? "" : `<span class="__K__" style="flex:${n}"></span>`);
  // หนี้ทางเทคนิคคิดเฉพาะโค้ดของระบบ ข้อที่ตัดออกจากการสแกนไม่ได้อยู่ในโค้ดที่ส่งงาน จึงไม่นับทั้งก่อนและหลัง
  const inScope = rows.filter((r) => r.state.kind !== "excluded");
  const debtBefore = inScope.reduce((s, r) => s + effortMinutes(r.b.effort), 0);
  const debtLeft = inScope.filter((r) => r.state.kind !== "fixed").reduce((s, r) => s + effortMinutes(r.b.effort), 0);
  const debtDrop = debtBefore === 0 ? 0 : ((1 - debtLeft / debtBefore) * 100).toFixed(1);
  return {
    c,
    html: `
  <div class="tiles">
    <div class="tile"><div class="n">${fmt(total)}</div><div class="l">ข้อในชุดนี้ (ก่อนแก้)</div></div>
    <div class="tile fixed"><div class="n">${fmt(c.fixed)}</div><div class="l">แก้แล้ว · ${pct(c.fixed)}%</div></div>
    <div class="tile held"><div class="n">${fmt(held)}</div><div class="l">ตั้งใจไม่แก้ / false positive</div></div>
    <div class="tile excluded"><div class="n">${fmt(c.excluded)}</div><div class="l">ตัดออกจากการสแกน</div></div>
    <div class="tile open"><div class="n">${fmt(open)}</div><div class="l">ยังไม่ได้แก้</div></div>
  </div>
  <div class="bar" role="img" aria-label="แก้แล้ว ${c.fixed} ตั้งใจไม่แก้ ${held} ตัดออก ${c.excluded} ยังไม่ได้แก้ ${open} จาก ${total}">
    ${w(c.fixed).replace("__K__", "fixed")}${w(held).replace("__K__", "held")}${w(c.excluded).replace("__K__", "excluded")}${w(open).replace("__K__", "open")}
  </div>
  <div class="legend">
    <span><i style="background:var(--fixed)"></i>แก้แล้ว ${fmt(c.fixed)}</span>
    <span><i style="background:#9aa1b8"></i>ตั้งใจไม่แก้ / FP ${fmt(held)}</span>
    <span><i style="background:#c9b98f"></i>ตัดออกจากสแกน ${fmt(c.excluded)}</span>
    <span><i style="background:#d9892b"></i>ยังไม่ได้แก้ ${fmt(open)}</span>
  </div>
  <div class="debt">
    <span class="t">หนี้ทางเทคนิค<br><span class="small">(เวลาแก้ที่ SonarQube ประเมิน)</span></span>
    <span>ก่อนแก้ <b>${hoursText(debtBefore)}</b></span>
    <span class="arrow">→</span>
    <span>คงเหลือ <b>${hoursText(debtLeft)}</b></span>
    <span class="down">ลดลง ${debtDrop}%</span>
  </div>
  <p class="small muted" style="margin-top:1mm">นับเฉพาะโค้ดของระบบ (ไม่รวมข้อที่ตัดออกจากการสแกน) · คงเหลือคือข้อที่ตั้งใจไม่แก้หรือเป็น false positive ซึ่งตามหลักยังนับเป็นหนี้อยู่ แม้ SonarQube จะปิดให้แล้วตามข้อยกเว้นใน sonar-project.properties</p>`,
  };
}

function remainingTable(rows) {
  const left = rows.filter((r) => r.state.kind !== "fixed");
  if (left.length === 0) return `<p>ไม่มี — ทุกข้อในชุดนี้แก้ในโค้ดแล้ว</p>`;
  return `
  <table>
    <thead><tr><th style="width:17mm">สถานะ</th><th style="width:19mm">Severity</th><th style="width:15mm">กฎ</th><th>ไฟล์ · ข้อความจาก SonarQube · เหตุผล</th></tr></thead>
    <tbody>${left
      .map(
        (r) => `<tr>
        <td>${pill(r.state.kind)}</td>
        <td class="sev">${esc(r.b.severity)}</td>
        <td class="code">${esc(ruleId(r.b.rule))}</td>
        <td><div class="code">${esc(relFile(r.b.component))}:${esc(r.a?.line ?? r.b.line ?? "-")}</div>
            <div class="small">${esc(r.b.message)}</div>
            ${r.state.reason ? `<div class="reason">${esc(r.state.reason)}</div>` : ""}
            ${r.state.kind === "open" ? `<div class="reason">ยังไม่ได้แก้ — หลุดจากรอบแก้ไข</div>` : ""}</td>
      </tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

function fullList(rows) {
  const order = (r) => SEVERITIES.indexOf(r.b.severity);
  const sorted = [...rows].sort(
    (x, y) => order(x) - order(y) || relFile(x.b.component).localeCompare(relFile(y.b.component)) || (x.b.line ?? 0) - (y.b.line ?? 0),
  );
  return `
  <table>
    <thead><tr><th class="num" style="width:9mm">#</th><th style="width:19mm">Severity</th><th style="width:15mm">กฎ</th><th>ไฟล์:บรรทัด (ตอนสแกนก่อนแก้) · ข้อความ</th><th style="width:24mm">สถานะ</th></tr></thead>
    <tbody>${sorted
      .map(
        (r, i) => `<tr>
        <td class="num small muted">${i + 1}</td>
        <td class="sev">${esc(r.b.severity)}</td>
        <td class="code">${esc(ruleId(r.b.rule))}</td>
        <td><div class="code">${esc(relFile(r.b.component))}:${esc(r.b.line ?? "-")}</div><div class="small">${esc(r.b.message)}</div></td>
        <td>${pill(r.state.kind)}</td>
      </tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

function methodNote(after) {
  return `
  <h2>วิธีตรวจสอบผล</h2>
  <ol class="method">
    <li>ข้อมูล "ก่อนแก้" คือไฟล์ที่ export จาก SonarQube Web API (<span class="code">/api/issues/search?resolved=false&amp;ps=200</span>) จากการสแกนเมื่อ ${esc(BEFORE_LABEL)} ทุกข้อมีสถานะ OPEN</li>
    <li>หลังแก้โค้ดแล้วสแกนใหม่ด้วย <span class="code">npm run sonar:scan</span> โปรเจกต์เดิม (project key <span class="code">${esc(after.project)}</span>) SonarQube จับคู่ปัญหาเดิมด้วยรหัส <span class="code">key</span> ของแต่ละข้อ ข้อที่ไม่พบอีกจะถูกปิดเป็น <b>CLOSED / FIXED</b> โดยเซิร์ฟเวอร์เอง</li>
    <li>รายงานนี้ดึงสถานะปัจจุบันของทุก key จากเซิร์ฟเวอร์เมื่อ ${esc(thDateTime(after.fetchedAt))} แล้วนับตามสถานะนั้น — คำว่า "แก้แล้ว" หมายถึงข้อที่ SonarQube ปิดเป็น FIXED และไม่อยู่ในข้อยกเว้นหรือโฟลเดอร์ที่ตัดออก</li>
    <li>SonarQube ปิดข้อที่ถูกยกเว้นด้วย <span class="code">sonar.issue.ignore</span> และข้อในโฟลเดอร์ที่ตัดออกจากการสแกนเป็น FIXED ด้วยเหมือนกัน รายงานนี้จึงจับข้อพวกนั้นก่อน แล้วนับแยกเป็น "ตั้งใจไม่แก้ / false positive" และ "ตัดออกจากการสแกน" พร้อมเหตุผลรายข้อ ไม่นับเป็นแก้แล้ว</li>
  </ol>
  <div class="note"><p>ตรวจซ้ำได้บนหน้าเว็บ SonarQube: เมนู Issues ของโปรเจกต์ ตั้งตัวกรอง Status = Closed/Fixed หรือเปิด
  <span class="code">${esc(after.host)}/api/issues/search?issues=&lt;key&gt;</span> ด้วยรหัส key ใดก็ได้จากไฟล์ export ·
  SonarQube ลบข้อที่ปิดแล้วทิ้งหลังปิดครบ 30 วัน สถานะที่ใช้ทำรายงานนี้จึงเซฟไว้เป็นไฟล์ issues_after_*.json ข้างไฟล์ก่อนแก้</p></div>`;
}

function header(eyebrow, title, lede, after, extraMeta = "") {
  return `
  <div class="header">
    <div class="eyebrow">${esc(eyebrow)}</div>
    <h1>${esc(title)}</h1>
    <p class="lede" style="margin-top:2mm">${lede}</p>
    <dl class="meta">
      <dt>โปรเจกต์</dt><dd>Nestly (<span class="code">${esc(after.project)}</span>)</dd>
      ${extraMeta}
      <dt>สแกนก่อนแก้</dt><dd>${esc(BEFORE_LABEL)}</dd>
      <dt>สถานะหลังแก้</dt><dd>ดึงจากเซิร์ฟเวอร์เมื่อ ${esc(thDateTime(after.fetchedAt))}</dd>
      <dt>เซิร์ฟเวอร์</dt><dd>${esc(after.host)}${after.serverVersion ? ` · SonarQube ${esc(after.serverVersion)} Community` : ""}</dd>
    </dl>
  </div>`;
}

function pageReport(page, rows, after) {
  const { c, html: summary } = summaryBlock(rows);
  const bySev = tally(rows, (r) => r.b.severity);
  const byType = tally(rows, (r) => r.b.type);
  const byApp = tally(rows, (r) => (APPS.find(([p]) => relFile(r.b.component).startsWith(p)) || ["", "อื่น ๆ"])[1]);
  const byRule = tally(rows, (r) => r.b.rule);
  const ruleOrder = [...byRule.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key)).map((r) => r.key);
  const byFile = tally(rows, (r) => relFile(r.b.component));
  const fileOrder = [...byFile.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key)).map((r) => r.key);

  const first = (page.n - 1) * 200 + 1;
  const last = first + rows.length - 1;
  const heldN = c.fp + c.intentional;
  const openN = c.open + c.gone;

  const body = `
  ${header(
    `รายงานผลการแก้ไขตาม SonarQube · ชุดที่ ${page.n} จาก ${PAGES.length}`,
    `ชุดที่ ${page.n}: ${page.file}`,
    `ปัญหาลำดับที่ ${fmt(first)}–${fmt(last)} จากทั้งหมด ${fmt(page.total)} ข้อของการสแกนก่อนแก้ (export หน้าละ 200 ข้อ ${fmt(page.total)} ข้อจึงได้ ${PAGES.length} ชุด)
     รายงานนี้ติดตามว่าแต่ละข้อในชุดนี้ตอนนี้อยู่ในสถานะใด และแก้ด้วยวิธีไหน`,
    after,
    `<dt>ไฟล์ต้นทาง</dt><dd class="code">${esc(page.file)}</dd>`,
  )}

  <h2>สรุปผล</h2>
  ${summary}
  <p style="margin-top:3mm">จาก ${fmt(rows.length)} ข้อในชุดนี้ แก้ในโค้ดแล้ว ${fmt(c.fixed)} ข้อ (SonarQube ปิดเป็น FIXED)${
    heldN ? ` · ${fmt(heldN)} ข้อตรวจแล้วตั้งใจไม่แก้หรือเป็น false positive` : ""
  }${c.excluded ? ` · ${fmt(c.excluded)} ข้อมาจากโฟลเดอร์ที่ตัดออกจากการสแกนเพราะไม่ใช่โค้ดของระบบ` : ""}${
    openN ? ` · <b>ยังไม่ได้แก้ ${fmt(openN)} ข้อ</b>` : " · ไม่มีข้อที่ยังไม่ได้แก้"
  } · ข้อที่ไม่ได้แก้มีเหตุผลรายข้อในหัวข้อ "ข้อที่ไม่ได้แก้ในโค้ด"</p>

  <h2>แยกตามความรุนแรง (Severity)</h2>
  ${breakdownTable("Severity", bySev, SEVERITIES, (k) => `<span class="sev">${esc(k)}</span>`)}

  <h2>แยกตามประเภท</h2>
  ${breakdownTable("ประเภท", byType, TYPES.map(([k]) => k), (k) => esc(Object.fromEntries(TYPES)[k] || k))}

  <h2>แยกตามส่วนของระบบ</h2>
  ${breakdownTable("ส่วนของระบบ", byApp, APPS.map(([, l]) => l).concat("อื่น ๆ"), esc)}

  <h2>ข้อที่ไม่ได้แก้ในโค้ด (${fmt(rows.length - c.fixed)} ข้อ พร้อมเหตุผล)</h2>
  ${remainingTable(rows)}

  <h2 class="page-break">แยกตามกฎ (${fmt(byRule.size)} กฎ) — ปัญหาคืออะไร และแก้อย่างไร</h2>
  <p class="small muted">"แก้โดย" เขียนตามวิธีที่ใช้จริงในโปรเจกต์นี้ ไม่ใช่คำแนะนำทั่วไปของกฎ</p>
  ${breakdownTable("กฎ", byRule, ruleOrder, ruleCell, { firstClass: "rulecell" })}

  <h2>แยกตามไฟล์ (${fmt(byFile.size)} ไฟล์)</h2>
  ${breakdownTable("ไฟล์", byFile, fileOrder, (k) => `<span class="code">${esc(k)}</span>`)}

  ${methodNote(after)}
  <div class="note"><p>ผลการตรวจว่าระบบยังทำงานได้หลังแก้ (ตรวจ type, build และเทสต์อัตโนมัติ) รันกับทั้งระบบพร้อมกันครั้งเดียว
  จึงอยู่ในรายงานภาพรวม <span class="code">sonar-report-overview.pdf</span> หัวข้อ "หลักฐานว่าแก้แล้วระบบยังทำงานได้"</p></div>

  <h2 class="page-break">ภาคผนวก: รายการทั้งหมด ${fmt(rows.length)} ข้อในชุดนี้</h2>
  <p class="small muted">เรียงตาม severity แล้วตามไฟล์ · เลขบรรทัดเป็นตำแหน่งตอนสแกนก่อนแก้</p>
  ${fullList(rows)}
  `;
  return body;
}

// ตัวเลขเทสต์ของรายการตรวจที่เป็นชุดเทสต์ ส่วนรายการอื่นคืนสตริงว่าง
function checkDetail(r) {
  if (!r.detail) return "";
  const parts = [
    `${fmt(r.detail.passed)}/${fmt(r.detail.tests)} เทสต์ผ่าน`,
    `${fmt(r.detail.suitesPassed)}/${fmt(r.detail.suites)} ไฟล์เทสต์`,
  ];
  if (r.detail.failed) parts.push(`ล้ม ${fmt(r.detail.failed)}`);
  if (r.detail.pending) parts.push(`ข้าม ${fmt(r.detail.pending)}`);
  return `<div class="small muted">${parts.join(" · ")}</div>`;
}

function checkFailures(r) {
  return (r.failures || []).map((f) => `<div class="small fail">${esc(f)}</div>`).join("");
}

function checkResult(r) {
  return r.passed ? '<span class="pass">ผ่าน</span>' : '<span class="fail">ไม่ผ่าน</span>';
}

function gateBadge(gate) {
  if (!gate) return "ไม่มีสิทธิ์อ่านด้วย token นี้";
  const passed = gate.status === "OK";
  return `<span class="gate ${passed ? "ok" : "error"}">${passed ? "PASSED" : "FAILED"}</span>`;
}

function overviewReport(pageRows, after) {
  const all = pageRows.flat();
  const { c, html: summary } = summaryBlock(all);
  const beforeKeys = new Set(all.map((r) => r.b.key));
  const openNow = after.issues.filter((i) => i.status !== "CLOSED" && !i.resolution);
  const newOpen = openNow.filter((i) => !beforeKeys.has(i.key));
  const oldOpen = openNow.filter((i) => beforeKeys.has(i.key));
  const m = after.measures;
  const before = JSON.parse(fs.readFileSync(path.join(ROOT, BEFORE_MEASURES), "utf8"));
  const rating = (v) => ({ "1.0": "A", "2.0": "B", "3.0": "C", "4.0": "D", "5.0": "E" })[v] || v || "-";
  const gate = after.gate;

  const sevRow = (sev) => {
    const b = all.filter((r) => r.b.severity === sev).length;
    const o = oldOpen.filter((i) => i.severity === sev).length;
    const n = newOpen.filter((i) => i.severity === sev).length;
    return `<tr><td class="sev">${sev}</td><td class="num">${num(b)}</td><td class="num">${num(o)}</td><td class="num">${num(n)}</td><td class="num">${num(o + n)}</td></tr>`;
  };

  const perPage = PAGES.map((p, i) => {
    const rows = pageRows[i];
    const k = (x) => rows.filter((r) => r.state.kind === x).length;
    return `<tr><td>ชุดที่ ${p.n} · <span class="code">${esc(p.file)}</span></td><td class="num">${fmt(rows.length)}</td><td class="num">${num(k("fixed"))}</td><td class="num">${num(k("fp") + k("intentional"))}</td><td class="num">${num(k("excluded"))}</td><td class="num">${num(k("open") + k("gone"))}</td><td class="small">${esc(p.out)}</td></tr>`;
  }).join("");

  const gateConditions = gate?.conditions?.length
    ? `<table class="keep"><thead><tr><th>เงื่อนไข</th><th class="num">ค่าจริง</th><th class="num">เกณฑ์</th><th>ผล</th></tr></thead><tbody>${gate.conditions
        .map(
          (x) =>
            `<tr><td class="code">${esc(x.metricKey)}</td><td class="num">${esc(x.actualValue)}</td><td class="num">${esc(x.comparator === "LT" ? "≥ " : "≤ ")}${esc(x.errorThreshold)}</td><td>${x.status === "OK" ? '<span class="pill fixed">ผ่าน</span>' : '<span class="pill open">ไม่ผ่าน</span>'}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "";

  const newList = newOpen.length
    ? `<table><thead><tr><th style="width:19mm">Severity</th><th style="width:15mm">กฎ</th><th>ไฟล์:บรรทัด · ข้อความ</th></tr></thead><tbody>${[...newOpen]
        .sort((x, y) => SEVERITIES.indexOf(x.severity) - SEVERITIES.indexOf(y.severity) || relFile(x.component).localeCompare(relFile(y.component)))
        .map(
          (i) =>
            `<tr><td class="sev">${esc(i.severity)}</td><td class="code">${esc(ruleId(i.rule))}</td><td><div class="code">${esc(relFile(i.component))}:${esc(i.line ?? "-")}</div><div class="small">${esc(i.message)}</div></td></tr>`,
        )
        .join("")}</tbody></table>`
    : "<p>ไม่มี</p>";

  // --- คุณภาพซอฟต์แวร์ (Clean Code taxonomy) — หนึ่งข้ออาจกระทบได้มากกว่าหนึ่งด้าน
  const hasQ = (issue, q) => (issue.impacts || []).some((x) => x.softwareQuality === q);
  const mins = (list) => list.reduce((s, i) => s + effortMinutes(i.effort), 0);
  const allBefore = all.map((r) => r.b);
  const qualityRows = QUALITIES.map(([q, en, th]) => {
    const b = allBefore.filter((i) => hasQ(i, q));
    const o = oldOpen.filter((i) => hasQ(i, q));
    const n = newOpen.filter((i) => hasQ(i, q));
    return `<tr><td><b>${en}</b> <span class="small muted">${th}</span></td><td class="num">${num(b.length)}</td><td class="num">${num(o.length)}</td><td class="num">${num(n.length)}</td><td class="num">${num(o.length + n.length)}</td><td class="num">${hoursText(mins(b))}</td><td class="num">${hoursText(mins([...o, ...n]))}</td></tr>`;
  }).join("");
  const debtRow = `<tr><td>รวมทุกข้อ</td><td class="num">${fmt(allBefore.length)}</td><td class="num">${fmt(oldOpen.length)}</td><td class="num">${fmt(newOpen.length)}</td><td class="num">${fmt(openNow.length)}</td><td class="num">${hoursText(mins(allBefore))}</td><td class="num">${hoursText(mins(openNow))}</td></tr>`;

  // --- 10 กฎที่เจอบ่อยสุด
  const ruleTally = tally(all, (r) => r.b.rule);
  const topRules = [...ruleTally.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key)).slice(0, 10);
  const topRulesTable = `<table><thead><tr><th>กฎ · ปัญหาคืออะไร</th><th class="num">ก่อนแก้</th><th class="num">แก้แล้ว</th><th class="num">ตั้งใจไม่แก้ / FP</th><th class="num">ตัดออก</th><th class="num">ยังไม่ได้แก้</th></tr></thead><tbody>${topRules
    .map((r) => {
      const g = RULE_GUIDE[ruleId(r.key)];
      const problem = g ? `<div class="rg">${esc(g.problem)}</div>` : "";
      return `<tr><td class="rulecell"><span class="code"><b>${esc(ruleId(r.key))}</b></span> <span class="small muted">${esc(after.rules[r.key] || "")}</span>${problem}</td><td class="num">${num(r.total)}</td><td class="num">${num(r.fixed)}</td><td class="num">${num(r.fp + r.intentional)}</td><td class="num">${num(r.excluded)}</td><td class="num">${num(r.open + r.gone)}</td></tr>`;
    })
    .join("")}</tbody></table>`;

  // --- หลักฐานว่าระบบยังทำงานได้
  const checks = latestChecks();
  const checksBlock = checks
    ? `<p>รันเมื่อ ${esc(thDateTime(checks.ranAt))} บนเครื่องพัฒนา (Node ${esc(checks.node)}, ${esc(checks.platform)}) ด้วยสคริปต์ <span class="code">sonar-reports/run-checks.mjs</span> · ผลดิบอยู่ในไฟล์ <span class="code">${esc(checks.file)}</span></p>
  <table class="keep"><thead><tr><th>รายการตรวจ</th><th>คำสั่ง</th><th>ผล</th><th class="num">เวลา</th></tr></thead><tbody>${checks.results
    .map((r) => `<tr><td>${esc(r.label)}${checkDetail(r)}${checkFailures(r)}</td><td class="code">${esc(r.command)}</td><td>${checkResult(r)}</td><td class="num">${fmt(r.seconds)} วิ.</td></tr>`)
    .join("")}</tbody></table>`
    : `<p>ยังไม่มีผลรัน — รัน <span class="code">node sonar-reports/run-checks.mjs</span> ก่อนสร้างรายงาน</p>`;

  const historyBlock = `
  <h3>บันทึกการตรวจระหว่างแก้ (31 ต.ค. 2569)</h3>
  <p class="small muted">สรุปจากการสแกนแต่ละรอบระหว่างแก้ · ตัวเลขมาจาก SonarQube และผลรันเทสต์ในเครื่องพัฒนา</p>
  <table class="keep"><thead><tr><th style="width:38mm">รอบสแกน</th><th>สิ่งที่แก้และผลตรวจ</th></tr></thead><tbody>
    <tr><td>รอบ 62 · 17:16 น.</td><td>ก่อนแก้ 150 ข้อ · Security E · Reliability C · Coverage 40.3% · บันทึกเป็น issues_page1.json</td></tr>
    <tr><td>รอบ 63–65 · 19:42–19:50 น.</td><td>แก้ Security และ Reliability ครบ · เพิ่มเทสต์ integration ที่เรียก API จริงทุกบทบาท · Coverage 92.3% · เจอและแก้บั๊กจริง 6 จุด (audit log หาย, แก้แพ็กเกจแล้วค่าถูกรีเซ็ต, คำสั่งซื้อหมดอายุไม่เปลี่ยนสถานะ, chat stream ตอบ 500 และไม่หยุดดึงข้อมูล, อีเมลซ้ำตอบ 500, อัปโหลดผิดรูปแบบตอบ 500) · ตัดสคริปต์ใน deliverables/ และไฟล์ .env ออกจากการสแกน</td></tr>
    <tr><td>รอบ 66–68 · 20:12–20:27 น.</td><td>แก้ Maintainability ที่เหลือจนเป็น 0 · วัดตำแหน่งและขนาดจริงของปฏิทิน แชท แผงแจ้งเตือน และปุ่มเลือกรอบบิลในเบราว์เซอร์หลังเปลี่ยนเป็น dialog / fieldset ได้ค่าเท่าเดิมทุกค่า · Quality Gate ผ่าน</td></tr>
  </tbody></table>
  <div class="note"><p><b>ขอบเขตของหลักฐานนี้:</b> การผ่านทั้งหมดยืนยันว่าเทสต์และการตรวจที่มีอยู่ไม่พังหลังแก้ ไม่ได้พิสูจน์ว่าไม่มีบั๊กเลย ·
  เทสต์ end-to-end ด้วย Playwright ไม่ได้รันในรอบนี้ หน้าเว็บตรวจด้วย type check, lint, build และการวัดในเบราว์เซอร์</p></div>`;

  const openVulns = openNow.filter((i) => i.type === "VULNERABILITY");
  const vulnNote = openVulns.length
    ? `<div class="note"><p><b>Vulnerability ที่เปิดอยู่ ${fmt(openVulns.length)} ข้อ</b> (ที่มาของ Security Rating ${rating(m.security_rating)}):</p>${openVulns
        .map(
          (i) =>
            `<p><span class="code">${esc(ruleId(i.rule))}</span> ${esc(after.rules[i.rule] || "")} — <span class="code">${esc(relFile(i.component))}:${esc(i.line ?? "-")}</span> · ${
              beforeKeys.has(i.key) ? "อยู่ในชุด export เดิม" : `เป็นข้อใหม่หลังการสแกนก่อนแก้ ไม่อยู่ใน ${fmt(all.length)} ข้อเดิม`
            }</p>`,
        )
        .join("")}</div>`
    : "";
  const coverageNote = `<div class="note"><p><b>Test Coverage ${esc(before.coverage ?? "-")}% เป็น ${esc(m.coverage ?? "-")}%</b> — รวมผลของเทสต์ unit (<span class="code">coverage/lcov.info</span>) กับเทสต์ integration ที่เรียก route ใน app/api ผ่านฐานข้อมูลทดสอบจริง (<span class="code">coverage-integration/lcov.info</span>)
  · ไม่นับ coverage ของหน้าจอ (app/**/*.tsx, components/**) ที่ทดสอบด้วย Playwright, React hook ฝั่งเบราว์เซอร์, สคริปต์ CLI และไฟล์ตั้งค่า แต่ไฟล์พวกนี้ยังถูกตรวจหา bug และช่องโหว่ตามปกติ (เหตุผลอยู่ใน sonar-project.properties)</p></div>`;

  return `
  ${header(
    "รายงานผลการแก้ไขตาม SonarQube · ภาพรวม",
    "ภาพรวมก่อนและหลังแก้ทั้งโปรเจกต์",
    `สรุปรวม export ก่อนแก้ ${PAGES.length} ชุด (${fmt(all.length)} ข้อ) พร้อมสถานะปัจจุบันของโปรเจกต์ตามหัวข้อในคู่มือ (Quality Gate, ตัวชี้วัดหลัก, จำนวนตาม severity)
     รายละเอียดรายข้อแยกอยู่ในรายงานของแต่ละชุด`,
    after,
  )}

  <h2>ผลการแก้ไข ${fmt(all.length)} ข้อจากการสแกนก่อนแก้</h2>
  ${summary}
  <table class="keep" style="margin-top:4mm">
    <thead><tr><th>ชุด</th><th class="num">ข้อ</th><th class="num">แก้แล้ว</th><th class="num">ตั้งใจไม่แก้ / FP</th><th class="num">ตัดออก</th><th class="num">ยังไม่ได้แก้</th><th>ไฟล์รายงาน</th></tr></thead>
    <tbody>${perPage}</tbody>
    <tfoot><tr><td>รวม</td><td class="num">${fmt(all.length)}</td><td class="num">${fmt(c.fixed)}</td><td class="num">${fmt(c.fp + c.intentional)}</td><td class="num">${fmt(c.excluded)}</td><td class="num">${fmt(c.open + c.gone)}</td><td></td></tr></tfoot>
  </table>

  <h2>หนี้ทางเทคนิคและคุณภาพซอฟต์แวร์</h2>
  <p class="small muted">แยกตาม Software Quality ของ SonarQube รุ่นใหม่ · หนึ่งข้ออาจกระทบมากกว่าหนึ่งด้าน ผลรวมรายด้านจึงอาจมากกว่าแถวรวม · เวลาเป็นค่าที่ SonarQube ประเมิน (1 วัน = 8 ชม.) · "ก่อนแก้" รวม ${fmt(c.excluded)} ข้อจากโฟลเดอร์ที่ตัดออกจากการสแกนด้วย</p>
  <table class="keep">
    <thead><tr><th>ด้าน</th><th class="num">ก่อนแก้</th><th class="num">ข้อเดิมที่ยังเปิด</th><th class="num">ข้อใหม่</th><th class="num">เปิดอยู่ตอนนี้</th><th class="num">เวลาแก้ ก่อน</th><th class="num">เวลาแก้ ตอนนี้</th></tr></thead>
    <tbody>${qualityRows}</tbody>
    <tfoot>${debtRow}</tfoot>
  </table>

  <h2>กฎที่เจอบ่อยที่สุด 10 อันดับ</h2>
  <p class="small muted">วิธีแก้ของทุกกฎอยู่ในรายงานแต่ละชุด หัวข้อ "แยกตามกฎ"</p>
  ${topRulesTable}

  <h2>จำนวนข้อที่เปิดอยู่ตาม Severity</h2>
  <p class="small muted">นับเฉพาะข้อที่ยังเปิด (resolved=false) · "ข้อใหม่" คือปัญหาจากโค้ดที่เขียนหลังการสแกนก่อนแก้ ไม่อยู่ในไฟล์ export</p>
  <table class="keep">
    <thead><tr><th>Severity</th><th class="num">ก่อนแก้ (${esc(BEFORE_LABEL)})</th><th class="num">ข้อเดิมที่ยังเปิด</th><th class="num">ข้อใหม่</th><th class="num">เปิดอยู่ตอนนี้</th></tr></thead>
    <tbody>${SEVERITIES.map(sevRow).join("")}</tbody>
    <tfoot><tr><td>รวม</td><td class="num">${fmt(all.length)}</td><td class="num">${fmt(oldOpen.length)}</td><td class="num">${fmt(newOpen.length)}</td><td class="num">${fmt(openNow.length)}</td></tr></tfoot>
  </table>

  <h2>Quality Gate และตัวชี้วัดหลัก ก่อน / หลังแก้</h2>
  <p>Quality Gate: ${gateBadge(gate)}</p>
  ${gateConditions}
  <table class="keep">
    <thead><tr><th>ตัวชี้วัด</th><th class="num">ก่อนแก้ (${esc(BEFORE_LABEL)})</th><th class="num">หลังแก้ (ตอนนี้)</th></tr></thead>
    <tbody>${METRIC_ROWS.map(([key, label, kind]) => {
      const show = (v) => {
        if (kind === "rating") return rating(v);
        if (kind === "gate") return ({ OK: "PASSED", ERROR: "FAILED" })[v] || v || "-";
        if (kind === "int" && v) return fmt(v);
        return esc(v ?? "-");
      };
      return `<tr><td>${esc(label)}</td><td class="num">${show(before[key])}</td><td class="num">${show(m[key])}</td></tr>`;
    }).join("")}</tbody>
  </table>
  ${vulnNote}
  ${coverageNote}

  <h2>หลักฐานว่าแก้แล้วระบบยังทำงานได้</h2>
  <p>การแก้ code smell หลายร้อยจุดเสี่ยงทำให้ส่วนที่เคยทำงานได้พังโดยไม่ตั้งใจ จึงตรวจทั้งระบบซ้ำด้วยเครื่องมือชุดเดียวกับที่ใช้ระหว่างพัฒนา</p>
  <h3>ผลตรวจล่าสุด</h3>
  ${checksBlock}
  ${historyBlock}

  <h2>ข้อใหม่หลังการสแกนครั้งแรก (${fmt(newOpen.length)} ข้อ)</h2>
  <p class="small muted">ปัญหาเหล่านี้มาจากโค้ดที่เพิ่มหรือแก้หลัง ${esc(BEFORE_LABEL)} จึงไม่อยู่ในไฟล์ export และไม่ได้นับในผลการแก้ไขด้านบน</p>
  ${newList}

  ${methodNote(after)}
  `;
}

function wrap(title, body) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>${fontFace()}${CSS}</style></head><body>${body}</body></html>`;
}

async function toPdf(browser, html, outFile, title) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: outFile,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-size:7.5pt;color:#8a8fa3;padding:0 16mm;display:flex;justify-content:space-between;font-family:Tahoma,sans-serif">
      <span>Nestly · SonarQube · ${esc(title)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: "15mm", bottom: "16mm", left: "16mm", right: "16mm" },
  });
  await page.close();
}

async function main() {
  const fromIdx = process.argv.indexOf("--from");
  let after;
  if (fromIdx > -1) {
    after = JSON.parse(fs.readFileSync(path.resolve(ROOT, process.argv[fromIdx + 1]), "utf8"));
  } else {
    after = await fetchAfter();
    const stamp = new Date(after.fetchedAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
    const snap = path.join(ROOT, `issues_after_${stamp}.json`);
    fs.writeFileSync(snap, JSON.stringify(after, null, 1));
    console.log(`saved snapshot ${path.basename(snap)} (${after.issues.length} issues)`);
  }

  RULES_NAME = after.rules;
  const byKey = new Map(after.issues.map((i) => [i.key, i]));
  const pages = loadBefore();
  const pageRows = pages.map((p) =>
    p.issues.map((b) => {
      const a = byKey.get(b.key) || null;
      return { b, a, state: classify(b, a) };
    }),
  );

  // เปิด sandbox ของ Chromium ไว้ตามค่าเริ่มต้น รันบนเครื่องพัฒนาไม่จำเป็นต้องปิด
  const browser = await puppeteer.launch();
  try {
    for (let i = 0; i < pages.length; i++) {
      const title = `ชุดที่ ${pages[i].n} (${pages[i].file})`;
      await toPdf(browser, wrap(`SonarQube ${title}`, pageReport(pages[i], pageRows[i], after)), path.join(OUT_DIR, pages[i].out), `page ${pages[i].n} (${pages[i].file})`);
      const k = (x) => pageRows[i].filter((r) => r.state.kind === x).length;
      console.log(`${pages[i].out}: ${pageRows[i].length} issues · fixed ${k("fixed")} · fp ${k("fp")} · intentional ${k("intentional")} · excluded ${k("excluded")} · open ${k("open")} · gone ${k("gone")}`);
    }
    await toPdf(browser, wrap("SonarQube ภาพรวม", overviewReport(pageRows, after)), path.join(OUT_DIR, "sonar-report-overview.pdf"), "overview");
    console.log("sonar-report-overview.pdf");
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
