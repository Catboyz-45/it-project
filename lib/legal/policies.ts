/**
 * ค่ากลางของเอกสารทางกฎหมาย เวอร์ชันต้องเปลี่ยนเมื่อเนื้อหาสำคัญหรือวัตถุประสงค์การใช้ข้อมูลเปลี่ยน
 * ทั้งหน้าเว็บและฝั่งเซิร์ฟเวอร์ใช้ไฟล์เดียวกัน จึงไม่เกิดปัญหาหน้าเว็บแสดงเวอร์ชันไม่ตรงกับฐานข้อมูล
 */
export const currentPolicyVersions = {
  terms: "2026-09-06",
  privacy: "2026-09-06",
  marketing: "2026-09-06",
} as const;

export const legalDocumentLinks = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  cookies: "/legal/cookies",
} as const;

export type PolicyActionSnapshot = {
  policyType: "TERMS_OF_SERVICE" | "PRIVACY_NOTICE" | "MARKETING_COMMUNICATIONS";
  action: "ACCEPTED" | "ACKNOWLEDGED" | "GRANTED" | "WITHDRAWN";
  documentVersion: string;
  occurredAt?: Date | string;
};

/** ตรวจว่าผู้ใช้ตกลงข้อกำหนดและรับทราบประกาศความเป็นส่วนตัวเวอร์ชันปัจจุบันครบแล้ว */
export function hasCurrentRequiredPolicies(actions: PolicyActionSnapshot[]) {
  const termsAccepted = actions.some((item) => item.policyType === "TERMS_OF_SERVICE"
    && item.action === "ACCEPTED"
    && item.documentVersion === currentPolicyVersions.terms);
  const privacyAcknowledged = actions.some((item) => item.policyType === "PRIVACY_NOTICE"
    && item.action === "ACKNOWLEDGED"
    && item.documentVersion === currentPolicyVersions.privacy);
  return termsAccepted && privacyAcknowledged;
}

/** อ่านสถานะการตลาดจากเหตุการณ์ล่าสุด โดยค่าเริ่มต้นเป็นไม่ยินยอม */
export function getMarketingPreference(actions: PolicyActionSnapshot[]) {
  const latest = [...actions]
    .filter((item) => item.policyType === "MARKETING_COMMUNICATIONS")
    .sort((left, right) => new Date(right.occurredAt ?? 0).getTime() - new Date(left.occurredAt ?? 0).getTime())[0];
  return latest?.action === "GRANTED";
}
