import { expect, test } from "@playwright/test";
import pg from "pg";
import { e2e } from "./fixtures";

// ลบสัญญาที่เทสต์สร้างขึ้นหลังจบทุกครั้ง เว้นใบตั้งต้นไว้ รอบหน้าจะได้เริ่มจากสภาพเดิม
test.afterEach(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  // ไม่ใช่ฐานทดสอบก็ไม่แตะอะไรเลย กันเผลอลบข้อมูลจริง
  if (!databaseUrl || !/test/i.test(new URL(databaseUrl).pathname)) return;
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    // ลบจากลูกไปหาแม่ ลบแม่ก่อนจะติด foreign key
    // ใช้ $1 ส่งค่าแยก ไม่ต่อสตริงเข้าไปใน SQL ตรง ๆ
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
    // ปิด pool ทุกกรณี ไม่งั้น Playwright จะค้างรอการเชื่อมต่อที่ไม่ปิด
    await pool.end();
  }
});

// ต่อสัญญาต้องได้ใบใหม่เป็นร่าง ไม่ใช่ไปทับใบเดิมที่ยังใช้อยู่
test("owner renews a lease without overwriting the active lease", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  // รอให้หลุดจากหน้า login ก่อน ค่อยไปต่อ กันการกดตอนที่ยังไม่ล็อกอินเสร็จ
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  await page.goto(`/admin/properties/${e2e.propertyId}/contracts`);
  // สัญญาที่เหลือไม่ถึง 120 วันจะมีปุ่มต่อสัญญาโผล่มาตรง ๆ ถ้ายังไม่ถึงต้องเข้าทางเมนู
  // สัญญาตั้งต้นขยับเข้าช่วงนั้นเองตามเวลาที่ผ่านไป เทสต์จึงต้องรองรับทั้งสองแบบ
  // แถวโหลดแบบไม่พร้อมหน้า ต้องรอให้ขึ้นก่อนค่อยดูว่ามีปุ่มแบบไหน
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
  // ช่องห้องต้องล็อกไว้ ต่อสัญญาคือต่อห้องเดิม ย้ายห้องต้องทำสัญญาใหม่
  await expect(dialog.getByLabel("ห้อง")).toBeDisabled();
  // วันที่ต้องถูกเติมให้อัตโนมัติต่อจากใบเดิม ผู้ใช้ไม่ต้องคำนวณเอง
  await expect(dialog.getByLabel("วันเริ่มสัญญา")).toHaveValue("2027-01-01");
  await expect(dialog.getByLabel("วันสิ้นสุดสัญญา")).toHaveValue("2027-12-31");
  await dialog.getByRole("button", { name: "สร้างสัญญาต่ออายุ" }).click();

  const rows = page.locator(".contract-table .figma-table-row");
  // ต้องเหลือสองแถว ใบเดิมกับใบใหม่ ถ้าได้แถวเดียวแปลว่าไปเขียนทับใบเดิม
  await expect(rows).toHaveCount(2);
  // ลำดับแถวไม่แน่นอน และป้ายสถานะของใบเดิมเปลี่ยนไปตามว่าใกล้หมดอายุแค่ไหน
  // จึงเช็คแค่ว่ามีใบร่างใบใหม่อยู่คู่กับใบเดิมที่ยังใช้อยู่ ก็พอพิสูจน์ว่าไม่ได้ทับกัน
  const originalRow = rows.filter({ hasText: "CTR-E2E-E101" });
  const draftRow = rows.filter({ hasNotText: "CTR-E2E-E101" });
  await expect(draftRow).toContainText("ฉบับร่าง");
  await expect(originalRow).not.toContainText("ฉบับร่าง");
});
