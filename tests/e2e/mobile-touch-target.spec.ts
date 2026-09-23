import { expect, type Locator, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";

// สี่ขนาดจอ ตั้งแต่มือถือเล็กสุดที่ยังมีคนใช้ไปจนถึงแท็บเล็ต
// 320px คือจุดที่พังง่ายที่สุด ผ่านตรงนี้ได้ที่เหลือมักผ่านตาม
const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
] as const;

// รายชื่อปุ่มและลิงก์ที่ต้องกดได้จริงด้วยนิ้ว รวมไว้ที่เดียวแล้วต่อเป็น selector เส้นเดียว
// เพิ่มคอมโพเนนต์ใหม่ที่มีปุ่ม อย่าลืมมาเติมที่นี่ ไม่งั้นจะไม่ถูกตรวจ
const importantControlSelector = [
  ".app-button",
  ".primary-button",
  ".secondary-button",
  ".icon-button",
  ".figma-icon-action",
  ".figma-row-action",
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

// ทุกหน้าของเจ้าของหอ ต้องเดินให้ครบ ไม่ใช่สุ่มเช็คบางหน้า
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

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

// เช็คว่าไม่มีอะไรล้นจนต้องเลื่อนซ้ายขวา เผื่อ 1px เพราะเบราว์เซอร์ปัดเศษไม่ตรงกัน
async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

// เอาเฉพาะปุ่มที่มองเห็นจริง ปุ่มในเมนูที่ยังไม่กางออกวัดขนาดไปก็ได้ศูนย์
function visibleControls(page: Page) {
  return page.locator(importantControlSelector).filter({ visible: true });
}

// ปุ่มต้องไม่เล็กกว่า 44x44 พิกเซล เป็นเกณฑ์ขนาดปลายนิ้วตามแนวทางของ WCAG
// วัดทุกปุ่มรวดเดียวในเบราว์เซอร์ ถ้าถามทีละปุ่มผ่าน Playwright จะช้ามาก
async function expectMinimumTouchTargets(controls: Locator, minimum = 44) {
  const failures = await controls.evaluateAll((elements, min) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      height: Math.round(rect.height * 100) / 100,
      // เก็บชื่อปุ่มไว้ด้วย พังแล้วจะได้รู้เลยว่าปุ่มไหน ไม่ต้องไล่หาเอง
      label: element.getAttribute("aria-label") ?? element.textContent?.replace(/\s+/g, " ").trim() ?? element.tagName,
      width: Math.round(rect.width * 100) / 100,
    };
  // ขนาด 0 แปลว่ายังไม่ถูกจัดวาง ไม่ใช่ปุ่มเล็กเกินไป ตัวกรอง visible ตั้งใจไม่เอาของพวกนี้อยู่แล้ว
  // แต่จับได้ไม่ทันตอนหน้าเพิ่งเปลี่ยน จึงกันซ้ำอีกชั้นตรงนี้
  }).filter(({ height, width }) => height > 0 && width > 0 && (height < min || width < min)), minimum);

  // เทียบกับอาร์เรย์ว่าง พังแล้วรายงานจะพ่นรายชื่อปุ่มที่ไม่ผ่านออกมาให้เห็นทั้งหมด
  expect(failures, "visible important controls must be at least 44 by 44 CSS pixels").toEqual([]);
}

// ปุ่มต้องไม่ทับกัน ทับแล้วนิ้วจะกดโดนอันที่ไม่ได้ตั้งใจ
async function expectControlsDoNotOverlap(controls: Locator) {
  const overlaps = await controls.evaluateAll((elements) => {
    // หาชั้นที่ปุ่มนี้อยู่ คือตัวแม่ที่ใกล้ที่สุดซึ่งเป็น position: fixed นับตัวเองด้วย
    // ปุ่มในแถบเมนูล่างเป็น static แต่แม่มันเป็น fixed จึงต้องไล่ขึ้นไป ไม่ใช่ดูแค่ค่าของตัวเอง
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

    // จับคู่ทุกปุ่มมาเทียบกัน rightIndex เริ่มที่ leftIndex + 1 จะได้ไม่เทียบคู่เดิมซ้ำ
    for (let leftIndex = 0; leftIndex < rendered.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < rendered.length; rightIndex += 1) {
        const left = rendered[leftIndex];
        const right = rendered[rightIndex];
        // ปุ่มที่อยู่ในกันเองย่อมทับกันอยู่แล้ว ข้ามไป
        if (left.element.contains(right.element) || right.element.contains(left.element)) continue;
        // ปุ่มลอยกับแถบเมนูล่างตั้งใจให้ลอยอยู่เหนือเนื้อหาที่เลื่อนได้
        // ชนกันจริงได้เฉพาะปุ่มที่อยู่ชั้นเดียวกัน เช่นสองปุ่มในแถบเดียวกัน
        // ข้ามชั้นไม่นับ เพราะเนื้อหาแค่เลื่อนผ่านใต้ปุ่มลอยเฉย ๆ
        if (left.layer !== right.layer) continue;
        const overlapWidth = Math.min(left.rect.right, right.rect.right) - Math.max(left.rect.left, right.rect.left);
        const overlapHeight = Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.top, right.rect.top);
        // ต้องซ้อนกันเกิน 1px ทั้งสองแกนถึงนับว่าทับ เผื่อการปัดเศษของเบราว์เซอร์
        if (overlapWidth > 1 && overlapHeight > 1) failures.push(`${left.label} overlaps ${right.label}`);
      }
    }
    return failures;
  });

  expect(overlaps, "visible important controls must not overlap one another").toEqual([]);
}

// รวมสามการตรวจไว้ที่เดียว ไม่ล้น ปุ่มใหญ่พอ และปุ่มไม่ทับกัน
async function verifyCurrentPage(page: Page) {
  await expect(page.locator("main")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const controls = visibleControls(page);
  // ต้องเจอปุ่มอย่างน้อยหนึ่งอันก่อน ไม่งั้นหน้าที่โหลดไม่ขึ้นจะผ่านฉลุยเพราะไม่มีอะไรให้ตรวจ
  await expect(controls.first()).toBeVisible();
  await expectMinimumTouchTargets(controls);
  await expectControlsDoNotOverlap(controls);
}

// เดินทุกหน้าในรายการแล้วตรวจทีละหน้า ส่ง pathFor เข้ามาเพราะแต่ละบทบาทมีรูปแบบ URL ต่างกัน
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

      // ล้างคุกกี้ก่อนสลับบัญชี ไม่งั้นจะยังเป็นคนเดิมอยู่
      await page.context().clearCookies();
      await login(page, e2e.tenantEmail);
      await verifyRoutes(page, tenantRoutes, (route) => `/tenant${route}`);

      await page.context().clearCookies();
      await login(page, e2e.superAdminEmail);
      await verifyRoutes(page, superAdminRoutes, (route) => `/super-admin${route}`);
    });
  }
});
