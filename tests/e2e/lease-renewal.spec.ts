/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “lease renewal.spec” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { expect, test } from "@playwright/test";
import pg from "pg";
import { e2e } from "./fixtures";

test.afterEach(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/test/i.test(new URL(databaseUrl).pathname)) return;
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await pool.query(`DELETE FROM "LeaseVersion" WHERE "leaseId" IN (
      SELECT "id" FROM "Lease" WHERE "propertyId"=$1 AND "leaseNumber" <> 'CTR-E2E-E101'
    )`, [e2e.propertyId]);
    await pool.query(`DELETE FROM "LeaseTenant" WHERE "leaseId" IN (
      SELECT "id" FROM "Lease" WHERE "propertyId"=$1 AND "leaseNumber" <> 'CTR-E2E-E101'
    )`, [e2e.propertyId]);
    await pool.query(
      `DELETE FROM "Lease" WHERE "propertyId"=$1 AND "leaseNumber" <> 'CTR-E2E-E101'`,
      [e2e.propertyId],
    );
  } finally {
    await pool.end();
  }
});

test("owner renews a lease without overwriting the active lease", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  await page.goto(`/admin/properties/${e2e.propertyId}/contracts`);
  // Leases within the 120-day expiry notice window (see LEASE_EXPIRY_NOTICE_DAYS)
  // surface a dedicated "ต่อสัญญา" button instead of burying it in the
  // "จัดการสัญญา" action menu. The seeded lease drifts into that window over
  // calendar time, so this test supports both presentations. The row loads
  // asynchronously, so wait for it before deciding which control is present.
  const contractRow = page.locator(".figma-table-row").filter({ hasText: "CTR-E2E-E101" });
  await expect(contractRow).toBeVisible();
  const dedicatedRenewButton = contractRow.getByRole("button", { name: "ต่อสัญญา CTR-E2E-E101" });
  if (await dedicatedRenewButton.count()) {
    await dedicatedRenewButton.click();
  } else {
    await page.getByRole("button", { name: "จัดการสัญญา CTR-E2E-E101" }).click();
    await page.getByRole("menuitem", { name: "ต่อสัญญา" }).click();
  }

  const dialog = page.getByRole("dialog", { name: "ต่อสัญญา" });
  await expect(dialog.getByLabel("ห้อง")).toBeDisabled();
  await expect(dialog.getByLabel("วันเริ่มสัญญา")).toHaveValue("2027-01-01");
  await expect(dialog.getByLabel("วันสิ้นสุดสัญญา")).toHaveValue("2027-12-31");
  await dialog.getByRole("button", { name: "สร้างสัญญาต่ออายุ" }).click();

  const rows = page.locator(".contract-table .figma-table-row");
  await expect(rows).toHaveCount(2);
  // Row order isn't guaranteed, and the original lease's status label
  // ("ใช้งาน" vs "ใกล้หมดอายุ") depends on how close it is to its end date.
  // What matters here is that a new draft row exists alongside the
  // still-current original lease, i.e. renewal did not overwrite it.
  const originalRow = rows.filter({ hasText: "CTR-E2E-E101" });
  const draftRow = rows.filter({ hasNotText: "CTR-E2E-E101" });
  await expect(draftRow).toContainText("ฉบับร่าง");
  await expect(originalRow).not.toContainText("ฉบับร่าง");
});
