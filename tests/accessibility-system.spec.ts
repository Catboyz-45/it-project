/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ accessibility-system.spec ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const publicRoutes = [
  "/",
  "/about",
  "/services",
  "/products",
  "/projects",
  "/news",
  "/contact",
] as const;

const authRoutes = ["/login", "/session-expired"] as const;

const cmsRoutes = [
  "/admin",
  "/admin/account",
  "/admin/company",
  "/admin/banners",
  "/admin/banners/new",
  "/admin/services",
  "/admin/services/new",
  "/admin/products",
  "/admin/products/new",
  "/admin/projects",
  "/admin/projects/new",
  "/admin/news",
  "/admin/news/new",
  "/admin/taxonomies/brands",
  "/admin/taxonomies/product-types",
  "/admin/taxonomies/news-categories",
  "/admin/admins",
  "/admin/audit",
  "/admin/trash",
] as const;

const database = new PrismaClient();
const runId = randomUUID().slice(0, 8);
const username = `a11y-${runId}`;
let adminId = "";

async function waitForPage(page: Page) {
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator(".skeleton")).toHaveCount(0);
}

async function assertAxeAndSemantics(page: Page) {
  await waitForPage(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations, results.violations.map(item => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
  expect(await page.locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').count()).toBe(0);
}

async function addCmsSession(page: Page) {
  const token = randomBytes(32).toString("base64url");
  await database.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      adminId,
      twoFactorAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  await page.context().addCookies([{ name: "yuyen_session", value: token, url: process.env.TEST_BASE_URL ?? "http://localhost:3200", httpOnly: true, sameSite: "Lax" }]);
}

test.beforeAll(async () => {
  const admin = await database.admin.create({
    data: {
      username,
      usernameNormalized: username,
      displayName: "ผู้ตรวจสอบ Accessibility",
      role: "SUPER_ADMIN",
      passwordHash: "accessibility-test-session-only",
      mustChangePassword: false,
      twoFactorEnabled: true,
    },
  });
  adminId = admin.id;
});

test.afterAll(async () => {
  if (adminId) {
    await database.auditLog.deleteMany({ where: { actorId: adminId } });
    await database.admin.deleteMany({ where: { id: adminId } });
  }
  await database.$disconnect();
});

for (const route of [...publicRoutes, ...authRoutes]) {
  test(`Axe และ Screen Reader semantics: ${route}`, async ({ page }) => {
    await page.goto(route);
    await assertAxeAndSemantics(page);
  });
}

for (const route of cmsRoutes) {
  test(`Axe และ Screen Reader semantics CMS: ${route}`, async ({ page }) => {
    await addCmsSession(page);
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await assertAxeAndSemantics(page);
  });
}

test("ลำดับ Tab และ focus indicator บน Public navigation", async ({ page }) => {
  await page.goto("/");
  await waitForPage(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "ข้ามไปยังเนื้อหาหลัก" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  const outline = await focused.evaluate(element => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
  expect(outline.color).not.toBe("rgba(0, 0, 0, 0)");
});

test("ลำดับ Tab และ focus indicator บน CMS", async ({ page }) => {
  await addCmsSession(page);
  await page.goto("/admin");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "ข้ามไปยังเนื้อหาหลัก" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#admin-content")).toBeFocused();
});

test("Dialog ผู้ดูแล trap focus, Escape และคืน focus", async ({ page }) => {
  await addCmsSession(page);
  await page.goto("/admin/admins");
  const trigger = page.getByRole("button", { name: "เพิ่มผู้ดูแล" });
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "เพิ่มผู้ดูแล" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("ชื่อที่แสดง")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "ปิด" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

for (const route of [...publicRoutes, "/login", "/admin", "/admin/products"] as const) {
  test(`ซูม 200% ไม่มี horizontal overflow ที่กีดขวางการใช้งาน: ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 450 });
    if (route.startsWith("/admin")) await addCmsSession(page);
    await page.goto(route);
    await waitForPage(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });
}
