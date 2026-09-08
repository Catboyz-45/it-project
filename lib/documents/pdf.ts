/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: ดูแลขั้นตอนสร้างหรือจัดรูปแบบเอกสารในหัวข้อ “pdf”
 * การทำงาน: รับข้อมูลที่ผ่านการตรวจแล้ว สร้างผลลัพธ์เอกสารอย่างสม่ำเสมอ และส่งต่อให้ storage โดยไม่เปิดเผยตำแหน่งไฟล์จริงแก่ผู้ใช้
 */

import puppeteer from "puppeteer";
import { getServerEnv } from "@/lib/server/env";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกอบหรือคำนวณผลลัพธ์ของ “generate Pdf” จากข้อมูลที่ได้รับ
 * รับค่า:
 * - html: ค่า “html” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function generatePdf(html: string) {
  const env = getServerEnv();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: env.PUPPETEER_EXECUTABLE_PATH,
  });

  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });
    const bytes = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, timeout: 20_000 });
    return Buffer.from(bytes);
  } finally {
    await browser.close();
  }
}
