import puppeteer from "puppeteer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { browserLaunchOptions, generatePdf } from "@/lib/documents/pdf";

// เปิด Chromium จริงไม่ได้ในชุดเทสต์เร็ว จึงแทนด้วยเบราว์เซอร์ปลอมที่จดว่าถูกเรียกอย่างไร
const page = {
  setJavaScriptEnabled: vi.fn(async () => undefined),
  setContent: vi.fn(async () => undefined),
  pdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
  close: vi.fn(async () => undefined),
};
// จำตัวฟังเหตุการณ์ disconnected ไว้ เทสต์จะได้จำลองว่าเบราว์เซอร์ตายไปแล้ว
let onDisconnected: (() => void) | undefined;
const browser = {
  newPage: vi.fn(async () => page),
  close: vi.fn(async () => undefined),
  once: vi.fn((_event: string, listener: () => void) => { onDisconnected = listener; }),
};
vi.mock("puppeteer", () => ({ default: { launch: vi.fn(async () => browser) } }));
vi.mock("@/lib/server/env", () => ({ getServerEnv: () => ({ PUPPETEER_EXECUTABLE_PATH: undefined }) }));

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe("PDF rendering", () => {
  // HTML มาจากแม่แบบที่ผู้ใช้แก้ได้ จึงต้องปิด JavaScript ก่อนโหลดเนื้อหาเสมอ
  it("renders with JavaScript off and returns the PDF bytes", async () => {
    const bytes = await generatePdf("<p>hello</p>");
    expect(page.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    expect(page.setJavaScriptEnabled.mock.invocationCallOrder[0]).toBeLessThan(page.setContent.mock.invocationCallOrder[0]);
    expect(page.pdf).toHaveBeenCalledWith(expect.objectContaining({ format: "A4", printBackground: true }));
    expect(bytes.toString()).toBe("%PDF");
    expect(page.close).toHaveBeenCalledTimes(1);
  });

  // เปิดเบราว์เซอร์ใหม่ทุกครั้งช้าหลายวินาที คำขอถัดไปต้องใช้ตัวเดิม
  it("reuses one browser across renders", async () => {
    await generatePdf("<p>one</p>");
    await generatePdf("<p>two</p>");
    expect(puppeteer.launch).not.toHaveBeenCalled();
    expect(browser.newPage).toHaveBeenCalledTimes(2);
    expect(page.close).toHaveBeenCalledTimes(2);
  });

  // แท็บต้องถูกปิดแม้การสร้างไฟล์จะพัง ไม่งั้นค้างสะสมในเบราว์เซอร์ที่ใช้ร่วมกัน
  it("closes the page when rendering fails", async () => {
    page.setContent.mockRejectedValueOnce(new Error("timeout"));
    await expect(generatePdf("<p>slow</p>")).rejects.toThrow("timeout");
    expect(page.close).toHaveBeenCalledTimes(1);
  });

  // เบราว์เซอร์ตายไปแล้ว คำขอถัดไปต้องเปิดตัวใหม่ ไม่ใช่ใช้ตัวที่พังต่อ
  it("launches a new browser after the old one disconnects", async () => {
    onDisconnected?.();
    await generatePdf("<p>again</p>");
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
  });
});
