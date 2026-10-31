import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { openLoginForm } from "./helpers/login";

// ปุ่มแฮมเบอร์เกอร์บนจอคอมย่อแถบเมนูเหลือแต่ไอคอน และจำค่าไว้ข้ามการโหลดหน้าใหม่
test.use({ viewport: { width: 1280, height: 800 } });

test("desktop hamburger collapses the sidebar to icons and remembers it", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page.getByRole("heading", { name: "แดชบอร์ด", exact: true })).toBeVisible();

  const sidebar = page.locator("#app-sidebar");
  const collapse = sidebar.getByRole("button", { name: "ย่อเมนู", exact: true });
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  const expandedWidth = (await sidebar.boundingBox())!.width;

  await collapse.click();
  const expand = sidebar.getByRole("button", { name: "ขยายเมนู", exact: true });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(expandedWidth / 2);

  // ชื่อเมนูซ่อนจากตา แต่โปรแกรมอ่านหน้าจอและ locator ตามชื่อยังหาเจอและกดได้
  const roomsLink = page.getByLabel("เมนูหลัก").getByRole("link", { name: /ผังห้องพัก/ });
  await roomsLink.click();
  await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}/rooms$`));

  await page.reload();
  await expect(sidebar.getByRole("button", { name: "ขยายเมนู", exact: true })).toBeVisible();
  await sidebar.getByRole("button", { name: "ขยายเมนู", exact: true }).click();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeGreaterThan(expandedWidth - 2);
});
