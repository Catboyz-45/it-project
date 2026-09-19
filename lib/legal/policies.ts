// เวอร์ชันเอกสารปัจจุบัน ต้องแก้เลขนี้ทุกครั้งที่เนื้อหาสำคัญเปลี่ยน
// เก็บไว้ที่เดียวทั้งหน้าเว็บและฝั่งเซิร์ฟเวอร์ เลขที่แสดงกับเลขที่บันทึกจึงตรงกันเสมอ
// ใช้วันที่เป็นเลขเวอร์ชัน เปิดฐานข้อมูลดูแล้วรู้ทันทีว่าคนนี้ยอมรับฉบับไหน
export const currentPolicyVersions = {
  terms: "2026-09-06",
  privacy: "2026-09-06",
  marketing: "2026-09-06",
} as const;

// ลิงก์ของเอกสารแต่ละฉบับ ย้ายหน้าทีหลังก็แก้ที่นี่ที่เดียว
export const legalDocumentLinks = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  cookies: "/legal/cookies",
} as const;

// เก็บเป็นเหตุการณ์ทีละครั้ง ไม่ใช่สถานะปัจจุบัน จึงย้อนดูได้ว่าใครยอมรับฉบับไหนเมื่อไหร่
export type PolicyActionSnapshot = {
  policyType: "TERMS_OF_SERVICE" | "PRIVACY_NOTICE" | "MARKETING_COMMUNICATIONS";
  action: "ACCEPTED" | "ACKNOWLEDGED" | "GRANTED" | "WITHDRAWN";
  documentVersion: string;
  occurredAt?: Date | string;
};

// เช็คว่ายอมรับครบทั้งสองฉบับในเวอร์ชันล่าสุดหรือยัง
// เทียบเวอร์ชันด้วย ไม่ใช่แค่ดูว่าเคยกดยอมรับ พอออกฉบับใหม่ระบบจะถามซ้ำเอง
export function hasCurrentRequiredPolicies(actions: PolicyActionSnapshot[]) {
  const termsAccepted = actions.some((item) => item.policyType === "TERMS_OF_SERVICE"
    && item.action === "ACCEPTED"
    && item.documentVersion === currentPolicyVersions.terms);
  const privacyAcknowledged = actions.some((item) => item.policyType === "PRIVACY_NOTICE"
    && item.action === "ACKNOWLEDGED"
    && item.documentVersion === currentPolicyVersions.privacy);
  return termsAccepted && privacyAcknowledged;
}

// ความยินยอมรับข่าวสารเปิดปิดกี่รอบก็ได้ จึงต้องดูเหตุการณ์ล่าสุดว่าคือกดเปิดหรือกดปิด
export function getMarketingPreference(actions: PolicyActionSnapshot[]) {
  // ก๊อปอาร์เรย์ก่อนเรียง เพราะ sort แก้ของเดิมตรง ๆ จะไปกระทบคนที่ส่งเข้ามา
  const latest = [...actions]
    .filter((item) => item.policyType === "MARKETING_COMMUNICATIONS")
    .sort((left, right) => new Date(right.occurredAt ?? 0).getTime() - new Date(left.occurredAt ?? 0).getTime())[0];
  // ไม่เคยกดอะไรเลยก็นับเป็นไม่ยินยอม ไม่ส่งข่าวสารจนกว่าจะกดเอง
  return latest?.action === "GRANTED";
}
