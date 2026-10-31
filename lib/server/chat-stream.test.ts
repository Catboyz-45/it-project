import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMessageStreamResponse } from "@/lib/server/chat-stream";

const decoder = new TextDecoder();

async function readAll(response: Response) {
  const reader = response.body!.getReader();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text;
    text += decoder.decode(value);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("chat message stream", () => {
  it("sends new messages as events, then reports an error and closes when the lookup fails", async () => {
    vi.useFakeTimers();
    const fetchAfter = vi.fn()
      .mockResolvedValueOnce([{ id: "m1", createdAt: "2026-01-01T00:00:01.000Z", body: "สวัสดี" }])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("database down"));
    const response = createMessageStreamResponse(new NextRequest("http://localhost/stream"), new Date("2026-01-01T00:00:00Z"), fetchAfter);
    expect(response.headers.get("content-type")).toBe("text/event-stream");

    const reading = readAll(response);
    await vi.advanceTimersByTimeAsync(3000);
    const text = await reading;

    expect(text).toContain("retry: 2000");
    expect(text).toContain('id: m1\ndata: {"id":"m1"');
    expect(text).toContain(": keep-alive");
    expect(text).toContain("event: error");
    // รอบถัดไปต้องถามต่อจากเวลาของข้อความล่าสุดที่ส่งไปแล้ว ไม่ส่งซ้ำ
    expect(fetchAfter.mock.calls[1][0]).toEqual(new Date("2026-01-01T00:00:01.000Z"));
  });

  // ผู้รับเลิกอ่านแล้วต้องหยุดถามฐานข้อมูล ไม่วนต่อไปเรื่อย ๆ จนหมดเวลาของคำขอ
  it("stops polling once the reader cancels", async () => {
    vi.useFakeTimers();
    const fetchAfter = vi.fn().mockResolvedValue([]);
    const response = createMessageStreamResponse(new NextRequest("http://localhost/stream"), new Date(), fetchAfter);
    const reader = response.body!.getReader();
    await reader.read();
    await vi.advanceTimersByTimeAsync(10);
    await reader.cancel();
    const callsAtCancel = fetchAfter.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchAfter.mock.calls.length).toBeLessThanOrEqual(callsAtCancel + 1);
  });

  it("stops when the request is aborted", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchAfter = vi.fn().mockResolvedValue([]);
    const response = createMessageStreamResponse(new NextRequest("http://localhost/stream", { signal: controller.signal }), new Date(), fetchAfter);
    const reading = readAll(response);
    await vi.advanceTimersByTimeAsync(10);
    controller.abort();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(reading).resolves.toContain("retry: 2000");
  });
});
