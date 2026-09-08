/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “full billing lifecycle.spec” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { expect, type Page, test } from "@playwright/test";

const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const initialOwnerPassword = "Owner-Temporary-Password-123";
const ownerPassword = "Owner-Permanent-Password-456";
const tenantPassword = "Tenant-Journey-Password-123";
const testOrigin = new URL(
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3000"}`,
).origin;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “expect Json” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
 * - status: ค่า “status” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<T> ตามสัญญา TypeScript ของฟังก์ชัน
 */
async function expectJson<T>(
  response: { json(): Promise<unknown>; status(): number; statusText(): string },
  status: number,
): Promise<T> {
  const body = await response.json() as T & { error?: string };
  expect(response.status(), body.error ?? response.statusText()).toBe(status);
  return body;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “login” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - password: ค่า “password” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function login(page: Page, email: string, password: string) {
  return expectJson<{ redirectTo: string }>(await page.request.post("/api/auth/login", {
    headers: { origin: testOrigin },
    data: { email, password },
  }), 200);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “login Through Ui” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - password: ค่า “password” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function loginThroughUi(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await page.waitForLoadState("networkidle");
}

test("completes the critical tenant billing workflow through the owner and tenant UIs", async ({ page }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(10_000);
  test.skip(!bootstrapEmail || !bootstrapPassword, "Bootstrap Super Admin credentials are required");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ownerEmail = `journey-owner-${suffix}@example.test`;
  const tenantEmail = `journey-tenant-${suffix}@example.test`;
  const billingMonth = new Date().toISOString().slice(0, 7);
  const leaseStart = `${billingMonth}-01`;
  const leaseEnd = `${Number(billingMonth.slice(0, 4)) + 1}-${billingMonth.slice(5)}-01`;

  await login(page, bootstrapEmail!, bootstrapPassword!);

  const plans = await expectJson<{ data: Array<{ id: string; code: string; isActive: boolean; maxProperties: number }> }>(
    await page.request.get("/api/v1/super-admin/plans"),
    200,
  );
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “starter” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - { code }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  let starter = plans.data.find(({ code }) => code === "STARTER");
  if (!starter) {
    const created = await expectJson<{ data: { id: string; code: string; isActive: boolean; maxProperties: number } }>(
      await page.request.post("/api/v1/super-admin/plans", {
        headers: { origin: testOrigin },
        data: {
          code: "STARTER",
          name: "Starter",
          monthlyPrice: 0,
          maxProperties: 2,
          maxRooms: 20,
          allowPromptPay: true,
          allowFileUploads: true,
          allowPrioritySupport: false,
        },
      }),
      201,
    );
    starter = created.data;
  } else if (!starter.isActive || starter.maxProperties < 2) {
    await expectJson(await page.request.patch(`/api/v1/super-admin/plans/${starter.id}`, {
      headers: { origin: testOrigin },
      data: { isActive: true, maxProperties: 2 },
    }), 200);
  }

  const property = await expectJson<{ id: string }>(await page.request.post("/api/super-admin/properties", {
    headers: { origin: testOrigin },
    data: { name: `Journey Dorm ${suffix}`, shortName: `JD-${suffix}`.slice(0, 80) },
  }), 201);
  const secondProperty = await expectJson<{ id: string }>(await page.request.post("/api/super-admin/properties", {
    headers: { origin: testOrigin },
    data: { name: `Journey Annex ${suffix}`, shortName: `JA-${suffix}`.slice(0, 80) },
  }), 201);

  const owner = await expectJson<{ id: string; approvalStatus: string }>(
    await page.request.post("/api/super-admin/users", {
      headers: { origin: testOrigin },
      data: {
        email: ownerEmail,
        displayName: `Journey Owner ${suffix}`,
        password: initialOwnerPassword,
        propertyIds: [property.id, secondProperty.id],
      },
    }),
    201,
  );
  expect(owner.approvalStatus).toBe("PENDING");
  await expectJson(await page.request.patch(`/api/v1/super-admin/users/${owner.id}/approval`, {
    headers: { origin: testOrigin },
    data: { status: "APPROVED" },
  }), 200);
  await expectJson(await page.request.patch(`/api/v1/super-admin/properties/${property.id}`, {
    headers: { origin: testOrigin },
    data: { memberUserIds: [owner.id] },
  }), 200);
  await expectJson(await page.request.patch(`/api/v1/super-admin/properties/${secondProperty.id}`, {
    headers: { origin: testOrigin },
    data: { memberUserIds: [owner.id] },
  }), 200);

  await expectJson(await page.request.post("/api/auth/logout", {
    headers: { origin: testOrigin },
    data: {},
  }), 200);
  await loginThroughUi(page, ownerEmail, initialOwnerPassword);
  await expect(page).toHaveURL(/\/change-password$/);
  await page.getByLabel("รหัสผ่านใหม่").fill(ownerPassword);
  await page.getByLabel("ยืนยันรหัสผ่าน").fill(ownerPassword);
  await page.getByRole("button", { name: "ตั้งรหัสผ่านใหม่", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?passwordChanged=1$/);
  await loginThroughUi(page, ownerEmail, ownerPassword);
  // A brand-new account has no recorded policy acceptance yet and is gated
  // to /legal/accept before reaching its workspace.
  if (page.url().includes("/legal/accept")) {
    await page.getByLabel(/ฉันอ่านและยอมรับ/).check();
    await page.getByLabel(/ฉันรับทราบ/).check();
    await page.getByRole("button", { name: /ยืนยันและใช้งานต่อ/ }).click();
    await page.waitForLoadState("networkidle");
  }
  await expect(page).toHaveURL(/\/admin(?:\/properties\/[^/]+)?$/);

  await expectJson(await page.request.put(`/api/v1/admin/properties/${property.id}/settings`, {
    headers: { origin: testOrigin },
    data: {
      address: "99 Journey Road",
      contactPhone: "0800000000",
      contactEmail: ownerEmail,
      promptPayId: "0812345678",
      waterUnitRate: 18,
      electricityUnitRate: 7,
      billingDay: 1,
      dueDay: 5,
      lateFeePerDay: 20,
      lateFeeCap: 200,
      invoicePrefix: `J${String(Date.now()).slice(-8)}`,
    },
  }), 200);

  // A multi-property owner must be able to switch workspaces without losing
  // the property boundary. This is intentionally exercised through the UI.
  await page.goto(`/admin/properties/${property.id}`);
  const propertySwitcher = page.locator(".sidebar-property > button").first();
  await propertySwitcher.click();
  const secondPropertyMenuItem = page.getByRole("menuitem", { name: new RegExp(`JA-${suffix}`) });
  await expect(secondPropertyMenuItem).toBeVisible();
  await secondPropertyMenuItem.click();
  await expect(page).toHaveURL(new RegExp(`/admin/properties/${secondProperty.id}$`));
  await page.locator(".sidebar-property > button").first().click();
  await page.getByRole("menuitem", { name: new RegExp(`JD-${suffix}`) }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/properties/${property.id}$`));
  const buildings = await expectJson<{
    data: Array<{ id: string; floors: Array<{ id: string }> }>;
  }>(await page.request.get(`/api/v1/admin/properties/${property.id}/buildings`), 200);
  const building = buildings.data.at(0);
  const floor = building?.floors.at(0);
  expect(building).toBeTruthy();
  expect(floor).toBeTruthy();
  const room = await expectJson<{ data: { id: string; number: string } }>(
    await page.request.post(`/api/v1/admin/properties/${property.id}/rooms`, {
      headers: { origin: testOrigin },
      data: {
        buildingId: building!.id,
        floorId: floor!.id,
        number: `J-${suffix}`.slice(0, 30),
        roomType: "Standard",
        monthlyRent: 3500,
        depositAmount: 7000,
        capacity: 2,
        furniture: [],
      },
    }),
    201,
  );
  const invitation = await expectJson<{
    data: { invitation: { id: string }; invitationCode: string };
  }>(await page.request.post(`/api/v1/admin/properties/${property.id}/invitations`, {
    headers: { origin: testOrigin },
    data: { roomId: room.data.id, intendedRole: "PRIMARY", expiresInDays: 7 },
  }), 201);

  await expectJson(await page.request.post("/api/auth/logout", {
    headers: { origin: testOrigin },
    data: {},
  }), 200);
  await page.goto("/register");
  await page.getByLabel("รหัสเชิญจากหอพัก").fill(invitation.data.invitationCode);
  await page.getByLabel("ชื่อผู้เช่า").fill(`Journey Tenant ${suffix}`);
  await page.getByLabel("อีเมล").fill(tenantEmail);
  await page.getByLabel("เบอร์โทรศัพท์").fill("0891234567");
  // The label wraps a helper hint ("อย่างน้อย 12 ตัว...") so its accessible
  // name is longer than "รหัสผ่าน" alone; match by prefix instead of exact text.
  await page.getByLabel(/^รหัสผ่าน/).fill(tenantPassword);
  await page.getByLabel(/ฉันอ่านและยอมรับ/).check();
  await page.getByLabel(/ฉันรับทราบ/).check();
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “registration Response” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const registrationResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/tenant/register")
    && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "สมัครเป็นผู้เช่า" }).click();
  expect((await registrationResponse).status()).toBe(201);
  await expect(page.getByRole("status")).toContainText("สมัครสำเร็จ");

  await loginThroughUi(page, ownerEmail, ownerPassword);
  if (!page.url().includes(`/admin/properties/${property.id}`)) {
    await page.locator(".sidebar-property > button").first().click();
    await page.getByRole("menuitem", { name: new RegExp(`JD-${suffix}`) }).click();
  }
  await expect(page).toHaveURL(new RegExp(`/admin/properties/${property.id}`));

  await page.getByRole("link", { name: /^ผู้เช่า(?:\s|$)/ }).click();
  await page.getByRole("button", { name: "คำขอเข้าพัก", exact: true }).click();
  await page.getByLabel("ค้นหาคำขอเข้าพัก").fill(tenantEmail);
  const approveOccupancy = page.getByRole("button", {
    name: new RegExp(`อนุมัติ Journey Tenant ${suffix}`),
  });
  await expect(approveOccupancy).toBeVisible();
  await approveOccupancy.click();
  const occupancyConfirmation = page.getByRole("alertdialog", { name: "อนุมัติคำขอเข้าพัก?" });
  await occupancyConfirmation.getByRole("button", { name: "อนุมัติ", exact: true }).click();
  await expect(approveOccupancy).toBeHidden();

  await page.getByRole("link", { name: "สัญญาเช่า", exact: true }).click();
  await page.getByRole("button", { name: "สร้างสัญญา", exact: true }).click();
  const leaseDialog = page.getByRole("dialog", { name: "สร้างสัญญาใหม่" });
  // "ห้อง" is a custom dropdown component, not a native <select>.
  await leaseDialog.getByLabel("ห้อง").click();
  await page.getByRole("option", { name: `ห้อง ${room.data.number}`, exact: true }).click();
  await leaseDialog.getByLabel("วันเริ่มสัญญา").fill(leaseStart);
  await leaseDialog.getByLabel("วันสิ้นสุดสัญญา").fill(leaseEnd);
  await leaseDialog.getByLabel("เงินประกัน").fill("7000");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “lease Response Promise” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const leaseResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith(`/api/v1/admin/properties/${property.id}/leases`)
    && response.request().method() === "POST",
  );
  await leaseDialog.getByRole("button", { name: "สร้างสัญญา", exact: true }).click();
  const lease = await expectJson<{ data: { id: string; leaseNumber: string; status: string } }>(
    await leaseResponsePromise,
    201,
  );
  expect(lease.data.status).toBe("DRAFT");
  await expect(page.getByText(lease.data.leaseNumber, { exact: true })).toBeVisible();

  for (const meter of [
    { menu: "มิเตอร์น้ำ", previous: "100", current: "110" },
    { menu: "มิเตอร์ไฟ", previous: "1000", current: "1060" },
  ]) {
    await page.getByRole("link", { name: meter.menu, exact: true }).click();
    await page.getByLabel("รอบเดือนบันทึกมิเตอร์").fill(billingMonth);
    await page.getByPlaceholder("ค้นหาห้องหรือผู้เช่า...").fill(room.data.number);
    const meterRow = page.getByRole("row").filter({
      has: page.getByText(room.data.number, { exact: true }),
    });
    await meterRow.getByLabel(`เลขมิเตอร์ตั้งต้นห้อง ${room.data.number}`).fill(meter.previous);
    await meterRow.getByLabel(`เลขมิเตอร์ล่าสุดห้อง ${room.data.number}`).fill(meter.current);
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “meter Response” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const meterResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/v1/admin/properties/${property.id}/meter-readings/bulk`)
      && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "ตรวจสอบและบันทึก 1 ห้อง", exact: true }).click();
    const meterConfirmation = page.getByRole("alertdialog", { name: "ยืนยันบันทึกมิเตอร์ทั้งชุด" });
    await expect(meterConfirmation).toContainText("หากห้องใดบันทึกไม่ได้ ระบบจะไม่บันทึกทุกห้อง");
    await meterConfirmation.getByRole("button", { name: "ยืนยันบันทึก 1 ห้อง", exact: true }).click();
    expect((await meterResponse).status()).toBe(201);
    await expect(meterRow).toContainText("บันทึกแล้ว");
  }

  await page.getByRole("link", { name: /^บิลและการเงิน(?:\s|$)/ }).click();
  await page.getByRole("button", { name: "สร้างร่างรายห้อง", exact: true }).click();
  const invoiceDialog = page.getByRole("dialog", { name: "สร้างร่างบิล" });
  await invoiceDialog.getByLabel("เดือนที่ออกบิล").fill(billingMonth);
  // "ห้อง" is a custom dropdown component, not a native <select>.
  await invoiceDialog.getByLabel("ห้อง").click();
  await page.getByRole("option", { name: `ห้อง ${room.data.number} · มีผู้เช่า`, exact: true }).click();
  await invoiceDialog.getByRole("button", { name: /ถัดไป/ }).click();
  await expect(invoiceDialog.getByText("พร้อมสร้าง")).toBeVisible();
  await invoiceDialog.getByRole("button", { name: /ถัดไป/ }).click();
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “invoice Response Promise” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const invoiceResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith(`/api/v1/admin/properties/${property.id}/invoices`)
    && response.request().method() === "POST",
  );
  await invoiceDialog.getByRole("button", { name: /บันทึกร่าง 1 รายการ/ }).click();
  const invoiceResponse = await invoiceResponsePromise;
  const invoice = await expectJson<{ data: { id: string; invoiceNumber: string; total: string } }>(
    invoiceResponse,
    201,
  );
  await expect(invoiceDialog).toBeHidden();
  await expect(page.getByText(invoice.data.invoiceNumber, { exact: true })).toBeVisible();
  expect(Number(invoice.data.total)).toBeGreaterThan(3500);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “issue Response Promise” หลังผ่านการตรวจที่เกี่ยวข้อง
   * รับค่า:
   * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const issueResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith(`/api/v1/admin/properties/${property.id}/invoices/${invoice.data.id}`)
    && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: `จัดการบิล ${invoice.data.invoiceNumber}` }).click();
  await page.getByRole("menuitem", { name: "ออกบิล", exact: true }).click();
  expect((await issueResponsePromise).status()).toBe(200);
  await expect(page.getByText("รอชำระ", { exact: true }).last()).toBeVisible();

  await expectJson(await page.request.post("/api/auth/logout", {
    headers: { origin: testOrigin },
    data: {},
  }), 200);
  await loginThroughUi(page, tenantEmail, tenantPassword);
  await expect(page).toHaveURL(/\/tenant/);
  await page.getByRole("link", { name: /^บิลและชำระเงิน(?:\s|$)/ }).click();
  await page.getByRole("button", { name: new RegExp(invoice.data.invoiceNumber) }).click();
  // Invoice details expand inline (accordion), not in a dialog.
  const tenantInvoiceDialog = page.getByLabel(`รายละเอียดบิล ${invoice.data.invoiceNumber}`, { exact: true });
  await expect(tenantInvoiceDialog.getByAltText(`PromptPay QR ${invoice.data.invoiceNumber}`)).toBeVisible();
  const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  await tenantInvoiceDialog.locator('input[type="file"]').setInputFiles({
    name: `slip-${suffix}.png`,
    mimeType: "image/png",
    buffer: pngHeader,
  });
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “payment Response Promise” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const paymentResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith(`/api/v1/tenant/invoices/${invoice.data.id}/payment-submissions`)
    && response.request().method() === "POST",
  );
  await tenantInvoiceDialog.getByRole("button", { name: "ส่งหลักฐาน" }).click();
  const payment = await expectJson<{ data: { id: string; status: string; amount: string } }>(
    await paymentResponsePromise,
    201,
  );
  expect(payment.data).toMatchObject({ status: "PENDING_REVIEW", amount: invoice.data.total });
  await expect(tenantInvoiceDialog.getByText("รอตรวจสอบ", { exact: true })).toBeVisible();

  await expectJson(await page.request.post("/api/auth/logout", {
    headers: { origin: testOrigin },
    data: {},
  }), 200);
  await loginThroughUi(page, ownerEmail, ownerPassword);
  if (!page.url().includes(`/admin/properties/${property.id}`)) {
    await page.locator(".sidebar-property > button").first().click();
    await page.getByRole("menuitem", { name: new RegExp(`JD-${suffix}`) }).click();
  }
  await page.getByRole("link", { name: /^บิลและการเงิน(?:\s|$)/ }).click();
  await page.getByRole("button", { name: "ตรวจสอบการชำระ", exact: true }).click();
  await page.getByLabel("ค้นหาหลักฐานการชำระ").fill(invoice.data.invoiceNumber);
  const paymentDetails = page.getByRole("region", { name: `รายละเอียดการชำระ ${invoice.data.invoiceNumber}` });
  const approvePayment = paymentDetails.getByRole("button", { name: "ยืนยันรับชำระ", exact: true });
  await expect(approvePayment).toBeVisible();
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “approval Response Promise” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const approvalResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith(
      `/api/v1/admin/properties/${property.id}/payment-submissions/${payment.data.id}`,
    ) && response.request().method() === "PATCH",
  );
  await approvePayment.click();
  const paymentConfirmation = page.getByRole("alertdialog", { name: "ยืนยันรับชำระ?" });
  await paymentConfirmation.getByRole("button", { name: "ยืนยันรับชำระ", exact: true }).click();
  const approved = await expectJson<{ data: { id: string; status: string } }>(
    await approvalResponsePromise,
    200,
  );
  expect(approved.data.status).toBe("APPROVED");
  await page.getByRole("button", { name: "บิลห้องพัก", exact: true }).click();
  await page.getByLabel("ค้นหาบิล").fill(invoice.data.invoiceNumber);
  await expect(page.getByText(invoice.data.invoiceNumber, { exact: true })).toBeVisible();
  await expect(page.getByText("ชำระแล้ว", { exact: true }).last()).toBeVisible();
});
