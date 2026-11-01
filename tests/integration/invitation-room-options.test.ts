import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/lib/server/db";
import { createInvitation } from "@/lib/server/tenant-onboarding";
import { createWorkspaceFixture } from "./helpers";
import { callApi } from "./route-client";

// ช่องเลือกห้องในหน้าคำเชิญ ต้องบอกสถานะห้องตามข้อมูลจริง และเห็นได้เฉพาะห้องของหอตัวเอง

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;

beforeAll(async () => {
  w = await createWorkspaceFixture("ROOM_OPTIONS");
}, 60_000);

afterAll(async () => {
  if (!w) return;
  await w.cleanup();
  await getDatabase().$disconnect();
});

type RoomOptionResponse = {
  id: string;
  occupantCount: number;
  capacity: number;
  hasPrimaryTenant: boolean;
  primaryTenantName: string | null;
  pendingInvitationCount: number;
};

async function roomOption() {
  const response = await callApi("GET", `/api/v1/admin/properties/${w.property.id}/invitations/rooms`, { cookie: w.cookies.owner });
  expect(response.status).toBe(200);
  const option = (response.json.data as RoomOptionResponse[]).find((room) => room.id === w.room.id);
  expect(option).toBeDefined();
  return option!;
}

describe("invitation room options", () => {
  it("reports the main tenant and how many people are staying", async () => {
    expect(await roomOption()).toMatchObject({
      occupantCount: 1,
      capacity: 2,
      hasPrimaryTenant: true,
      primaryTenantName: "ROOM_OPTIONS Tenant",
      pendingInvitationCount: 0,
    });
  });

  it("counts only invitations that are still usable", async () => {
    const live = await createInvitation(w.property.id, w.owner.id, { roomId: w.room.id, intendedRole: "CO_OCCUPANT", expiresInDays: 3 });
    expect((await roomOption()).pendingInvitationCount).toBe(1);

    // หมดอายุแล้วแม้ในฐานข้อมูลยังเป็น PENDING ก็ไม่นับ
    await getDatabase().tenantInvitation.update({ where: { id: live.invitation.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    expect((await roomOption()).pendingInvitationCount).toBe(0);
  });

  it("is only available to the owner of the property", async () => {
    // หอของคนอื่นตอบเหมือนไม่มีหอนั้น ไม่บอกว่ามีอยู่จริง
    expect((await callApi("GET", `/api/v1/admin/properties/${w.otherProperty.id}/invitations/rooms`, { cookie: w.cookies.owner })).status).toBe(404);
    expect((await callApi("GET", `/api/v1/admin/properties/${w.property.id}/invitations/rooms`, { cookie: w.cookies.tenant })).status).toBe(403);
    expect((await callApi("GET", `/api/v1/admin/properties/${w.property.id}/invitations/rooms`)).status).toBe(401);
  });
});
