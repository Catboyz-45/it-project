import { describe, expect, it } from "vitest";
import { ownerHelpTopics } from "@/lib/help/owner-guide";
import { tenantFaqCategories, tenantFaqs } from "@/lib/help/tenant-faq";

// คู่มือเป็นข้อมูลที่คนแก้ด้วยมือ ตรวจโครงไว้กันลิงก์เสียหรือบทความว่าง
describe("owner help guide", () => {
  const articles = ownerHelpTopics.flatMap((topic) => topic.articles);

  it("has unique topic and article ids with real steps", () => {
    expect(new Set(ownerHelpTopics.map(({ id }) => id)).size).toBe(ownerHelpTopics.length);
    expect(new Set(articles.map(({ id }) => id)).size).toBe(articles.length);
    for (const article of articles) expect(article.steps.length, article.title).toBeGreaterThanOrEqual(2);
  });

  // ปุ่มที่พาไปหมวดย่อยของหน้าตั้งค่าต้องเป็นหมวดที่มีอยู่จริง ไม่งั้นจะเปิดไปหน้าแรกของตั้งค่าเฉย ๆ
  it("only links to settings sections that exist", () => {
    const settingsSections = ["general", "billing", "cycles", "rooms", "assets", "documents", "invitations", "subscription", "account"];
    for (const { action } of articles) {
      if (action?.page !== "settings" || !action.query) continue;
      expect(settingsSections).toContain(new URLSearchParams(action.query).get("section"));
    }
  });

  it("explains how to set up the payment channels tenants rely on", () => {
    const promptPay = articles.find(({ id }) => id === "promptpay");
    expect(promptPay?.action).toEqual({ label: "ไปตั้งค่าช่องทางรับเงิน", page: "settings", query: "section=cycles" });
  });
});

describe("tenant FAQ", () => {
  it("has unique ids and every category has questions", () => {
    expect(new Set(tenantFaqs.map(({ id }) => id)).size).toBe(tenantFaqs.length);
    for (const category of tenantFaqCategories) {
      expect(tenantFaqs.some((faq) => faq.category === category.id), category.label).toBe(true);
    }
  });

  // หน้าบิลลิงก์มาที่ข้อนี้ตรง ๆ เปลี่ยน id แล้วลิงก์จะเปิดไม่เจอข้อ
  it("keeps the questions other pages link to", () => {
    expect(tenantFaqs.map(({ id }) => id)).toEqual(expect.arrayContaining(["slip-review", "no-qr"]));
  });
});
