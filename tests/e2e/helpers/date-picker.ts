import { expect, type Locator, type Page } from "@playwright/test";

// เลือกวันจากปฏิทินที่เขียนเอง ใช้แทน input type="date" ของเบราว์เซอร์ที่ fill() ได้ตรง ๆ
// ช่องวันแต่ละช่องมี data-date เป็น YYYY-MM-DD จึงเล็งวันที่ต้องการได้แม่น
// ถ้าเดือนที่เปิดอยู่ยังไม่มีวันนั้น ให้กดเลื่อนช่วงไปเรื่อย ๆ จนเจอ
export async function pickDate(scope: Locator, page: Page, label: string, isoDate: string) {
  await scope.getByRole("button", { name: label, exact: true }).click();
  const calendar = page.getByRole("dialog", { name: `เลือก${label}` });
  await expect(calendar).toBeVisible();
  // รอให้ตารางวันขึ้นก่อน ไม่งั้นรอบแรกจะนับได้ศูนย์แล้วเผลอกดเลื่อนเดือนหนีไป
  await expect(calendar.locator("[data-date]").first()).toBeVisible();
  const day = calendar.locator(`[data-date="${isoDate}"]`);
  const target = new Date(`${isoDate}T00:00:00`);
  for (let step = 0; step < 48 && await day.count() === 0; step += 1) {
    // ดูจากวันแรกที่ปฏิทินแสดงอยู่ว่าต้องเดินหน้าหรือถอยหลัง
    const shown = await calendar.locator("[data-date]").first().getAttribute("data-date");
    const forward = shown !== null && new Date(`${shown}T00:00:00`) < target;
    await calendar.getByRole("button", { name: forward ? "ช่วงถัดไป" : "ช่วงก่อนหน้า" }).click();
  }
  await day.click();
  await expect(calendar).toBeHidden();
}

// อ่านค่าที่เลือกไว้ ปุ่มแสดงวันที่เป็นข้อความไทย ไม่ใช่ค่า value ของ input
export function pickedDateText(scope: Locator, label: string) {
  return scope.getByRole("button", { name: label, exact: true });
}
