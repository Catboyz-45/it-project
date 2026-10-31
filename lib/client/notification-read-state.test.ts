import { describe, expect, it } from "vitest";
import {
  acknowledgeNotifications,
  isNotificationUnread,
  parseNotificationReadState,
  settleNotificationReadState,
} from "@/lib/client/notification-read-state";

describe("notification read state", () => {
  it("treats a topic as read until its count grows past what was acknowledged", () => {
    const state = acknowledgeNotifications({}, [{ id: "pending-payments", count: 3 }]);
    expect(isNotificationUnread(state, { id: "pending-payments", count: 3 })).toBe(false);
    expect(isNotificationUnread(state, { id: "pending-payments", count: 4 })).toBe(true);
    expect(isNotificationUnread(state, { id: "waiting-parcels", count: 1 })).toBe(true);
  });

  // บั๊กเดิม: จัดการงานไปบางส่วนแล้วกระดิ่งเด้งกลับมาว่ายังไม่อ่าน
  it("stays read when work is completed and the count drops", () => {
    const state = acknowledgeNotifications({}, [{ id: "pending-payments", count: 3 }]);
    const settled = settleNotificationReadState(state, [{ id: "pending-payments", count: 2 }]);
    expect(isNotificationUnread(settled, { id: "pending-payments", count: 2 })).toBe(false);
  });

  it("flags a new item that arrives after the count dropped", () => {
    const state = acknowledgeNotifications({}, [{ id: "pending-payments", count: 3 }]);
    const settled = settleNotificationReadState(state, [{ id: "pending-payments", count: 2 }]);
    expect(isNotificationUnread(settled, { id: "pending-payments", count: 3 })).toBe(true);
  });

  it("forgets topics that reach zero and keeps the same object when nothing changes", () => {
    const state = { "pending-payments": 2 };
    expect(settleNotificationReadState(state, [{ id: "pending-payments", count: 0 }])).toEqual({});
    expect(settleNotificationReadState(state, [{ id: "pending-payments", count: 2 }])).toBe(state);
  });

  it("never lowers an acknowledgement when marking read again", () => {
    expect(acknowledgeNotifications({ messages: 5 }, [{ id: "messages", count: 2 }])).toEqual({ messages: 5 });
  });

  // ผู้ใช้เดิมมีค่าเก็บไว้ในรูปแบบเก่า ต้องอ่านต่อได้ ไม่ใช่กลายเป็นยังไม่อ่านทั้งหมด
  it("reads the legacy fingerprint list and ignores corrupt storage", () => {
    expect(parseNotificationReadState(JSON.stringify(["pending-payments:3", "pending-payments:1", "chat:2", "broken"])))
      .toEqual({ "pending-payments": 3, chat: 2 });
    expect(parseNotificationReadState(JSON.stringify({ chat: 2, bad: -1, worse: "x" }))).toEqual({ chat: 2 });
    expect(parseNotificationReadState("{not json")).toEqual({});
    expect(parseNotificationReadState(null)).toEqual({});
  });
});
