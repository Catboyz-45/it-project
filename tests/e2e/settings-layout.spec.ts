import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// หน้าตั้งค่าหอต้องเว้นขอบซ้ายขวาให้การ์ดทุกขนาดจอ หัวข้อตรงกับการ์ด และแต่ละหมวดมีคำอธิบายของตัวเอง
test("settings keep side gutters and per-section descriptions on narrow screens", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);

  for (const [width, gutter] of [[1024, 24], [390, 16]] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/admin/properties/${e2e.propertyId}/settings`);
    await page.getByRole("tab", { name: "ห้องพัก" }).click();
    const heading = page.locator(".settings-heading");
    await expect(heading).toContainText("ชั้นและห้องพักที่แสดงในผังห้อง");
    const box = await page.evaluate(() => {
      const card = document.querySelector(".settings-content .settings-section, .settings-content .settings-card")!.getBoundingClientRect();
      const title = document.querySelector(".settings-heading h2")!.getBoundingClientRect();
      return { right: innerWidth - card.right, titleLeft: Math.round(title.left), cardLeft: Math.round(card.left) };
    });
    expect(box.right, `ขอบขวาที่ ${width}px`).toBeGreaterThanOrEqual(gutter);
    expect(box.titleLeft, `หัวข้อตรงกับการ์ดที่ ${width}px`).toBe(box.cardLeft);
  }
});
