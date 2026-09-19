import { expect, test } from "@playwright/test";

// รหัสผิดต้องได้ข้อความกลาง ๆ ไม่บอกว่าอีเมลนี้มีในระบบหรือไม่ กันการไล่เดาว่าใครเป็นสมาชิก
test("rejects invalid credentials without leaking account state", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill("unknown@example.com");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" })).toBeVisible();
  // ต้องยังอยู่หน้า login ไม่ใช่หลุดเข้าไปข้างในทั้งที่รหัสผิด
  await expect(page).toHaveURL(/\/login/);
});

// ไล่กดเมนูซูเปอร์แอดมินทุกอันว่าเปิดได้จริง จับกรณีลิงก์เสียหลังย้ายไฟล์
test("super admin can open the aggregated SaaS dashboard", async ({ page }) => {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  // ไม่มีบัญชีตั้งต้นใน env ก็ข้ามไป ดีกว่าให้เทสต์แดงเพราะสภาพแวดล้อมไม่พร้อม
  test.skip(!email || !password, "Bootstrap credentials are required");
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email!);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password!);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page).toHaveURL(/\/super-admin/);
  await expect(page.getByRole("heading", { name: "แดชบอร์ด", exact: true })).toBeVisible();
  await expect(page.getByText("MRR")).toBeVisible();

  // รายชื่อเมนูกับ URL ที่คู่กัน วนเช็คทีละอันแทนการเขียนซ้ำห้ารอบ
  const routes = [
    ["บัญชีเจ้าของหอ", "/super-admin/accounts"],
    ["หอพัก", "/super-admin/properties"],
    ["แพ็กเกจ", "/super-admin/plans"],
    ["การชำระสมาชิก", "/super-admin/subscriptions"],
    ["Audit Log", "/super-admin/audit-logs"],
  ] as const;
  for (const [label, route] of routes) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    // ชื่อเมนูกับหัวข้อในหน้าไม่ตรงกันอยู่อันเดียว จึงต้องดักไว้เป็นกรณีพิเศษ
    await expect(page.getByRole("heading", { name: label === "แพ็กเกจ" ? "แพ็กเกจ SaaS" : label, exact: true }).first()).toBeVisible();
  }
});
