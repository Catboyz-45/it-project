import { describe, expect, it } from "vitest";
import { alertTone, isSubscriptionLapsed, ownerUrgentPages } from "@/lib/domain/alert-urgency";

describe("alert urgency", () => {
  const now = new Date("2026-11-02T10:00:00+07:00");

  it("treats a missing or expired package as urgent but not one that is only expiring soon", () => {
    expect(isSubscriptionLapsed(null, now)).toBe(true);
    expect(isSubscriptionLapsed("2026-11-01T00:00:00+07:00", now)).toBe(true);
    expect(isSubscriptionLapsed("2026-11-20T00:00:00+07:00", now)).toBe(false);
  });

  it("marks only pages with overdue work as urgent", () => {
    expect(ownerUrgentPages({ overdueInvoices: 0, subscriptionExpiresAt: "2027-01-01", now })).toEqual({
      invoices: false, overview: false, subscription: false,
    });
    expect(ownerUrgentPages({ overdueInvoices: 2, subscriptionExpiresAt: "2027-01-01", now })).toEqual({
      invoices: true, overview: true, subscription: false,
    });
    expect(ownerUrgentPages({ overdueInvoices: 0, subscriptionExpiresAt: null, now })).toEqual({
      invoices: false, overview: true, subscription: true,
    });
  });

  it("maps urgency to a badge tone", () => {
    expect(alertTone(true)).toBe("urgent");
    expect(alertTone(false)).toBe("pending");
    expect(alertTone(undefined)).toBe("pending");
  });
});
