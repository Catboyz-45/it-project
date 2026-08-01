import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-800", width: 800, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of ["/", "/products", "/admin", "/admin/products/daikin-smash-ii/edit"] as const) {
      test(`${route} ไม่มี horizontal overflow`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator(".skeleton")).toHaveCount(0);
        await expect(page.locator("body")).toBeVisible();
        const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        expect(overflows).toBe(false);
        await page.screenshot({ path: `test-results/${viewport.name}-${route.replaceAll("/", "-") || "home"}.png`, fullPage: true });
      });
    }
  });
}

test("หน้า public หลักผ่าน WCAG 2 A/AA อัตโนมัติ", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".skeleton")).toHaveCount(0);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("mobile drawer trap focus, ปิดด้วย Escape และคืน focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".skeleton")).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "เปิดเมนู" });
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "เมนูหลักบนมือถือ" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
