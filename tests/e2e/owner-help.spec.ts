import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// คู่มือของเจ้าของหอต้องค้นหาได้ อ่านเป็นขั้นตอน และปุ่มท้ายบทความพาไปหน้าที่ต้องทำจริง
test("owner help guides to the payment channel settings", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);

  await page.goto(`/admin/properties/${e2e.propertyId}/help`);
  await page.getByLabel("ค้นหาคู่มือ").fill("PromptPay");
  await page.getByRole("button", { name: /ช่องทางรับเงิน/ }).click();
  const article = page.getByRole("article", { name: "ตั้ง PromptPay และบัญชีธนาคาร" });
  await expect(article.getByRole("listitem")).toHaveCount(4);
  await article.getByRole("link", { name: "ไปตั้งค่าช่องทางรับเงิน" }).click();

  await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}/settings\\?section=cycles$`));
  await expect(page.getByLabel("เลขพร้อมเพย์รับเงิน")).toBeVisible();
});
