import puppeteer, { type Browser, type Page } from "puppeteer";
import { getServerEnv } from "@/lib/server/env";

// ตัวเลือกตอนเปิดเบราว์เซอร์ แยกออกมาเป็นฟังก์ชันบริสุทธิ์เพื่อให้ทดสอบได้
// ตั้ง executablePath ไว้แปลว่ากำลังรันใน container ที่ลง Chromium ไว้เอง
// ซึ่ง sandbox ของ Chromium ทำงานไม่ได้เพราะ container ส่วนใหญ่ไม่เปิด user namespace
// ให้ จึงต้องปิด ไม่งั้นเบราว์เซอร์เปิดไม่ขึ้นเลยและการสร้าง PDF จะล้มทุกครั้ง
//
// ที่ยอมปิดได้เพราะเนื้อหาที่ render ถูกกันไว้สองชั้นอยู่แล้ว HTML ของ template
// ผ่าน sanitizeTemplate ก่อนบันทึก และหน้าที่ render ปิด JavaScript ไว้ข้างล่าง
// จึงไม่มีสคริปต์ทำงานในเบราว์เซอร์ของเซิร์ฟเวอร์ ส่วนตัว container เองก็รันด้วยผู้ใช้ที่ไม่ใช่ root
//
// dev-shm ใน container มีขนาดเล็กมาก ถ้าไม่ปิด Chromium จะพังตอนเจอเอกสารยาว
export function browserLaunchOptions(executablePath?: string) {
  if (!executablePath) return { headless: true as const };
  return {
    headless: true as const,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  };
}

// เปิด Chromium ใหม่ทุกครั้งกินเวลาหลายวินาทีบนเซิร์ฟเวอร์เล็ก ผู้ใช้กดดูตัวอย่างแล้วรอนาน
// จึงเปิดไว้ตัวเดียวแล้วใช้ซ้ำ แต่ละคำขอได้แท็บของตัวเองที่ปิดทิ้งทันทีหลังใช้
// ว่างครบ 5 นาทีค่อยปิดเบราว์เซอร์ คืนหน่วยความจำให้เครื่องตอนไม่มีใครใช้
const idleCloseMs = 5 * 60 * 1000;
let sharedBrowser: Promise<Browser> | null = null;
let activeRenders = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function getBrowser() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (!sharedBrowser) {
    const launching = puppeteer.launch(browserLaunchOptions(getServerEnv().PUPPETEER_EXECUTABLE_PATH));
    sharedBrowser = launching;
    // เบราว์เซอร์ตายหรือเปิดไม่ขึ้น ลืมตัวเดิมไป คำขอถัดไปจะเปิดใหม่เอง ไม่ค้างใช้ตัวที่พังไปตลอด
    launching.then(
      (browser) => browser.once("disconnected", () => { if (sharedBrowser === launching) sharedBrowser = null; }),
      () => { if (sharedBrowser === launching) sharedBrowser = null; },
    );
  }
  return sharedBrowser;
}

function scheduleIdleClose() {
  if (activeRenders > 0 || !sharedBrowser) return;
  const browser = sharedBrowser;
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (activeRenders > 0 || sharedBrowser !== browser) return;
    sharedBrowser = null;
    void browser.then((instance) => instance.close()).catch(() => undefined);
  }, idleCloseMs);
  // ตัวจับเวลานี้ไม่ควรกันไม่ให้ process ปิดตัวตอนเซิร์ฟเวอร์หยุด
  idleTimer.unref?.();
}

// แปลง HTML เป็น PDF ด้วยเบราว์เซอร์จริง เพราะต้องได้ผลตรงกับที่เห็นในตัวแก้ไข
export async function generatePdf(html: string) {
  activeRenders += 1;
  let page: Page | null = null;
  try {
    page = await (await getBrowser()).newPage();
    // ปิด JavaScript เพราะ HTML มาจากที่ผู้ใช้แก้ได้ ไม่ควรให้มีสคริปต์ทำงานในเบราว์เซอร์ของเซิร์ฟเวอร์
    await page.setJavaScriptEnabled(false);
    // ตั้ง timeout ไว้ทั้งสองขั้น กันเอกสารที่มีปัญหาทำให้เบราว์เซอร์ค้างกินหน่วยความจำไม่เลิก
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });
    // preferCSSPageSize ให้ CSS ในเอกสารเป็นคนกำหนดขนาดหน้า ผลจะได้ตรงกับที่เห็นในตัวแก้ไข
    const bytes = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, timeout: 20_000 });
    return Buffer.from(bytes);
  } finally {
    // ปิดแท็บทุกกรณี เอกสารก่อนหน้าจะได้ไม่ค้างอยู่ในเบราว์เซอร์ที่ใช้ร่วมกัน
    await page?.close().catch(() => undefined);
    activeRenders -= 1;
    scheduleIdleClose();
  }
}
