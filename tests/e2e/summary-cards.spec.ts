import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// การ์ดสรุปเคยมีสี่แบบ แต่ละหน้าหน้าตาไม่เหมือนกัน ตอนนี้ทุกหน้าใช้การ์ดชุดเดียว
// หน้าบิลเคยมีปุ่มสร้างร่างสองปุ่มกับกล่องกรองสถานะที่ซ้ำกับแถบตัวเลข เหลือปุ่มเดียวและกรองจากการ์ดอย่างเดียว
test("summary cards look the same everywhere and filter invoices", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);

  await page.goto(`/admin/properties/${e2e.propertyId}/invoices`);
  await expect(page.getByRole("button", { name: "สร้างร่างบิล", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /สร้างร่าง(?:รายห้อง|ทั้งหอ)/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "กรองสถานะ", exact: true })).toHaveCount(0);

  const cards = page.getByRole("group", { name: "สรุปบิลและกรองตามสถานะ" }).getByRole("button");
  await expect(cards).toHaveCount(6);
  await expect(cards.first()).toHaveAttribute("aria-pressed", "true");
  // บิลที่ยกเลิกเคยกรองได้จากกล่องตัวเลือกเท่านั้น ตอนนี้มีการ์ดของตัวเอง
  const cancelled = cards.filter({ hasText: "ยกเลิก" });
  const request = page.waitForRequest((candidate) => candidate.url().includes("/invoices?") && candidate.url().includes("status=CANCELLED"));
  await cancelled.click();
  await request;
  await expect(cancelled).toHaveAttribute("aria-pressed", "true");
  await expect(cards.first()).toHaveAttribute("aria-pressed", "false");

  // ทุกหน้าที่มีตัวเลขสรุปใช้การ์ดชุดเดียวกัน ขอบ มุม และตัวเลขเท่ากันหมด
  const looks: string[] = [];
  for (const section of ["", "/tenants", "/rooms", "/parcels", "/meters/water"]) {
    await page.goto(`/admin/properties/${e2e.propertyId}${section}`);
    const card = page.locator(".summary-card").first();
    await expect(card).toBeVisible();
    looks.push(await card.evaluate((element) => {
      const style = getComputedStyle(element);
      const value = getComputedStyle(element.querySelector(".summary-card-value")!);
      return [style.borderTopWidth, style.borderTopLeftRadius, value.fontSize, value.fontWeight].join(" ");
    }));
  }
  expect(new Set(looks).size, looks.join(" | ")).toBe(1);
});
