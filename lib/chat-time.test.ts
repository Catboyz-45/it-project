import { describe, expect, it } from "vitest";
import { chatDayKey, chatDayLabel, chatListTime, chatRoomBadge } from "@/lib/chat-time";

// 10:00 ตามเวลาไทย วันที่ 3 พ.ย. 2026
const now = new Date("2026-11-03T03:00:00.000Z");

describe("chat time labels", () => {
  it("uses Thai time to decide the day", () => {
    // 23:30 UTC ของวันที่ 2 คือ 06:30 ของวันที่ 3 ในไทย
    expect(chatDayKey("2026-11-02T23:30:00.000Z")).toBe("2026-11-03");
  });

  it("labels today, yesterday and older days", () => {
    expect(chatDayLabel("2026-11-03T01:00:00.000Z", now)).toBe("วันนี้");
    expect(chatDayLabel("2026-11-02T01:00:00.000Z", now)).toBe("เมื่อวาน");
    expect(chatDayLabel("2026-10-20T01:00:00.000Z", now)).toContain("ต.ค.");
  });

  it("shows a time for today and a short date for older messages in the list", () => {
    expect(chatListTime("2026-11-03T02:42:00.000Z", now)).toBe("09:42");
    expect(chatListTime("2026-11-02T02:42:00.000Z", now)).toBe("เมื่อวาน");
    expect(chatListTime("2026-10-20T02:42:00.000Z", now)).toMatch(/20 ต\.ค\./);
  });
});

describe("chatRoomBadge", () => {
  it("keeps the number part so it fits in the avatar", () => {
    expect(chatRoomBadge("E101")).toBe("101");
    expect(chatRoomBadge("A-1204")).toBe("1204");
    expect(chatRoomBadge("305")).toBe("305");
    expect(chatRoomBadge("Studio")).toBe("Stu");
  });
});
