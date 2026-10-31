import { expect, Page, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { openLoginForm } from "./helpers/login";

// ตั้งขนาดจอเท่า iPhone ทุกเทสต์ในไฟล์นี้ จะได้เช็คมุมมองมือถือได้จริง
test.use({ viewport: { width: 390, height: 844 } });

// ขั้นตอนล็อกอินที่ใช้ซ้ำทุกเทสต์ในไฟล์นี้ แยกออกมาไม่ต้องเขียนซ้ำ
async function login(page: Page, email: string, password: string) {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
}

// ปุ่มแฮมเบอร์เกอร์บนแถบหัวหน้ามีไว้เปิดลิ้นชักบนมือถือ ปุ่มในลิ้นชักซ่อนอยู่จึงไม่ชนกัน
async function openMobileMenu(page: Page) {
  const opener = page.locator("header").getByRole("button", { name: "เปิดเมนู", exact: true });
  await opener.click();
  // ปุ่มบนแถบหัวหน้าก็เปลี่ยนชื่อเป็น "ปิดเมนู" ด้วย จึงเจาะหาเฉพาะปุ่มในลิ้นชัก
  await expect(page.locator("#app-sidebar").getByRole("button", { name: "ปิดเมนู", exact: true })).toBeVisible();
}

// เช็คว่าหน้าไม่ล้นจนต้องเลื่อนซ้ายขวา ซึ่งเป็นอาการพังของ layout บนจอแคบที่พบบ่อยที่สุด
// เผื่อ 1px เพราะเบราว์เซอร์ปัดเศษความกว้างไม่ตรงกันเล็กน้อย
async function expectNoPageOverflow(page: Page) {
  // ใช้ poll เพราะ layout ยังขยับหลังโหลดฟอนต์และรูปเสร็จ วัดครั้งเดียวอาจได้ค่าตอนที่ยังไม่นิ่ง
  await expect.poll(async () => page.evaluate(() => {
    const root = document.documentElement;
    return Boolean(root) && root.scrollWidth <= root.clientWidth + 1;
  })).toBe(true);
}

test("owner workspace remains usable on a mobile viewport", async ({ page }) => {
  await login(page, e2e.ownerEmail, e2e.password);
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { name: "แดชบอร์ด", exact: true })).toBeVisible();
  await expectNoPageOverflow(page);

  // บนมือถือเมนูหลักอยู่ในลิ้นชัก ต้องกดปุ่มแฮมเบอร์เกอร์ก่อนถึงจะเห็นลิงก์
  await openMobileMenu(page);
  await page.getByLabel("เมนูหลัก").getByRole("link", { name: /^ผู้เช่า(?:\s|$)/ }).click();
  await expect(page).toHaveURL(/\/tenants$/);
  // เปลี่ยนหน้าแล้วลิ้นชักต้องปิดเอง ไม่ค้างบังเนื้อหาหน้าใหม่
  await expect(page.locator("header").getByRole("button", { name: "เปิดเมนู", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expectNoPageOverflow(page);
});

test("mobile menu drawer opens, traps the page scroll and closes with Escape", async ({ page }) => {
  await login(page, e2e.ownerEmail, e2e.password);
  await expect(page.getByRole("heading", { name: "แดชบอร์ด", exact: true })).toBeVisible();
  // ตอนลิ้นชักปิด ลิงก์ในเมนูต้องมองไม่เห็นและกด Tab เข้าไม่ถึง
  await expect(page.getByLabel("เมนูหลัก").getByRole("link", { name: /ผังห้องพัก/ })).toBeHidden();

  await openMobileMenu(page);
  await expect(page.getByLabel("เมนูหลัก").getByRole("link", { name: /ผังห้องพัก/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");

  await page.keyboard.press("Escape");
  const opener = page.locator("header").getByRole("button", { name: "เปิดเมนู", exact: true });
  await expect(opener).toHaveAttribute("aria-expanded", "false");
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
});

test("tenant portal remains usable on a mobile viewport", async ({ page }) => {
  await login(page, e2e.tenantEmail, e2e.password);
  await expect(page).toHaveURL(/\/tenant/);
  await expect(page.getByRole("navigation", { name: "เมนูผู้เช่าบนมือถือ", exact: true })).toBeVisible();
  await expectNoPageOverflow(page);

  // เมนูมือถือซ่อนรายการที่เหลือไว้ใต้ปุ่มเพิ่มเติม ต้องกดเปิดก่อนถึงจะกดลิงก์ข้างในได้
  const mobileNavigation = page.getByRole("navigation", { name: "เมนูผู้เช่าบนมือถือ", exact: true });
  await mobileNavigation.getByText("เพิ่มเติม", { exact: true }).click();
  await mobileNavigation.getByRole("link", { name: "บัญชีของฉัน", exact: true }).click();
  await expect(page.getByRole("heading", { name: "บัญชีของฉัน" })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("super admin navigation remains usable on a mobile viewport", async ({ page }) => {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  test.skip(!email || !password, "Bootstrap credentials are required");

  await login(page, email!, password!);
  await expect(page).toHaveURL(/\/super-admin/);
  await openMobileMenu(page);
  await expect(page.getByRole("navigation", { name: "เมนู Super Admin" })).toBeVisible();
  await expectNoPageOverflow(page);
});
