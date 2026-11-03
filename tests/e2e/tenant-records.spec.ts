import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

test.beforeEach(async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.tenantEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);
});

// ประกาศต้องบอกว่าส่งถึงใคร พัสดุบอกว่ารอมากี่วันและไปรับที่ไหน สัญญาบอกว่าเหลืออีกนานเท่าไร
test("announcements show who they were sent to", async ({ page }) => {
  await page.goto("/tenant/announcements");
  const featured = page.locator(".tenant-featured-announcement");
  await expect(featured.getByRole("heading", { name: "ประกาศ E2E" })).toBeVisible();
  await expect(featured.getByText("ทั้งหอ", { exact: true })).toBeVisible();
});

test("parcels show the waiting summary, how long each waited and open the dorm chat", async ({ page }) => {
  await page.goto("/tenant/parcels");
  await expect(page.getByRole("heading", { name: "มีพัสดุรอรับ 1 ชิ้น" })).toBeVisible();
  await expect(page.getByLabel("สรุปพัสดุรอรับ")).toContainText("E101");
  const card = page.getByRole("list", { name: "พัสดุรอรับ" }).getByRole("listitem").filter({ hasText: "พัสดุ E2E ที่เคาน์เตอร์" });
  await expect(card.getByText("มาถึงวันนี้", { exact: true })).toBeVisible();

  // ปุ่มถามหอเปิดห้องแชทกับหอตรง ๆ ไม่ใช่แค่รายการห้อง
  await page.getByRole("button", { name: "ถามหอในแชท" }).click();
  await expect(page.getByRole("textbox", { name: "ข้อความถึงหอพัก" })).toBeVisible();

  await page.goto("/tenant/parcels?view=history");
  await expect(page.getByText("รับไปแล้วทั้งหมด 1 ชิ้น")).toBeVisible();
  const history = page.getByRole("list", { name: "ประวัติการรับพัสดุ" });
  await expect(history.getByText("พัสดุ E2E ที่รับไปแล้ว")).toBeVisible();
  await expect(history.getByText(/รอที่หอ 1 วัน/)).toBeVisible();
});

test("lease shows how far through the term it is and the signed document", async ({ page }) => {
  await page.goto("/tenant/lease");
  await expect(page.getByRole("heading", { name: "CTR-E2E-E101" })).toBeVisible();
  const progress = page.getByRole("progressbar");
  await expect(progress).toBeVisible();
  expect(Number(await progress.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  await expect(page.getByText("ค่าเช่า/เดือน")).toBeVisible();
  await expect(page.getByText("12 เดือน", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "เปิดเอกสารลงนาม" })).toBeVisible();
});
