import { describe, expect, it } from "vitest";
import { createApiError, formatClientError, readApiData, readApiPayload } from "@/lib/client/api-error";

describe("client API errors", () => {
  it("includes the request ID in the user-facing error", () => {
    const error = createApiError({ error: "บันทึกไม่สำเร็จ", requestId: "req-123" }, "ผิดพลาด");
    expect(formatClientError(error, "ผิดพลาด")).toBe("บันทึกไม่สำเร็จ (รหัสอ้างอิง: req-123)");
  });

  // เงื่อนไขที่ตั้งใจตอบ (4xx) อธิบายตัวเองอยู่แล้ว ไม่ต้องพ่วงรหัสอ้างอิงให้ดูเหมือนระบบพัง
  it("keeps expected 4xx messages clean but tags server failures", () => {
    expect(formatClientError(createApiError({ error: "หอพักยังไม่ได้ตั้งค่า PromptPay", requestId: "req-1" }, "ผิดพลาด", 409), "ผิดพลาด"))
      .toBe("หอพักยังไม่ได้ตั้งค่า PromptPay");
    expect(formatClientError(createApiError({ error: "ไม่สามารถดำเนินการได้", requestId: "req-2" }, "ผิดพลาด", 500), "ผิดพลาด"))
      .toBe("ไม่สามารถดำเนินการได้ (รหัสอ้างอิง: req-2)");
  });

  // บอกว่าช่องไหนผิดด้วยข้อความภาษาไทยที่เขียนไว้ในกฎ แต่ไม่โชว์ข้อความอังกฤษของ Zod
  it("prefers a Thai field message over the generic validation error", () => {
    const issues = [{ path: "bankName", message: "Too small: expected string to have >=1 characters" }, { path: "bankAccountNumber", message: "เลขบัญชีต้องเป็นตัวเลข 10-12 หลัก" }];
    expect(createApiError({ error: "ข้อมูลไม่ถูกต้อง", issues }, "ผิดพลาด", 400).message).toBe("เลขบัญชีต้องเป็นตัวเลข 10-12 หลัก");
    expect(createApiError({ error: "ข้อมูลไม่ถูกต้อง", issues: [issues[0]] }, "ผิดพลาด", 400).message).toBe("ข้อมูลไม่ถูกต้อง");
  });

  // ค่าที่ไม่ใช่ Error ต้องได้ข้อความสำรอง ไม่ใช่ข้อความว่างหรือรายละเอียดภายในระบบ
  it("uses a safe fallback for unknown errors", () => {
    expect(formatClientError(null, "ไม่สามารถดำเนินการได้")).toBe("ไม่สามารถดำเนินการได้");
  });

  it("preserves a request ID from an API error envelope", async () => {
    const response = new Response(JSON.stringify({ error: "บันทึกไม่สำเร็จ", requestId: "req-body" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });

    await expect(readApiPayload(response, "ผิดพลาด")).rejects.toMatchObject({
      message: "บันทึกไม่สำเร็จ",
      requestId: "req-body",
    });
  });

  // ตอบกลับมาไม่ใช่ JSON เช่นหน้า error ของ proxy ก็ยังต้องได้รหัสอ้างอิงจาก header ไว้ให้ผู้ใช้แจ้ง
  it("uses the response header request ID when the body is invalid", async () => {
    const response = new Response("not-json", {
      status: 502,
      headers: { "x-request-id": "req-header" },
    });

    await expect(readApiPayload(response, "ระบบไม่พร้อม")).rejects.toEqual(
      expect.objectContaining({ message: "ระบบไม่พร้อม", requestId: "req-header" }),
    );
  });

  it("returns data from the standard success envelope", async () => {
    const response = new Response(JSON.stringify({ data: { id: "1" }, requestId: "req-ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    await expect(readApiData<{ id: string }>(response, "โหลดไม่สำเร็จ")).resolves.toEqual({ id: "1" });
  });

  it("shows a plain error message without a reference and falls back when the API sent no message", () => {
    expect(formatClientError(new Error("เครือข่ายขัดข้อง"), "ผิดพลาด")).toBe("เครือข่ายขัดข้อง");
    expect(createApiError({}, "ข้อความสำรอง").message).toBe("ข้อความสำรอง");
  });

  // ตัวข้อมูลไม่มีรหัสอ้างอิง ให้ใช้รหัสจาก header แทน ถ้าไม่มีทั้งคู่ก็ปล่อยว่าง
  it("takes the request ID from the header when the error body has none", async () => {
    const withHeader = new Response(JSON.stringify({ error: "ไม่พบ" }), { status: 404, headers: { "x-request-id": "req-h" } });
    await expect(readApiPayload(withHeader, "ผิดพลาด")).rejects.toMatchObject({ requestId: "req-h" });
    const withoutAny = new Response(JSON.stringify({}), { status: 500 });
    await expect(readApiPayload(withoutAny, "ผิดพลาด")).rejects.toMatchObject({ message: "ผิดพลาด", requestId: undefined });
    const invalidWithoutHeader = new Response("oops", { status: 502 });
    await expect(readApiPayload(invalidWithoutHeader, "ระบบไม่พร้อม")).rejects.toMatchObject({ requestId: undefined });
  });

  it("returns the payload of a successful response", async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
    await expect(readApiPayload(response, "ผิดพลาด")).resolves.toEqual({ ok: true });
  });

  // สำเร็จแต่ไม่มี data แปลว่า API ตอบผิดรูปแบบ ต้องแจ้งเป็นข้อผิดพลาด ไม่ใช่คืน undefined
  it("treats a success without data as an error", async () => {
    const fromBody = new Response(JSON.stringify({ requestId: "req-body" }), { status: 200 });
    await expect(readApiData(fromBody, "โหลดไม่สำเร็จ")).rejects.toMatchObject({ requestId: "req-body" });
    const fromHeader = new Response(JSON.stringify({}), { status: 200, headers: { "x-request-id": "req-h" } });
    await expect(readApiData(fromHeader, "โหลดไม่สำเร็จ")).rejects.toMatchObject({ requestId: "req-h" });
    const fromNothing = new Response(JSON.stringify({}), { status: 200 });
    await expect(readApiData(fromNothing, "โหลดไม่สำเร็จ")).rejects.toMatchObject({ requestId: undefined });
  });
});
