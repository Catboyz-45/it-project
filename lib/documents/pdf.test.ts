import { describe, expect, it } from "vitest";
import { browserLaunchOptions } from "@/lib/documents/pdf";

// sandbox ของ Chromium ต้องเปิดไว้ตอนพัฒนาบนเครื่องตัวเอง และปิดเฉพาะตอนรันใน container
// ที่ไม่มี user namespace ให้ใช้ ตัวทดสอบนี้กันไม่ให้ใครเผลอปิดทิ้งทั้งสองที่
describe("browser launch options", () => {
  it("keeps the sandbox on when no container browser is configured", () => {
    const options = browserLaunchOptions(undefined);
    expect(options).toEqual({ headless: true });
    expect(options).not.toHaveProperty("args");
  });

  it("disables the sandbox only for the browser installed in the image", () => {
    const options = browserLaunchOptions("/usr/bin/chromium");
    expect(options.executablePath).toBe("/usr/bin/chromium");
    // dev-shm ใน container เล็กมาก ถ้าไม่ปิด Chromium จะพังตอนเอกสารยาว
    expect(options.args).toEqual(expect.arrayContaining(["--no-sandbox", "--disable-dev-shm-usage"]));
  });
});
