import { expect, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";

// ล็อกอินที่ใช้ซ้ำทุกเทสต์ในไฟล์นี้ รอจนหน้าเปลี่ยนเสร็จจริงก่อนคืนค่า
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  // รอ networkidle อย่างเดียวไม่พอ เครื่องช้า ๆ มันนิ่งได้กลางคันขณะกำลังเปลี่ยนหน้า
  // แล้ว page.goto ของคนเรียกจะไปชนกับการเปลี่ยนหน้าที่ยังค้างอยู่ จนได้ ERR_ABORTED
  // จึงต้องยืนยันก่อนว่าออกจาก /login ไปแล้วจริง
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

test.describe("owner journey", () => {
  // แท็บตามมาตรฐาน ARIA ต้องเลื่อนด้วยลูกศร และ Home/End กระโดดหัวท้าย
  test("navigates room and settings tabs with the keyboard", async ({ page }) => {
    await login(page, e2e.ownerEmail);

    await page.goto(`/admin/properties/${e2e.propertyId}/rooms`);
    const floorTabs = page.getByRole("tablist", { name: "เลือกชั้น" });
    const allFloorsTab = floorTabs.getByRole("tab", { name: "ทุกชั้น" });
    const firstFloorTab = floorTabs.getByRole("tab", { name: "ชั้น 1" });
    await expect(allFloorsTab).toHaveAttribute("aria-selected", "true");
    await allFloorsTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(firstFloorTab).toBeFocused();
    // แท็บชุดนี้เลือกตามโฟกัสทันที เลื่อนไปถึงไหนก็สลับเนื้อหาให้เลย ไม่ต้องกด Enter ซ้ำ
    await expect(firstFloorTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(allFloorsTab).toBeFocused();
    await expect(allFloorsTab).toHaveAttribute("aria-selected", "true");

    const viewTabs = page.getByRole("tablist", { name: "รูปแบบการแสดงผังห้อง" });
    const cardTab = viewTabs.getByRole("tab", { name: "การ์ด" });
    const tableTab = viewTabs.getByRole("tab", { name: "ตาราง" });
    await cardTab.focus();
    await page.keyboard.press("End");
    await expect(tableTab).toBeFocused();
    await expect(tableTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: /รูปแบบตาราง/ })).toBeVisible();

    await page.goto(`/admin/properties/${e2e.propertyId}/settings`);
    const settingsTabs = page.getByRole("tablist", { name: "เมนูตั้งค่า" });
    const generalTab = settingsTabs.getByRole("tab", { name: "ข้อมูลหอ" });
    const billingTab = settingsTabs.getByRole("tab", { name: "ค่าใช้จ่าย" });
    await generalTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(billingTab).toBeFocused();
    await expect(billingTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "ค่าใช้จ่าย" })).toBeVisible();
    await page.keyboard.press("End");
    await expect(settingsTabs.getByRole("tab", { name: "แพ็กเกจและการต่ออายุ" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(generalTab).toBeFocused();
    await expect(generalTab).toHaveAttribute("aria-selected", "true");
  });

  // แก้ข้อมูลค้างไว้แล้วกดยกเลิก ต้องมีการถามยืนยันก่อน ไม่ใช่ทิ้งงานที่พิมพ์ไปแล้วเงียบ ๆ
  test("tenant editor is accessible and protects unsaved changes", async ({ page }) => {
    await login(page, e2e.ownerEmail);
    await page.getByLabel("เมนูหลัก").getByRole("link", { name: /^ผู้เช่า(?:\s|$)/ }).click();
    await page.getByRole("button", { name: "ผู้เช่าปัจจุบัน", exact: true }).click();
    const tenantButton = page.getByRole("button", { name: /E2E Tenant E101/ });
    await tenantButton.click();

    const dialog = page.getByRole("dialog", { name: /ห้อง E101 · E2E Tenant/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    // เปิดกล่องแล้วโฟกัสต้องย้ายเข้าไปข้างในทันที คนใช้คีย์บอร์ดจะได้ไม่หลงว่าตอนนี้อยู่ตรงไหน
    await expect(dialog.getByRole("button", { name: "ปิดหน้าต่าง" })).toBeFocused();
    await dialog.getByLabel("ชื่อ-นามสกุล").fill("E2E Tenant changed");

    await dialog.getByRole("button", { name: "ยกเลิก", exact: true }).click();
    // กดยกเลิกในกล่องยืนยันต้องได้กลับไปแก้ต่อ ไม่ใช่ปิดทิ้งทั้งคู่
    const keepEditing = page.getByRole("alertdialog", { name: "ทิ้งข้อมูลที่แก้ไข?" });
    await keepEditing.getByRole("button", { name: "ยกเลิก", exact: true }).click();
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "ยกเลิก", exact: true }).click();
    await page.getByRole("alertdialog", { name: "ทิ้งข้อมูลที่แก้ไข?" })
      .getByRole("button", { name: "ทิ้งข้อมูล", exact: true }).click();
    await expect(dialog).toBeHidden();
    // ปิดกล่องแล้วโฟกัสต้องเด้งกลับปุ่มที่กดเปิด ไม่ใช่หล่นไปอยู่ต้นหน้า
    await expect(tenantButton).toBeFocused();

    await tenantButton.click();
    const reopenedDialog = page.getByRole("dialog", { name: /ห้อง E101 · E2E Tenant/ });
    await reopenedDialog.getByRole("button", { name: "ย้ายออก / ย้ายห้อง" }).click();
    // กล่องซ้อนกล่อง ตัวในต้องมีด่านยืนยันของตัวเองเหมือนกัน
    const transitionDialog = page.getByRole("dialog", { name: /E2E Tenant · ห้อง E101/ });
    await transitionDialog.getByLabel("เหตุผล").fill("ทดสอบขั้นตอนยืนยัน");
    await transitionDialog.getByRole("button", { name: "ยกเลิก" }).click();
    await page.getByRole("alertdialog", { name: "ทิ้งข้อมูลที่ยังไม่บันทึก?" })
      .getByRole("button", { name: "ทิ้งข้อมูล", exact: true }).click();
    await reopenedDialog.getByRole("button", { name: "ยกเลิก" }).click();
  });

  // เดินตามงานประจำวันของเจ้าของหอทั้งเส้น ตั้งแต่อนุมัติคำขอจนตรวจหลักฐานการชำระ
  test("reviews tenant onboarding and payment operations in the assigned property", async ({ page }) => {
    await login(page, e2e.ownerEmail);
    await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}`));
    await expect(page.getByText("E2E อยู่สบาย", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toBeVisible();

    await page.getByLabel("เมนูหลัก").getByRole("link", { name: /^ผู้เช่า(?:\s|$)/ }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}/tenants$`));
    await expect(page.getByRole("heading", { name: "ผู้เช่า", exact: true })).toBeVisible();
    // กด refresh แล้วต้องอยู่ที่เดิม ไม่ใช่เด้งกลับหน้าแรก
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}/tenants$`));
    await expect(page.getByRole("heading", { name: "ผู้เช่า", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "คำขอเข้าพัก", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}/tenants\\?tab=pending$`));
    await page.reload();
    // แท็บที่เลือกอยู่ถูกเก็บไว้ใน URL กด refresh แล้วจึงยังอยู่แท็บเดิม
    await expect(page.getByRole("button", { name: "คำขอเข้าพัก", exact: true })).toHaveClass(/active/);
    await expect(page.getByLabel("ค้นหาคำขอเข้าพัก")).toBeVisible();

    const approve = page.getByRole("button", { name: "อนุมัติ E2E Pending Tenant" });
    // อนุมัติเฉพาะตอนที่ยังมีคำขอค้าง เทสต์รอบก่อนอาจอนุมัติไปแล้ว
    if (await approve.isVisible()) {
      await approve.click();
      await page.getByRole("alertdialog", { name: "อนุมัติคำขอเข้าพัก?" })
        .getByRole("button", { name: "อนุมัติ", exact: true }).click();
      await expect(page.getByText("ไม่มีคำขอเข้าพักที่รอตรวจสอบ")).toBeVisible();
    }

    await page.getByRole("button", { name: "ผู้เช่าปัจจุบัน", exact: true }).click();
    await page.getByLabel("ค้นหาผู้เช่า").fill("E2E Tenant");
    await expect(page.getByRole("button", { name: /E2E Tenant E101/ })).toBeVisible();

    await page.getByLabel("เมนูหลัก").getByRole("link", { name: /สัญญาเช่า/ }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}/contracts$`));
    await expect(page.getByText("CTR-E2E-E101", { exact: false })).toBeVisible();
    await expect(page.getByText("v1", { exact: true })).toBeVisible();

    await page.getByLabel("เมนูหลัก").getByRole("link", { name: /บิลและการเงิน/ }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}/invoices$`));
    await expect(page.getByText("E2E-202607-E101", { exact: true })).toBeVisible();
    // ปุ่มย้อนกลับและไปหน้าถัดไปของเบราว์เซอร์ต้องใช้ได้ปกติ ไม่ใช่ค้างอยู่หน้าเดิม
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}/contracts$`));
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}/invoices$`));
    await page.getByRole("button", { name: "ตรวจสอบการชำระ", exact: true }).click();
    await expect(page.getByLabel("ค้นหาหลักฐานการชำระ")).toBeVisible();
    await expect(page.getByRole("heading", { name: "E2E-202607-E101" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ยืนยันรับชำระ", exact: true })).toBeVisible();
  });
});

