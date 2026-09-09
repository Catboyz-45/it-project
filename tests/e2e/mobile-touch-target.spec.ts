/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “mobile touch target.spec” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { expect, type Locator, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";

const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
] as const;

const importantControlSelector = [
  ".app-button",
  ".primary-button",
  ".secondary-button",
  ".icon-button",
  ".figma-icon-action",
  ".icon-btn",
  ".table-pagination button",
  ".notification-center button",
  ".chat-widget-header button",
  ".chat-composer button",
  ".template-editor-toolbar button",
  ".template-table-actions button",
  ".template-page-actions button",
  ".document-zoom-controls button",
  ".settings-floor-list button",
  ".settings-furniture-grid button",
  ".settings-editable-list button",
  ".tenant-mobile-more summary",
  "nav a",
  "nav button",
].join(", ");

const ownerRoutes = [
  "",
  "/rooms",
  "/tenants",
  "/contracts",
  "/meters/water",
  "/meters/electricity",
  "/invoices",
  "/tickets",
  "/tickets/history",
  "/parcels",
  "/announcements",
  "/settings",
  "/invitations",
  "/subscription",
  "/help",
  "/account",
] as const;

const tenantRoutes = [
  "",
  "/invoices",
  "/lease",
  "/announcements",
  "/parcels",
  "/tickets",
  "/chat",
  "/account",
] as const;

const superAdminRoutes = [
  "",
  "/accounts",
  "/properties",
  "/plans",
  "/subscriptions",
  "/audit-logs",
] as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “login” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “expect No Horizontal Overflow” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “visible Controls” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function visibleControls(page: Page) {
  return page.locator(importantControlSelector).filter({ visible: true });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “expect Minimum Touch Targets” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - controls: ค่า “controls” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - minimum: ค่า “minimum” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function expectMinimumTouchTargets(controls: Locator, minimum = 44) {
  const failures = await controls.evaluateAll((elements, min) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      height: Math.round(rect.height * 100) / 100,
      label: element.getAttribute("aria-label") ?? element.textContent?.replace(/\s+/g, " ").trim() ?? element.tagName,
      width: Math.round(rect.width * 100) / 100,
    };
  }).filter(({ height, width }) => height < min || width < min), minimum);

  expect(failures, "visible important controls must be at least 44 by 44 CSS pixels").toEqual([]);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “expect Controls Do Not Overlap” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - controls: ค่า “controls” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function expectControlsDoNotOverlap(controls: Locator) {
  const overlaps = await controls.evaluateAll((elements) => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: สร้างผลลัพธ์สำหรับแสดงส่วน “rendered” บนหน้าจอ
     * รับค่า:
     * - element: ค่า “element” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: หา “ชั้น” ที่ปุ่มนี้อยู่ คือ ancestor ที่ใกล้ที่สุดซึ่งเป็น position: fixed
     *   (นับตัวเองด้วย) ปุ่มในแถบเมนูล่างเป็น position: static แต่พ่ออยู่ใน .tenant-mobile-navigation
     *   ที่เป็น fixed จึงต้องไล่ขึ้นไป ไม่ใช่ดูแค่ค่าของตัวเอง
     * รับค่า:
     * - element: ปุ่มที่ต้องการหาชั้นของมัน
     * ผลลัพธ์: element ของชั้น fixed ที่ครอบอยู่ หรือ null ถ้าปุ่มไหลไปกับเอกสารตามปกติ
     */
    const fixedLayerOf = (element: Element) => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        if (getComputedStyle(node).position === "fixed") return node;
      }
      return null;
    };

    const rendered = elements.map((element) => ({
      element,
      label: element.getAttribute("aria-label") ?? element.textContent?.replace(/\s+/g, " ").trim() ?? element.tagName,
      layer: fixedLayerOf(element),
      rect: element.getBoundingClientRect(),
    }));
    const failures: string[] = [];

    for (let leftIndex = 0; leftIndex < rendered.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < rendered.length; rightIndex += 1) {
        const left = rendered[leftIndex];
        const right = rendered[rightIndex];
        if (left.element.contains(right.element) || right.element.contains(left.element)) continue;
        // Floating launchers and the mobile tab bar intentionally sit above the
        // scrolling document. Only controls sharing a layer can truly collide, so
        // compare within a layer (two tabs in the same bar must not overlap) but
        // never across layers, where content merely scrolls underneath.
        if (left.layer !== right.layer) continue;
        const overlapWidth = Math.min(left.rect.right, right.rect.right) - Math.max(left.rect.left, right.rect.left);
        const overlapHeight = Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.top, right.rect.top);
        if (overlapWidth > 1 && overlapHeight > 1) failures.push(`${left.label} overlaps ${right.label}`);
      }
    }
    return failures;
  });

  expect(overlaps, "visible important controls must not overlap one another").toEqual([]);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “verify Current Page” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function verifyCurrentPage(page: Page) {
  await expect(page.locator("main")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const controls = visibleControls(page);
  await expect(controls.first()).toBeVisible();
  await expectMinimumTouchTargets(controls);
  await expectControlsDoNotOverlap(controls);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “verify Routes” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - routes: ค่า “routes” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - pathFor: ค่า “path For” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function verifyRoutes(page: Page, routes: readonly string[], pathFor: (route: string) => string) {
  for (const route of routes) {
    await page.goto(pathFor(route));
    await verifyCurrentPage(page);
  }
}

test.describe("mobile touch target contract", () => {
  // แต่ละเคสล็อกอิน 3 บัญชีและเดิน 30 หน้าเต็ม (owner+tenant+super-admin routes รวมกัน)
  // ต่อ viewport โดยทุกหน้าต้องผ่าน 3 การตรวจ (overflow, touch-target, overlap) กับ `next dev`
  // ที่ยัง compile route แบบ on-demand — ใช้เวลาต่อรันมากกว่าเทสต์อื่นในชุดหลายเท่า จน
  // 30 วินาที (default ของ Playwright) ริมขอบเกินไปบน CI runner ที่ทรัพยากรจำกัดกว่าเครื่อง dev
  test.describe.configure({ timeout: 90_000 });

  for (const viewport of viewports) {
    test(`${viewport.width}x${viewport.height} owner, tenant and super admin actions remain touch-safe`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await login(page, e2e.ownerEmail);

      await verifyRoutes(
        page,
        ownerRoutes,
        (route) => `/admin/properties/${e2e.propertyId}${route}`,
      );

      await page.context().clearCookies();
      await login(page, e2e.tenantEmail);
      await verifyRoutes(page, tenantRoutes, (route) => `/tenant${route}`);

      await page.context().clearCookies();
      await login(page, e2e.superAdminEmail);
      await verifyRoutes(page, superAdminRoutes, (route) => `/super-admin${route}`);
    });
  }
});
