import puppeteer from "puppeteer";
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

// แปลง HTML เป็น PDF ด้วยเบราว์เซอร์จริง เพราะต้องได้ผลตรงกับที่เห็นในตัวแก้ไข
export async function generatePdf(html: string) {
  const env = getServerEnv();
  const browser = await puppeteer.launch(browserLaunchOptions(env.PUPPETEER_EXECUTABLE_PATH));

  try {
    const page = await browser.newPage();
    // ปิด JavaScript เพราะ HTML มาจากที่ผู้ใช้แก้ได้ ไม่ควรให้มีสคริปต์ทำงานในเบราว์เซอร์ของเซิร์ฟเวอร์
    await page.setJavaScriptEnabled(false);
    // ตั้ง timeout ไว้ทั้งสองขั้น กันเอกสารที่มีปัญหาทำให้เบราว์เซอร์ค้างกินหน่วยความจำไม่เลิก
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });
    // preferCSSPageSize ให้ CSS ในเอกสารเป็นคนกำหนดขนาดหน้า ผลจะได้ตรงกับที่เห็นในตัวแก้ไข
    const bytes = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, timeout: 20_000 });
    return Buffer.from(bytes);
  } finally {
    // ต้องปิดทุกกรณี ไม่งั้น process ของเบราว์เซอร์ค้างสะสมจนเครื่องเต็ม
    await browser.close();
  }
}
