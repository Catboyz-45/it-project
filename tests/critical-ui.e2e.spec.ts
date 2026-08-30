/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ critical-ui.e2e.spec ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const runAdmin = process.env.RUN_CRITICAL_UI_E2E === "1";
const baseURL = process.env.TEST_BASE_URL ?? process.env.APP_URL ?? "http://127.0.0.1:3000";

async function authenticateTemporaryAdmin(page: Page) {
  const database = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const username = `critical-ui-${suffix}`;
  const admin = await database.admin.create({
    data: {
      username,
      usernameNormalized: username,
      displayName: "Critical UI Test",
      role: "SUPER_ADMIN",
      passwordHash: await argon2.hash(`Critical-UI-${suffix}!Aa1`, { type: argon2.argon2id }),
      mustChangePassword: false,
      twoFactorEnabled: true,
    },
  });
  const token = randomBytes(32).toString("base64url");
  await database.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      adminId: admin.id,
      twoFactorAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });
  await page.context().addCookies([{ name: "yuyen_session", value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
  return async () => {
    await database.auditLog.deleteMany({ where: { actorId: admin.id } });
    await database.admin.delete({ where: { id: admin.id } }).catch(() => undefined);
    await database.$disconnect();
  };
}

test("ผู้ใช้ทั่วไปค้นหาและกรองสินค้า พร้อมใช้ dropdown ด้วยคีย์บอร์ดโดยหน้าไม่เลื่อน", async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByText(/พบสินค้า \d+ รายการ/)).toBeVisible();
  const firstProduct = page.locator(".grid-4 .card h3").first();
  const productName = (await firstProduct.textContent())?.trim();
  expect(productName).toBeTruthy();
  await page.getByRole("textbox", { name: "ค้นหาสินค้า" }).fill(productName!);
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole("heading", { name: productName! })).toBeVisible();

  const typeSelect = page.getByRole("combobox", { name: "กรองตามประเภท" });
  await typeSelect.focus();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("ArrowDown");
  await expect(typeSelect).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await expect(page.locator('input[name="type"]')).toHaveValue("");
  await page.keyboard.press("Enter");
  await expect(page.locator('input[name="type"]')).not.toHaveValue("");
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page).toHaveURL(/type=/);
  await expect(page.getByText(/จากเงื่อนไขที่เลือก/)).toBeVisible();
});

test("mobile drawer trap focus ปิดด้วย Escape และคืน focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "เปิดเมนู" });
  await trigger.focus();
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "เมนูหลักบนมือถือ" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test.describe("authenticated CMS interaction", () => {
  test.skip(!runAdmin, "Set RUN_CRITICAL_UI_E2E=1 and use an isolated test database");
  test("ป้องกันข้อมูลฟอร์มหาย ใช้ confirmation dialog และ logout ได้จริง", async ({ page }) => {
    const cleanup = await authenticateTemporaryAdmin(page);
    try {
      await page.goto("/admin/company");
      const legalName = page.getByLabel("ชื่อบริษัทตามกฎหมาย");
      await expect(legalName).toBeVisible();
      const original = await legalName.inputValue();
      await legalName.fill(`${original} ทดสอบยังไม่บันทึก`);
      await page.getByRole("link", { name: "ภาพรวม" }).click();
      const leaveDialog = page.getByRole("alertdialog");
      await expect(leaveDialog).toBeVisible();
      await expect(page.getByRole("button", { name: "ยกเลิก" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(leaveDialog).toBeHidden();
      await expect(legalName).toHaveValue(`${original} ทดสอบยังไม่บันทึก`);
      await page.getByRole("button", { name: "ออกจากระบบ" }).click();
      await expect(page).toHaveURL(/\/login$/);
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await cleanup();
    }
  });

  test("เพิ่ม เผยแพร่ ย้ายลงถังขยะ และกู้คืนเนื้อหา", async ({ page }) => {
    const cleanup = await authenticateTemporaryAdmin(page);
    const headers = { Origin: process.env.APP_URL ?? baseURL };
    let id: string | undefined;
    try {
      const created = await page.request.post("/api/admin/content/banners", {
        headers,
        data: { title: `Critical content ${randomUUID()}`, status: "DRAFT" },
      });
      expect(created.status()).toBe(201);
      id = ((await created.json()) as { record: { id: string } }).record.id;
      for (const action of ["publish", "trash", "restore"] as const) {
        const response = await page.request.post(`/api/admin/content/banners/${id}/transition`, { headers, data: { action } });
        expect(response.status()).toBe(200);
      }
    } finally {
      if (id) {
        await page.request.post(`/api/admin/content/banners/${id}/transition`, { headers, data: { action: "trash" } }).catch(() => undefined);
        await page.request.post(`/api/admin/content/banners/${id}/transition`, { headers, data: { action: "delete" } }).catch(() => undefined);
      }
      await cleanup();
    }
  });
});
