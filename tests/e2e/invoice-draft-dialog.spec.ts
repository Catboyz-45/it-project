import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// หน้าต่างสร้างร่างบิลเคยมีหัวภาษาอังกฤษ หัวข้อซ้ำกับแถบขั้นตอน และกล่องขอบเขตที่เป็นตัวหนังสือใหญ่สูงไม่เท่าช่องข้าง ๆ
test("invoice draft dialog lines read-only values up with its fields", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);

  await page.goto(`/admin/properties/${e2e.propertyId}/invoices`);
  await page.getByRole("button", { name: "สร้างร่างบิล" }).click();
  const dialog = page.getByRole("dialog", { name: "สร้างร่างบิล" });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText("Draft-first");

  const steps = dialog.getByRole("list", { name: "ขั้นตอนสร้างร่างบิล" });
  await expect(steps.getByRole("listitem")).toHaveCount(3);
  await expect(steps.locator('[aria-current="step"]')).toContainText("เลือกขอบเขต");

  // ขอบเขตเป็นช่องอ่านอย่างเดียว ป้ายอยู่ข้างบน และสูงเท่าช่องเลือกเดือนที่อยู่แถวเดียวกัน
  const scope = dialog.getByRole("group", { name: "ขอบเขต" });
  await expect(scope).toContainText("ห้องที่มีผู้เช่า");
  const valueBox = (await scope.locator(".readonly-field-value").boundingBox())!;
  const monthBox = (await dialog.locator(".dropdown-trigger").first().boundingBox())!;
  expect(Math.round(valueBox.height)).toBe(Math.round(monthBox.height));
  expect(Math.round(valueBox.y)).toBe(Math.round(monthBox.y));
});

// รายการเดือนเคยถูกขอบหน้าต่างตัดครึ่ง และหน้าต่างมีแถบเลื่อนโผล่ขึ้นมา ขั้นที่สองเคยโชว์เดือนเป็น 2026-11
// และปุ่มถัดไปที่กดไม่ได้ยังเป็นสีม่วงเหมือนกดได้
test("invoice draft dropdowns float above the dialog and step two reads cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);

  await page.goto(`/admin/properties/${e2e.propertyId}/invoices`);
  await page.getByRole("button", { name: "สร้างร่างบิล" }).click();
  const dialog = page.getByRole("dialog", { name: "สร้างร่างบิล" });
  await dialog.getByRole("button", { name: "เดือนที่ออกบิล" }).click();
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  // รายการอยู่นอกหน้าต่าง จึงไม่ถูกขอบตัด และอยู่ในจอทั้งหมด
  expect(await listbox.evaluate((element) => Boolean(element.closest(".modal")))).toBe(false);
  const box = (await listbox.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(720);
  expect(await dialog.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(listbox).toBeHidden();
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: /ถัดไป/ }).click();
  await expect(dialog.getByRole("list", { name: "ขั้นตอนสร้างร่างบิล" }).locator('[aria-current="step"]')).toContainText("ตรวจข้อมูล");
  await expect(dialog).not.toContainText(/\d{4}-\d{2}/);
  await expect(dialog).not.toContainText(/ห้อง (\S+): ห้อง \1/);
  const back = dialog.getByRole("button", { name: /ย้อนกลับ/ });
  // ไอคอนกับคำต้องอยู่บรรทัดเดียวกัน ปุ่มจึงไม่สูงเกินปุ่มข้าง ๆ
  expect((await back.boundingBox())!.height).toBeLessThanOrEqual(44);
  const next = dialog.getByRole("button", { name: /ถัดไป/ });
  if (await next.isDisabled()) await expect(next).toHaveCSS("background-color", "rgb(228, 228, 231)");
});
