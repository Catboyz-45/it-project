import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import { attachSignedLease, createLease, transitionLease } from "@/lib/server/leases";
import { getTenantLease } from "@/lib/server/tenant-portal";
import { createWorkspaceFixture } from "./helpers";

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;

beforeAll(async () => {
  w = await createWorkspaceFixture("TENANT_LEASE");
});

afterAll(async () => {
  await w.cleanup();
  await getDatabase().$disconnect();
});

// ผู้เช่าที่นัดเข้าอยู่ล่วงหน้า หอเซ็นและเปิดใช้สัญญาแล้วแต่ยังไม่ถึงวันเริ่ม ต้องเห็นสัญญาเป็นรอบถัดไป ไม่ใช่หน้าว่าง
describe("tenant lease", () => {
  it("shows an activated lease that starts later as the upcoming lease", async () => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + 14);
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    const lease = await createLease(w.property.id, w.owner.id, {
      roomId: w.room.id, startDate: start, endDate: end, monthlyRent: 3500, depositAmount: 7000,
    });
    await attachSignedLease(w.property.id, lease.id, `integration/${w.suffix}/future-lease.pdf`);
    await transitionLease(w.property.id, lease.id, { expectedVersion: 1, status: "ACTIVE" });

    const tenantLeases = await getTenantLease(w.tenantProfileId, w.room.id, "PRIMARY");
    expect(tenantLeases.current).toBeNull();
    expect(tenantLeases.upcoming).toMatchObject({ id: lease.id, status: "ACTIVE", hasSignedDocument: true });
  });
});
