// ตัวจับเวลาที่รันเป็นคอนเทนเนอร์แยก คอยยิงเรียกงานบำรุงรักษาตามรอบ
// งานจริงอยู่ในแอป ไฟล์นี้แค่เป็นคนกดเรียกเท่านั้น
const endpoint = process.env.JOB_ENDPOINT ?? "http://app:3000/api/internal/jobs/maintenance";
const secret = process.env.JOB_SECRET;
const intervalSeconds = Number(process.env.JOB_INTERVAL_SECONDS ?? "300");
// ตัวตั้งเวลาภายนอกเป็นคนกำหนดรอบให้เอง สคริปต์จึงต้องยิงครั้งเดียวแล้วจบ
// ไม่ใช่ค้างเป็น process ที่ไม่มีวันจบ ซึ่งจะทำให้งานตามตารางไม่ปิดตัวลงเลย
const runOnce = process.env.JOB_RUN_ONCE === "true";

// ตรวจค่าตั้งค่าตั้งแต่เริ่ม ผิดตั้งแต่แรกจะได้ตายทันที ไม่ใช่ไปพังตอนยิงจริงรอบแรก
if (!secret || secret.length < 32) throw new Error("JOB_SECRET must contain at least 32 characters");
if (!runOnce && (!Number.isInteger(intervalSeconds) || intervalSeconds < 60 || intervalSeconds > 86_400)) {
  throw new Error("JOB_INTERVAL_SECONDS must be an integer between 60 and 86400");
}

// ยิงเรียกหนึ่งครั้งแล้วบันทึกผล คืนค่าว่าสำเร็จไหมแทนการโยน error
// เพราะโหมดรันค้างต้องไม่ตายเพราะพลาดรอบเดียว ส่วนโหมดรันครั้งเดียวเอาค่านี้ไปทำรหัสออก
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
    return response.ok;
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "maintenance_job_request",
      startedAt,
      result: "failed",
      message: error instanceof Error ? error.message : "Unknown error",
    }));
    return false;
  }
}

// ยิงรอบแรกทันทีไม่ต้องรอ
let succeeded = await execute();

// ตัวตั้งเวลามักยิงตอนที่ไม่มีคนใช้งาน ซึ่งเป็นตอนที่เครื่องและฐานข้อมูลหลับอยู่พอดี
// ครั้งแรกจึงล้มได้เพราะรอเครื่องตื่นไม่ทัน ลองซ้ำอีกครั้งหลังเว้นช่วงจึงผ่าน
// ไม่ลองรัวเพราะถ้าล้มด้วยเหตุอื่นจริง การยิงซ้ำถี่ ๆ ไม่ได้ช่วยอะไร
if (runOnce && !succeeded) {
  await new Promise((resolve) => setTimeout(resolve, 20_000));
  succeeded = await execute();
}

// โหมดรันครั้งเดียวจบแล้วออกเลย และคืนรหัสออกให้ตัวตั้งเวลารู้ว่าสำเร็จหรือไม่
// ไม่งั้นงานที่ล้มจะถูกนับว่าผ่านทุกครั้ง
if (runOnce) process.exit(succeeded ? 0 : 1);

// โหมดรันค้างเป็นบริการ ตั้งรอบถัดไปตามช่วงเวลาที่กำหนด
setInterval(() => void execute(), intervalSeconds * 1000);
