import { expect, test } from "@playwright/test";
import pg from "pg";
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

// บิลที่ส่งสลิปแล้วต้องบอกว่ารอหอตรวจ ไม่ใช่ยังเร่งด้วยตัวแดงว่าเลยกำหนด และยังกดส่งใหม่ได้
test("a bill with a slip under review says so and can still take a new slip", async ({ page }) => {
  await page.goto("/tenant/invoices");
  const invoiceButton = page.getByRole("button", { name: /E2E-202607-E101/ });
  await expect(invoiceButton).toContainText("รอตรวจสอบสลิป");
  await expect(invoiceButton).not.toContainText("เลยกำหนด");
  const details = page.getByLabel("รายละเอียดบิล E2E-202607-E101", { exact: true });
  await expect(details.getByText("ส่งสลิปแล้ว รอหอตรวจสอบ")).toBeVisible();
  await expect(details.getByAltText("PromptPay QR E2E-202607-E101")).toHaveCount(0);
  await details.getByRole("button", { name: "ดู QR และส่งสลิปใหม่" }).click();
  await expect(details.getByAltText("PromptPay QR E2E-202607-E101")).toBeVisible();
  await expect(details.getByRole("button", { name: "ส่งหลักฐาน" })).toBeDisabled();
});

// ประวัติบิลและเรื่องแจ้งเคยเป็นตารางกว้างที่ดันหน้ามือถือให้เลื่อนข้างได้
test("bill and ticket history fit a phone screen and expand in place", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tenant/invoices");
  await page.getByRole("tab", { name: "ประวัติบิล" }).click();
  const history = page.getByRole("list", { name: "ประวัติบิล" });
  const row = history.getByRole("button", { name: /E2E-202606-E101/ });
  await expect(row).toContainText("มิถุนายน 2569");
  await row.click();
  await expect(page.getByLabel("รายละเอียดบิล E2E-202606-E101", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.goto("/tenant/tickets");
  await page.getByRole("tab", { name: "ประวัติเรื่อง" }).click();
  await expect(page.locator(".loading-skeleton")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// หอที่ยังไม่ตั้ง PromptPay ผู้เช่าต้องเห็นช่องทางอื่นแทน ไม่ใช่ข้อความเตือนที่เขียนไว้ให้เจ้าของหออ่าน
test("a bill without PromptPay falls back to the bank account, then to asking the dorm", async ({ page }) => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const saved = (await pool.query(`SELECT "promptPayId","bankName","bankAccountNumber","bankAccountName" FROM "PropertySettings" WHERE "propertyId"=$1`, [e2e.propertyId])).rows[0];
  const setChannels = (promptPayId: string | null, bankAccountNumber: string | null) => pool.query(
    `UPDATE "PropertySettings" SET "promptPayId"=$2, "bankName"=$3, "bankAccountNumber"=$4, "bankAccountName"=$5 WHERE "propertyId"=$1`,
    [e2e.propertyId, promptPayId, bankAccountNumber ? "ธนาคารทดสอบ" : null, bankAccountNumber, bankAccountNumber ? "หอ E2E" : null],
  );
  const openPayment = async () => {
    await page.goto("/tenant/invoices");
    const details = page.getByLabel("รายละเอียดบิล E2E-202607-E101", { exact: true });
    await details.getByRole("button", { name: "ดู QR และส่งสลิปใหม่" }).click();
    return details;
  };
  try {
    await setChannels(null, "1234567890");
    let details = await openPayment();
    await expect(details.getByTestId("tenant-bank-account")).toContainText("โอน ฿4,200 เข้าบัญชีของหอ");
    await expect(details.getByText("PromptPay", { exact: false })).toHaveCount(0);

    await setChannels(null, null);
    details = await openPayment();
    await expect(details.getByText("หอยังไม่ได้ตั้งช่องทางรับเงินในระบบ")).toBeVisible();
    await details.getByRole("button", { name: "ถามหอในแชท" }).click();
    await expect(page.getByRole("textbox", { name: "ข้อความถึงหอพัก" })).toBeVisible();
  } finally {
    await pool.query(
      `UPDATE "PropertySettings" SET "promptPayId"=$2, "bankName"=$3, "bankAccountNumber"=$4, "bankAccountName"=$5 WHERE "propertyId"=$1`,
      [e2e.propertyId, saved.promptPayId, saved.bankName, saved.bankAccountNumber, saved.bankAccountName],
    );
    await pool.end();
  }
});

// ห้องที่กำลังดูอยู่เป็นการ์ดบนแถบข้าง มีห้องเดียวเป็นแค่ป้าย มีหลายห้องกดสลับได้
test("the room card shows the current room and switches between rooms", async ({ page }) => {
  await page.goto("/tenant/invoices");
  const card = page.locator(".tenant-sidebar-room");
  await expect(card).toContainText("ห้อง E101");
  await expect(card.getByRole("button")).toHaveCount(0);

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const occupancyId = "czzroomswitch000000000001";
  try {
    await pool.query(
      `INSERT INTO "RoomOccupancy" ("id","propertyId","roomId","tenantProfileId","role","status","startedAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,'CO_OCCUPANT','ACTIVE',NOW() - interval '400 days',NOW(),NOW())`,
      [occupancyId, e2e.secondPropertyId, e2e.secondPropertyRoomId, e2e.tenantProfileId],
    );
    await page.reload();
    await card.getByRole("button", { name: /สลับห้อง/ }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitemradio", { checked: true })).toContainText("E101");
    await menu.getByRole("menuitemradio", { name: /F201/ }).click();
    await expect(page).toHaveURL(/\/tenant$/);
    await expect(card).toContainText("ห้อง F201");
  } finally {
    await pool.query(`DELETE FROM "RoomOccupancy" WHERE "id"=$1`, [occupancyId]);
    await pool.end();
  }
});
