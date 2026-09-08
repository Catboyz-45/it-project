/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคำสั่งสำหรับนักพัฒนา/ระบบอัตโนมัติในงาน “maintenance worker”
 * การทำงาน: เรียกใช้จาก terminal หรือ package script เพื่อทำงานบำรุงรักษาที่ทำซ้ำได้; ควรทดลองในสภาพแวดล้อมที่ไม่ใช่ production ก่อนเมื่อมีการเขียนข้อมูล
 */

const endpoint = process.env.JOB_ENDPOINT ?? "http://app:3000/api/internal/jobs/maintenance";
const secret = process.env.JOB_SECRET;
const intervalSeconds = Number(process.env.JOB_INTERVAL_SECONDS ?? "300");

if (!secret || secret.length < 32) throw new Error("JOB_SECRET must contain at least 32 characters");
if (!Number.isInteger(intervalSeconds) || intervalSeconds < 60 || intervalSeconds > 86_400) {
  throw new Error("JOB_INTERVAL_SECONDS must be an integer between 60 and 86400");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “execute” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function execute() {
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(70_000),
    });
    const payload = await response.json();
    console.log(JSON.stringify({
      level: response.ok ? "info" : "error",
      event: "maintenance_job_request",
      startedAt,
      status: response.status,
      result: response.ok ? payload.data?.status : "failed",
      failedFiles: response.ok ? payload.data?.failedFiles : undefined,
    }));
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "maintenance_job_request",
      startedAt,
      result: "failed",
      message: error instanceof Error ? error.message : "Unknown error",
    }));
  }
}

await execute();
setInterval(() => void execute(), intervalSeconds * 1000);
