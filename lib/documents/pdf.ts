import puppeteer from "puppeteer";
import { getServerEnv } from "@/lib/server/env";

// แปลง HTML เป็น PDF ด้วยเบราว์เซอร์จริง เพราะต้องได้ผลตรงกับที่เห็นในตัวแก้ไข
export async function generatePdf(html: string) {
  const env = getServerEnv();
  const browser = await puppeteer.launch({
    headless: true,
    // ระบุ path ของเบราว์เซอร์ผ่าน env เพื่อให้ใช้ตัวที่ติดตั้งไว้ใน image ตอนอยู่ใน Docker
    executablePath: env.PUPPETEER_EXECUTABLE_PATH,
  });

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
