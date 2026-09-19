import { describe, expect, it } from "vitest";
import { createApiError, formatClientError, readApiData, readApiPayload } from "@/lib/client/api-error";

describe("client API errors", () => {
  it("includes the request ID in the user-facing error", () => {
    const error = createApiError({ error: "บันทึกไม่สำเร็จ", requestId: "req-123" }, "ผิดพลาด");
    expect(formatClientError(error, "ผิดพลาด")).toBe("บันทึกไม่สำเร็จ (รหัสอ้างอิง: req-123)");
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
});
