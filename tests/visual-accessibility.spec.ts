/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ visual-accessibility.spec ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
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

test("confirmation dialog trap focus, ปิดด้วย Escape และคืน focus", async ({ page }) => {
  await page.goto("/admin/products");
  const trigger = page.getByRole("button", { name: /ย้าย .* ไปถังขยะ/ }).first();
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "ยกเลิก" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "ย้ายไปถังขยะ" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "ยกเลิก" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("dropdown ตัวกรองรองรับคีย์บอร์ดและส่งค่าที่เลือก", async ({ page }) => {
  await page.goto("/products");
  await expect(page.locator(".skeleton")).toHaveCount(0);
  const typeSelect = page.getByRole("combobox", { name: "กรองตามประเภท" });

  await typeSelect.focus();
  await page.keyboard.press("Enter");
  await expect(typeSelect).toHaveAttribute("aria-expanded", "true");
  await expect(typeSelect).toHaveAttribute("aria-activedescendant", /option-/);

  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(typeSelect).toBeFocused();
  await expect(typeSelect).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('input[name="type"]')).not.toHaveValue("");

  await page.keyboard.press("ArrowUp");
  await expect(typeSelect).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(typeSelect).toBeFocused();
  await expect(typeSelect).toHaveAttribute("aria-expanded", "false");

  await page.keyboard.press("Home");
  await page.keyboard.press("Space");
  await expect(page.locator('input[name="type"]')).toHaveValue("");

  await page.keyboard.press("Enter");
  await typeSelect.press("Tab");
  await expect(typeSelect).toHaveAttribute("aria-expanded", "false");

  const brandSelect = page.getByRole("combobox", { name: "กรองตามยี่ห้อ" });
  await brandSelect.focus();
  await page.keyboard.type("D");
  await expect(brandSelect).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(brandSelect).toContainText("Daikin");
  await expect(page.locator('input[name="brand"]')).toHaveValue("daikin");
});
