import { expect, type Page } from "@playwright/test";

// เปิดหน้าเข้าสู่ระบบแล้วรอให้ฟอร์มพร้อมก่อนค่อยกรอก
// ปุ่มเข้าสู่ระบบกดไม่ได้จนกว่า React จะ hydrate เสร็จ ถ้ากรอกก่อนหน้านั้น
// React จะเอาค่าว่างจาก state มาทับสิ่งที่กรอกไว้ กดเข้าสู่ระบบแล้วจึงค้างอยู่หน้าเดิม
export async function openLoginForm(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /เข้าสู่ระบบ/ })).toBeEnabled();
}

// รอจนออกจากหน้าเข้าสู่ระบบหลังกดเข้าสู่ระบบแล้ว
// ให้เวลา 30 วินาที เพราะ next dev ต้องคอมไพล์หน้าปลายทางตอนเปิดครั้งแรก ค่าเริ่มต้น 5 วินาทีไม่พอ
export async function expectLeftLoginPage(page: Page) {
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
}
