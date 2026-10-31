import { expect, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// ทุกหน้าของทุกบทบาทต้องไม่มีชิ้นส่วนโดนตัดขอบ เช่นกล่องหรือป้ายที่ล้นออกนอกกรอบที่ซ่อนส่วนเกิน
// รวมป้ายชื่อที่ซ่อนไว้รอโผล่ตอนเอาเมาส์ชี้ด้วย ถ้าล้นกรอบ พอชี้แล้วจะเห็นแค่ครึ่งเดียว
// กล่องที่ตั้งใจให้เลื่อนซ้ายขวาได้อย่างตาราง ไม่นับว่าโดนตัด
test.use({ viewport: { width: 1280, height: 800 } });
test.describe.configure({ timeout: 120_000 });

const ownerRoutes = ["", "/rooms", "/tenants", "/contracts", "/meters/water", "/meters/electricity", "/invoices", "/tickets", "/tickets/history", "/parcels", "/announcements", "/settings"];
const tenantRoutes = ["", "/invoices", "/lease", "/announcements", "/parcels", "/tickets", "/chat", "/account"];
const superAdminRoutes = ["", "/accounts", "/properties", "/plans", "/subscriptions", "/audit-logs", "/account"];

async function login(page: Page, email: string) {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);
}

async function findClippedElements(page: Page) {
  return page.evaluate(() => {
    const clipped: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("main *")) {
      if (!element.offsetParent || element.closest(".sr-only")) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue;
      // หากรอบที่ซ่อนส่วนเกินที่ใกล้ที่สุด
      let container = element.parentElement;
      while (container && container !== document.body) {
        const style = getComputedStyle(container);
        if (style.overflowX !== "visible" || style.overflowY !== "visible") break;
        container = container.parentElement;
      }
      if (!container || container === document.body) continue;
      const containerStyle = getComputedStyle(container);
      if (containerStyle.overflowX === "auto" || containerStyle.overflowX === "scroll") continue;
      const bounds = container.getBoundingClientRect();
      const overflow = Math.max(bounds.left - rect.left, rect.right - bounds.right);
      if (overflow > 2) clipped.push(`${element.tagName.toLowerCase()}.${element.className} "${element.innerText.trim().slice(0, 30)}" ล้น ${Math.round(overflow)}px`);
    }
    return clipped;
  });
}

async function expectNoClipping(page: Page, routes: string[], toUrl: (route: string) => string) {
  for (const route of routes) {
    await page.goto(toUrl(route));
    // หน้าตั้งค่าของเจ้าของหอใช้หัวข้อของหมวดเป็น h2 แทน h1 ของแถบหัวหน้า
    await expect(page.locator("main :is(h1, h2)").first()).toBeVisible({ timeout: 30_000 });
    // รอให้ข้อมูลที่โหลดตามมาจัดวางเสร็จก่อนค่อยวัด
    await page.waitForLoadState("networkidle");
    expect(await findClippedElements(page), `หน้า ${toUrl(route)} มีชิ้นส่วนโดนตัดขอบ`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
}

test("owner pages have no clipped content", async ({ page }) => {
  await login(page, e2e.ownerEmail);
  await expectNoClipping(page, ownerRoutes, (route) => `/admin/properties/${e2e.propertyId}${route}`);
});

test("tenant pages have no clipped content", async ({ page }) => {
  await login(page, e2e.tenantEmail);
  await expectNoClipping(page, tenantRoutes, (route) => `/tenant${route}`);
});

test("super admin pages have no clipped content", async ({ page }) => {
  await login(page, e2e.superAdminEmail);
  await expectNoClipping(page, superAdminRoutes, (route) => `/super-admin${route}`);
});
