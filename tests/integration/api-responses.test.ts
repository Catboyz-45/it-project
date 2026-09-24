import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError, apiErrorResponse, apiSuccessBinaryResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { setRequestActorContext } from "@/lib/server/request-context";
import { getDatabase } from "@/lib/server/db";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;

function requestOf(method: string, requestId?: string) {
  const request = new NextRequest("http://localhost/api/v1/admin/properties/p1/documents", {
    method,
    headers: requestId ? { "x-request-id": requestId } : {},
  });
  if (fixture) setRequestActorContext(request, { userId: fixture.owner.id, propertyId: fixture.property.id });
  return request;
}

beforeAll(async () => {
  fixture = await createIntegrationFixture();
});

afterAll(async () => {
  if (!fixture) return;
  await cleanupIntegrationFixture({
    propertyIds: [fixture.property.id, fixture.otherProperty.id],
    userIds: [fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id],
  });
  await getDatabase().$disconnect();
});

// ทุก route ตอบผ่านสองตัวนี้ รูปแบบคำตอบและการบันทึก audit จึงต้องเหมือนกัน
// ไม่ว่าจะตอบเป็น JSON หรือเป็นไฟล์ ไม่งั้นการตามรอยจะขาดเป็นช่วง ๆ
describe("central API responses", () => {
  it("reuses the request id the proxy sent", async () => {
    const response = apiSuccessResponse(requestOf("GET", "req-from-proxy"), { ok: true });
    expect(response.headers.get("x-request-id")).toBe("req-from-proxy");
    // แนบมาทั้งใน header และในตัวข้อมูล เผื่อฝั่งเบราว์เซอร์อ่านได้ไม่ครบทั้งสองทาง
    expect(await response.json()).toMatchObject({ ok: true, requestId: "req-from-proxy" });
  });

  it("makes up a request id when the proxy did not send one", async () => {
    const response = apiSuccessResponse(requestOf("GET"), { ok: true });
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  // คำตอบแบบไฟล์ต้องเก็บ header ที่ route กำหนดไว้ แล้วยังแนบ requestId ให้เหมือนกัน
  it("keeps the given headers on a binary response and still adds the request id", async () => {
    const body = new TextEncoder().encode("%PDF-1.7\n");
    const response = apiSuccessBinaryResponse(requestOf("GET", "binary-req"), body as unknown as BodyInit, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=x.pdf" },
    });
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe("inline; filename=x.pdf");
    expect(response.headers.get("x-request-id")).toBe("binary-req");
    expect(new TextDecoder().decode(new Uint8Array(await response.arrayBuffer())).startsWith("%PDF-")).toBe(true);
  });

  // การอ่านเฉย ๆ ไม่ต้องบันทึก ไม่งั้น log จะท่วมจนหาของจริงไม่เจอ
  it("writes no audit record for a read", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const before = new Date();
    apiSuccessResponse(requestOf("GET"), { ok: true }, undefined, { action: "READ_ONLY_CHECK" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const rows = await getDatabase().auditLog.count({
      where: { propertyId: fixture.property.id, action: "READ_ONLY_CHECK", createdAt: { gte: before } },
    });
    expect(rows).toBe(0);
  });

  it("writes an audit record for a change, from both response kinds", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const before = new Date();
    // ไม่ส่ง audit มาเลย ชื่อการกระทำจึงต้องถูกเติมจากเมท็อดให้เอง
    // และ targetType ต้องกลายเป็นพาธของคำขอ
    apiSuccessResponse(requestOf("POST"), { ok: true });
    apiSuccessBinaryResponse(requestOf("DELETE"), null, { headers: {} });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const rows = await getDatabase().auditLog.findMany({
      where: { propertyId: fixture.property.id, createdAt: { gte: before } },
      select: { action: true, targetType: true, result: true },
    });
    const path = "/api/v1/admin/properties/p1/documents";
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "API_POST_SUCCESS", targetType: path, result: "SUCCESS" }),
      expect.objectContaining({ action: "API_DELETE_SUCCESS", targetType: path, result: "SUCCESS" }),
    ]));
  });
});

// ด่านกัน CSRF สองชั้น ต้นทางต้องเป็นของเราเอง และต้องเป็น JSON
// เพราะฟอร์ม HTML ธรรมดาส่ง application/json ไม่ได้ เว็บอื่นจึงยิงฟอร์มมาใส่ไม่ได้
describe("same origin guard", () => {
  const post = (headers: Record<string, string>) => new NextRequest("http://localhost/api/v1/admin/properties/p1/rooms", {
    method: "POST",
    headers,
  });

  it("accepts a request from our own page with JSON", () => {
    expect(() => assertSameOrigin(post({ origin: "http://localhost", host: "localhost", "content-type": "application/json" })))
      .not.toThrow();
  });

  it("refuses a request with no origin at all", () => {
    expect(() => assertSameOrigin(post({ host: "localhost", "content-type": "application/json" }))).toThrow(ApiError);
  });

  it("refuses a request from another site", () => {
    expect(() => assertSameOrigin(post({ origin: "http://evil.test", host: "localhost", "content-type": "application/json" })))
      .toThrow(ApiError);
  });

  // origin ที่ไม่ใช่ URL ต้องไม่ทำให้ระบบพัง แต่ต้องไม่ผ่านด้วย
  it("refuses a malformed origin without blowing up", () => {
    expect(() => assertSameOrigin(post({ origin: "not a url", host: "localhost", "content-type": "application/json" })))
      .toThrow(ApiError);
  });

  it("refuses the right origin with the wrong content type", () => {
    try {
      assertSameOrigin(post({ origin: "http://localhost", host: "localhost", "content-type": "application/x-www-form-urlencoded" }));
      throw new Error("ควรจะโยนข้อผิดพลาดแต่ผ่านไปได้");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(415);
    }
  });
});

describe("error responses", () => {
  // ข้อความที่ตอบผู้ใช้ต้องไม่หลุดรายละเอียดภายใน แต่ต้องมี requestId ให้อ้างอิงได้
  it("hides the detail of an unexpected failure but keeps the request id", async () => {
    const response = apiErrorResponse(new Error("connect ECONNREFUSED 127.0.0.1:5432"), requestOf("POST", "err-req"));
    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe("err-req");
    const body = await response.json() as { error: string };
    expect(body.error).toBe("ไม่สามารถดำเนินการได้");
    expect(body.error).not.toContain("ECONNREFUSED");
  });

  it("passes through the message of an error we raised ourselves", async () => {
    const response = apiErrorResponse(new ApiError(409, "ห้องนี้มีสัญญาที่ใช้งานอยู่"), requestOf("POST"));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "ห้องนี้มีสัญญาที่ใช้งานอยู่" });
  });
});