test.describe("tenant journey", () => {
  // ไล่ดูทุกหน้าที่ผู้เช่าเปิดได้ ว่าข้อมูลของตัวเองขึ้นครบ
  test("views room, bill, PromptPay, lease, announcements and parcels", async ({ page }) => {
    await login(page, e2e.tenantEmail);
    await expect(page).toHaveURL(/\/tenant/);
    // หน้าแรกไม่มีแบนเนอร์ทักทายแล้ว หอกับห้องที่กำลังดูอยู่ดูได้จากตัวเลือกการเข้าพักมุมบนขวา
    await expect(page.getByRole("heading", { name: "ภาพรวมที่ต้องรู้" })).toBeVisible();
    await expect(page.getByText("ยอดที่ต้องชำระ", { exact: true })).toBeVisible();
    await expect(page.getByText("พัสดุรอรับ", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("เรื่องที่กำลังติดตาม", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: /^บิลและชำระเงิน(?:\s|$)/ }).click();
    await expect(page).toHaveURL(/\/tenant\/invoices$/);
    await expect(page.getByRole("heading", { name: "บิลและชำระเงิน" })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/tenant\/invoices$/);
    await expect(page.getByRole("heading", { name: "บิลและชำระเงิน" })).toBeVisible();
    // รายละเอียดบิลกางออกในหน้าเลย ไม่ใช่กล่องซ้อน กดปุ่มเดิมซ้ำคือปิด
    await page.getByRole("button", { name: /E2E-202607-E101/ }).click();
    const invoiceDetails = page.getByLabel("รายละเอียดบิล E2E-202607-E101", { exact: true });
    await expect(invoiceDetails.getByText("สแกน PromptPay")).toBeVisible();
    // QR PromptPay ต้องถูกสร้างขึ้นจริง ไม่ใช่รูปเปล่าหรือรูปแตก
    await expect(invoiceDetails.getByAltText("PromptPay QR E2E-202607-E101")).toBeVisible();
    await page.getByRole("button", { name: /E2E-202607-E101/ }).click();
    await expect(invoiceDetails).toBeHidden();

    await page.getByRole("link", { name: "สัญญา", exact: true }).click();
    await expect(page).toHaveURL(/\/tenant\/lease$/);
    await expect(page.getByRole("heading", { name: "สัญญาปัจจุบัน" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "CTR-E2E-E101" })).toBeVisible();
    await expect(page.getByText("v1", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "ประกาศ", exact: true }).click();
    await expect(page.getByRole("heading", { name: "ประกาศ E2E" })).toBeVisible();
    await expect(page.getByText("แจ้งทดสอบระบบสำหรับผู้เช่า")).toBeVisible();

    await page.getByRole("link", { name: /^พัสดุ(?:\s|$)/ }).click();
    await expect(page.getByRole("heading", { name: "รอรับพัสดุ" })).toBeVisible();
    await expect(page.getByText("พัสดุ E2E ที่เคาน์เตอร์")).toBeVisible();
  });

  // สองงานที่ผู้เช่าทำบ่อยที่สุด แจ้งซ่อมและทักหาหอ
  test("creates a repair ticket and sends a chat message", async ({ page }) => {
    await login(page, e2e.tenantEmail);
    await expect(page).toHaveURL(/\/tenant/);

    await page.getByLabel("เมนูผู้เช่า").getByRole("link", { name: "แจ้งเรื่อง", exact: true }).click();
    await page.locator("section").getByRole("button", { name: "แจ้งเรื่อง", exact: true }).click();
    const ticketDialog = page.getByRole("dialog");
    await ticketDialog.getByLabel("หัวข้อ").fill("ก๊อกน้ำ E2E รั่ว");
    await ticketDialog.getByLabel("รายละเอียด").fill("น้ำหยดต่อเนื่องใต้ก๊อกล้างหน้า");
    await ticketDialog.getByLabel("ความเร่งด่วน").click();
    await page.getByRole("option", { name: "ด่วน", exact: true }).click();
    await ticketDialog.getByRole("button", { name: "ส่งเรื่อง" }).click();
    await expect(ticketDialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "ก๊อกน้ำ E2E รั่ว" }).first()).toBeVisible();
    await expect(page.getByText("ด่วน", { exact: true }).first()).toBeVisible();

    // การติดต่อหอเป็นกล่องแชทลอยมุมจอ ไม่ใช่หน้าในเมนู
    await page.getByRole("button", { name: /เปิดแชทกับหอพัก/ }).click();
    const chatWidget = page.getByRole("dialog", { name: "แชทกับหอพัก" });
    await expect(chatWidget).toBeVisible();
    // เติมเวลาลงในข้อความ รันซ้ำจะได้ไม่ไปเจอข้อความเดิมจากรอบก่อนแล้วผ่านทั้งที่ส่งไม่สำเร็จ
    const message = `ข้อความ E2E ${Date.now()}`;
    await chatWidget.getByPlaceholder("พิมพ์ข้อความ...").fill(message);
    await chatWidget.getByRole("button", { name: "ส่งข้อความ" }).click();
    await expect(chatWidget.getByText(message, { exact: true })).toBeVisible();
  });
});
