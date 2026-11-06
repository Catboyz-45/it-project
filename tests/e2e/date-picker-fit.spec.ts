import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// ปฏิทินในหน้าต่างสร้างสัญญาเคยสูง 363px และล้นขอบล่างของจอ ต้องเลื่อนหน้าจอถึงจะเห็นแถวสุดท้าย
// ตอนนี้ต้องเตี้ยพอ อยู่ในจอทั้งหมด และไม่เติมสัปดาห์ที่เป็นของเดือนหน้าทั้งแถว
test("contract date picker stays compact and inside the screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);

  await page.goto(`/admin/properties/${e2e.propertyId}/contracts`);
  await page.getByRole("button", { name: "สร้างสัญญา", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "สร้างสัญญาใหม่" });

  // ช่องที่ยังไม่ได้เลือกเป็นสีเทาแบบช่องว่าง ไม่ดูเหมือนมีค่าแล้ว
  const placeholderColor = "rgb(98, 100, 108)";
  await expect(dialog.locator(".schedule-date-trigger .is-placeholder").first()).toHaveCSS("color", placeholderColor);
  await expect(dialog.locator(".dropdown-trigger .is-placeholder").first()).toHaveCSS("color", placeholderColor);

  for (const label of ["วันเริ่มสัญญา", "วันสิ้นสุดสัญญา"]) {
    await dialog.getByRole("button", { name: label, exact: true }).click();
    const calendar = page.getByRole("dialog", { name: `เลือก${label}` });
    await expect(calendar.locator("[data-date]").first()).toBeVisible();
    const box = (await calendar.boundingBox())!;
    expect(box.height, `${label} สูงไม่เกิน 290px`).toBeLessThanOrEqual(290);
    expect(box.y, `${label} ไม่ล้นขอบบน`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${label} ไม่ล้นขอบล่าง`).toBeLessThanOrEqual(720);

    // แถวสุดท้ายต้องมีวันของเดือนที่แสดงอยู่อย่างน้อยหนึ่งวัน
    const days = calendar.locator("[data-date]");
    const count = await days.count();
    expect(count % 7).toBe(0);
    const lastWeekClasses = await days.evaluateAll((buttons) => buttons.slice(-7).map((button) => button.className));
    expect(lastWeekClasses.some((name) => !name.includes("muted"))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(calendar).toBeHidden();
  }
});
