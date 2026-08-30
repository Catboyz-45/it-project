/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ readiness.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { databaseCheck, storageCheck, malwareCheck } = vi.hoisted(() => ({
  databaseCheck: vi.fn(),
  storageCheck: vi.fn(),
  malwareCheck: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: { $queryRaw: databaseCheck },
}));

vi.mock("@/server/storage/s3", () => ({
  storage: () => ({ checkHealth: storageCheck }),
}));

vi.mock("@/server/media/malware", () => ({
  checkMalwareScanner: malwareCheck,
}));

import { GET } from "@/app/api/health/ready/route";

describe("readiness endpoint", () => {
  beforeEach(() => {
    databaseCheck.mockReset().mockResolvedValue([{ "?column?": 1 }]);
    storageCheck.mockReset().mockResolvedValue(undefined);
    malwareCheck.mockReset().mockResolvedValue(undefined);
  });

  it("reports ready only when the database and object storage are available", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(databaseCheck).toHaveBeenCalledOnce();
    expect(storageCheck).toHaveBeenCalledOnce();
    expect(malwareCheck).toHaveBeenCalledOnce();
  });

  it("reports unavailable when the database check fails", async () => {
    databaseCheck.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });

  it("reports unavailable when the object storage check fails", async () => {
    storageCheck.mockRejectedValueOnce(new Error("storage unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });

  it("reports unavailable when the malware scanner check fails", async () => {
    malwareCheck.mockRejectedValueOnce(new Error("scanner unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});
