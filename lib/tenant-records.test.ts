import { describe, expect, it } from "vitest";
import {
  announcementAudienceLabel,
  calendarDaysBetween,
  isRecentAnnouncement,
  leaseTerm,
  parcelPickupSummary,
  parcelWaitBadge,
  relativeThaiTime,
  thaiMonthKey,
  ticketProgress,
} from "@/lib/tenant-records";

// 3 พ.ย. 2569 เวลา 10:00 น. ตามเวลาไทย
const now = new Date("2026-11-03T03:00:00.000Z");

describe("announcementAudienceLabel", () => {
  it("names who the announcement was sent to", () => {
    expect(announcementAudienceLabel({ audience: "ALL_TENANTS" })).toBe("ทั้งหอ");
    expect(announcementAudienceLabel({ audience: "BUILDING", buildingName: "อาคาร A" })).toBe("อาคาร A");
    expect(announcementAudienceLabel({ audience: "FLOOR", floorNumber: 3 })).toBe("ชั้น 3");
    expect(announcementAudienceLabel({ audience: "FLOOR", floorLabel: "ชั้นลอย", floorNumber: 2 })).toBe("ชั้นลอย");
    expect(announcementAudienceLabel({ audience: "ROOM" })).toBe("ห้องของคุณ");
  });
});

describe("announcement time", () => {
  it("marks announcements from the last seven days as new", () => {
    expect(isRecentAnnouncement("2026-11-01T03:00:00.000Z", now)).toBe(true);
    expect(isRecentAnnouncement("2026-10-20T03:00:00.000Z", now)).toBe(false);
  });

  it("says how long ago within a week and falls back to the date after that", () => {
    expect(relativeThaiTime("2026-11-03T02:59:40.000Z", now)).toBe("เมื่อสักครู่");
    expect(relativeThaiTime("2026-11-03T02:15:00.000Z", now)).toBe("45 นาทีที่แล้ว");
    expect(relativeThaiTime("2026-11-03T01:00:00.000Z", now)).toBe("2 ชั่วโมงที่แล้ว");
    expect(relativeThaiTime("2026-11-01T03:00:00.000Z", now)).toBe("2 วันที่แล้ว");
    expect(relativeThaiTime("2026-10-20T03:00:00.000Z", now)).toBeNull();
  });

  // ห้าทุ่มคืนที่ 31 ต.ค. เวลาไทย ยังเป็นเดือนตุลาคม แม้ UTC จะเป็นวันเดียวกัน
  it("groups by the Thai calendar month", () => {
    expect(thaiMonthKey("2026-10-31T16:00:00.000Z")).toBe("2026-10");
    expect(thaiMonthKey("2026-10-31T17:30:00.000Z")).toBe("2026-11");
  });
});

describe("parcels", () => {
  it("counts waiting days by the Thai calendar", () => {
    // รับเข้าห้าทุ่มเมื่อวาน ดูตอนสิบโมงวันนี้ นับเป็นหนึ่งวัน
    expect(calendarDaysBetween("2026-11-02T16:00:00.000Z", now)).toBe(1);
    expect(parcelWaitBadge("2026-11-03T01:00:00.000Z", now)).toEqual({ label: "มาถึงวันนี้", tone: "waiting" });
    expect(parcelWaitBadge("2026-10-31T03:00:00.000Z", now)).toEqual({ label: "รอ 3 วัน", tone: "waiting" });
    expect(parcelWaitBadge("2026-10-30T03:00:00.000Z", now)).toEqual({ label: "รอ 4 วัน", tone: "overdue" });
  });

  it("summarises how long a received parcel waited", () => {
    expect(parcelPickupSummary("2026-10-12T02:00:00.000Z", "2026-10-12T11:00:00.000Z")).toBe("รับในวันเดียวกัน");
    expect(parcelPickupSummary("2026-10-24T02:00:00.000Z", "2026-10-25T11:00:00.000Z")).toBe("รอที่หอ 1 วัน");
  });
});

describe("leaseTerm", () => {
  it("shows progress and months left for a long lease", () => {
    const term = leaseTerm("2026-06-01", "2027-05-31", now);
    expect(term.percent).toBe(43);
    expect(term.remainingLabel).toBe("เหลืออีกประมาณ 7 เดือน");
    expect(term.tone).toBe("normal");
    expect(term.months).toBe(12);
  });

  it("counts days when the lease ends within sixty days", () => {
    const term = leaseTerm("2026-01-01", "2026-12-15", now);
    expect(term.daysLeft).toBe(42);
    expect(term.remainingLabel).toBe("เหลืออีก 42 วัน");
    expect(term.tone).toBe("ending");
  });

  it("describes a lease that has not started yet", () => {
    const term = leaseTerm("2026-12-01", "2027-11-30", now);
    expect(term.percent).toBe(0);
    expect(term.remainingLabel).toBe("เริ่มในอีก 28 วัน");
  });
});

describe("ticketProgress", () => {
  const states = (status: string) => ticketProgress(status).steps.map(({ state }) => state);

  it("moves through reported, acknowledged and done", () => {
    expect(states("OPEN")).toEqual(["current", "todo", "todo"]);
    expect(states("ACKNOWLEDGED")).toEqual(["done", "current", "todo"]);
    expect(states("RESOLVED")).toEqual(["done", "done", "done"]);
  });

  it("uses the same words as the status badge", () => {
    expect(ticketProgress("IN_PROGRESS").steps.map(({ label }) => label)).toEqual(["รับเรื่องแล้ว", "กำลังตรวจสอบ", "เสร็จแล้ว"]);
  });

  it("flags cancelled tickets", () => {
    expect(ticketProgress("CANCELLED").cancelled).toBe(true);
  });
});
