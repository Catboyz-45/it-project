import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// ดูตัวอย่างบิลต้องเปิดในหน้าต่างของหน้าเดิม ไม่เด้งไปแท็บใหม่เอง
// แท็บที่เปิดหลังรอสร้างไฟล์หลายวินาที เบราว์เซอร์มักเปิดไว้ข้างหลังหรือบล็อกไป ผู้ใช้เลยหาไม่เจอ
test("invoice preview opens in a window on the same page", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);

  // เทสต์นี้ดูพฤติกรรมของหน้าต่าง ไม่ใช่การสร้าง PDF เครื่อง CI เปิด Chromium ฝั่งเซิร์ฟเวอร์ไม่ได้
  // จึงตอบไฟล์ PDF เล็ก ๆ แทน การสร้างไฟล์จริงมีเทสต์ของตัวเองใน lib/documents/pdf.test.ts
  await page.route("**/api/documents/preview**", (route) => route.fulfill({
    status: 200,
    contentType: "application/pdf",
    body: Buffer.from("%PDF-1.4\n%%EOF\n"),
  }));
  const openedTabs: unknown[] = [];
  page.context().on("page", (tab) => openedTabs.push(tab));

  await page.goto(`/admin/properties/${e2e.propertyId}/invoices`);
  await page.getByRole("button", { name: "จัดการบิล E2E-202606-E101" }).click();
  await page.getByRole("menuitem", { name: "ดูตัวอย่างบิล (PDF)" }).click();

  const preview = page.getByRole("dialog", { name: "ตัวอย่างใบแจ้งหนี้" });
  await expect(preview).toBeVisible();
  await expect(preview.locator("iframe")).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });
  await expect(preview.getByRole("link", { name: "เปิดเต็มจอ" })).toBeVisible();
  expect(openedTabs).toHaveLength(0);

  await preview.getByRole("button", { name: "ปิด", exact: true }).click();
  await expect(preview).toBeHidden();
});
