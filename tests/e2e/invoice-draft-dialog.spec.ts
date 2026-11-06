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
  await page.getByRole("button", { name: "สร้างร่างทั้งหอ" }).click();
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
