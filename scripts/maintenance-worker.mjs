// ตัวจับเวลาที่รันเป็นคอนเทนเนอร์แยก คอยยิงเรียกงานบำรุงรักษาตามรอบ
// งานจริงอยู่ในแอป ไฟล์นี้แค่เป็นคนกดเรียกเท่านั้น
const endpoint = process.env.JOB_ENDPOINT ?? "http://app:3000/api/internal/jobs/maintenance";
const secret = process.env.JOB_SECRET;
const intervalSeconds = Number(process.env.JOB_INTERVAL_SECONDS ?? "300");

// ตรวจค่าตั้งค่าตั้งแต่เริ่ม ผิดตั้งแต่แรกจะได้ตายทันที ไม่ใช่ไปพังตอนยิงจริงรอบแรก
if (!secret || secret.length < 32) throw new Error("JOB_SECRET must contain at least 32 characters");
if (!Number.isInteger(intervalSeconds) || intervalSeconds < 60 || intervalSeconds > 86_400) {
  throw new Error("JOB_INTERVAL_SECONDS must be an integer between 60 and 86400");
}

// ยิงเรียกหนึ่งครั้งแล้วบันทึกผล ไม่โยน error ออกไป งานตั้งเวลาจะได้ไม่ตายเพราะพลาดรอบเดียว
async function execute() {
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      // ตัดที่ 70 วินาที นานกว่ารอบที่งานใช้จริง แต่ไม่ปล่อยให้ค้างไปเรื่อย ๆ
      signal: AbortSignal.timeout(70_000),
    });
    const payload = await response.json();
    // บันทึกเป็น JSON บรรทัดเดียว ระบบรวบรวม log จะได้แยกฟิลด์ไปค้นหาได้
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

// ยิงรอบแรกทันทีไม่ต้องรอ แล้วค่อยตั้งรอบถัดไปตามช่วงเวลาที่กำหนด
await execute();
setInterval(() => void execute(), intervalSeconds * 1000);
