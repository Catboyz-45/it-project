import { describe, expect, it } from "vitest";
import { type MaintenanceJobResult, maintenanceJobChangedData } from "@/lib/server/maintenance-job";

// ผลของรอบที่ไม่มีอะไรเกิดขึ้น ค่อยเปลี่ยนทีละช่องในแต่ละเคส
const quiet: MaintenanceJobResult = {
  status: "completed", runAt: "2026-11-01T00:00:00.000Z",
  overdueInvoices: 0, publishedAnnouncements: 0, expiredSubscriptions: 0, expiredSubscriptionOrders: 0, expiryRemindersSent: 0,
  paymentSlipsPurged: 0, generatedDocumentsPurged: 0, signedDocumentsPurged: 0, chatAttachmentsPurged: 0, failedFiles: 0,
};

describe("maintenance job audit filter", () => {
  // งานรันทุก 5 นาที รอบเงียบ ๆ ไม่ควรลงบันทึกการใช้งาน ไม่งั้นท่วมวันละ 288 แถว
  it("skips quiet runs and runs that were already in progress", () => {
    expect(maintenanceJobChangedData(quiet)).toBe(false);
    expect(maintenanceJobChangedData({ ...quiet, status: "already_running", overdueInvoices: 3 })).toBe(false);
  });

  it("records runs that changed data or failed to delete files", () => {
    expect(maintenanceJobChangedData({ ...quiet, overdueInvoices: 2 })).toBe(true);
    expect(maintenanceJobChangedData({ ...quiet, expiryRemindersSent: 1 })).toBe(true);
    expect(maintenanceJobChangedData({ ...quiet, failedFiles: 1 })).toBe(true);
  });
});
