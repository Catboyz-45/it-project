import type { PolicyActionSource, Prisma } from "@/generated/prisma/client";
import type { AcceptRequiredPoliciesInput } from "@/lib/domain/legal-policies";
import { currentPolicyVersions, getMarketingPreference, hasCurrentRequiredPolicies } from "@/lib/legal/policies";
import { getDatabase } from "@/lib/server/db";

// รับได้ทั้งตัวเชื่อมปกติและตัวที่อยู่ใน transaction ฟังก์ชันพวกนี้จึงเรียกจากทั้งสองที่ได้
type PolicyDatabase = Prisma.TransactionClient | ReturnType<typeof getDatabase>;

// เงื่อนไขค้นหาที่ใช้ซ้ำหลายที่ แยกออกมาไว้ที่เดียวจะได้ไม่ลืมแก้ตอนเปลี่ยนเวอร์ชัน
const requiredPolicyWhere = {
  OR: [
    { policyType: "TERMS_OF_SERVICE" as const, documentVersion: currentPolicyVersions.terms, action: "ACCEPTED" as const },
    { policyType: "PRIVACY_NOTICE" as const, documentVersion: currentPolicyVersions.privacy, action: "ACKNOWLEDGED" as const },
  ],
};

// อ่านสถานะทั้งหมดไปแสดงในหน้าบัญชี ว่ายอมรับอะไรไปแล้วเมื่อไหร่
export async function getPolicyPreferences(userId: string, database: PolicyDatabase = getDatabase()) {
  const actions = await database.policyAction.findMany({
    where: { userId },
    // เรียงใหม่สุดก่อน แล้วใช้ id ตัดสินอีกชั้นเผื่อสองแถวเกิดวินาทีเดียวกัน ลำดับจะได้คงที่
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    select: { policyType: true, action: true, documentVersion: true, occurredAt: true },
  });
  const terms = actions.find((item) => item.policyType === "TERMS_OF_SERVICE"
    && item.action === "ACCEPTED"
    && item.documentVersion === currentPolicyVersions.terms);
  const privacy = actions.find((item) => item.policyType === "PRIVACY_NOTICE"
    && item.action === "ACKNOWLEDGED"
    && item.documentVersion === currentPolicyVersions.privacy);
  // เรียงมาแล้วจากใหม่ไปเก่า find จึงได้เหตุการณ์ล่าสุดของการตลาดทันที
  const latestMarketing = actions.find((item) => item.policyType === "MARKETING_COMMUNICATIONS");
  return {
    requiredComplete: hasCurrentRequiredPolicies(actions),
    terms: { version: currentPolicyVersions.terms, acceptedAt: terms?.occurredAt ?? null },
    privacy: { version: currentPolicyVersions.privacy, acknowledgedAt: privacy?.occurredAt ?? null },
    marketing: {
      version: currentPolicyVersions.marketing,
      enabled: getMarketingPreference(actions),
      updatedAt: latestMarketing?.occurredAt ?? null,
    },
  };
}

// เช็คแบบเบา ใช้ตอนกั้นทางเข้า ดึงเฉพาะแถวที่ตรงเวอร์ชันปัจจุบันพอ ไม่ต้องอ่านประวัติทั้งหมด
export async function hasAcceptedRequiredPolicies(userId: string, database: PolicyDatabase = getDatabase()) {
  const actions = await database.policyAction.findMany({
    where: { userId, ...requiredPolicyWhere },
    select: { policyType: true, action: true, documentVersion: true },
  });
  return hasCurrentRequiredPolicies(actions);
}

// บันทึกการกดยอมรับ เขียนทุกอย่างในคำสั่งเดียวกัน จะได้ไม่มีกรณีบันทึกไปครึ่งเดียว
export async function recordRequiredPolicies(
  userId: string,
  input: AcceptRequiredPoliciesInput,
  source: PolicyActionSource,
  requestId?: string,
  database: PolicyDatabase = getDatabase(),
) {
  // ดูก่อนว่าฉบับไหนเคยกดไปแล้ว กดซ้ำจะได้ไม่เพิ่มแถวซ้ำโดยไม่จำเป็น
  const existing = await database.policyAction.findMany({
    where: { userId, ...requiredPolicyWhere },
    select: { policyType: true, action: true, documentVersion: true },
  });
  const rows: Prisma.PolicyActionCreateManyInput[] = [];
  if (!existing.some((item) => item.policyType === "TERMS_OF_SERVICE")) {
    rows.push({ userId, policyType: "TERMS_OF_SERVICE", action: "ACCEPTED", documentVersion: currentPolicyVersions.terms, source, requestId });
  }
  if (!existing.some((item) => item.policyType === "PRIVACY_NOTICE")) {
    rows.push({ userId, policyType: "PRIVACY_NOTICE", action: "ACKNOWLEDGED", documentVersion: currentPolicyVersions.privacy, source, requestId });
  }
  // ส่วนการตลาดเพิ่มแถวใหม่ทุกครั้ง เพราะต้องเก็บไว้ว่าเปลี่ยนใจตอนไหนบ้าง
  rows.push({
    userId,
    policyType: "MARKETING_COMMUNICATIONS",
    action: input.marketingConsent ? "GRANTED" : "WITHDRAWN",
    documentVersion: currentPolicyVersions.marketing,
    source,
    requestId,
  });
  // เขียนทีเดียวทุกแถว เร็วกว่าเรียก create ทีละใบ
  await database.policyAction.createMany({ data: rows });
}

// เปลี่ยนความยินยอมรับข่าวสารจากหน้าตั้งค่า เพิ่มแถวใหม่เสมอ ไม่แก้ทับของเดิม
export async function recordMarketingPreference(userId: string, enabled: boolean, requestId?: string) {
  await getDatabase().policyAction.create({
    data: {
      userId,
      policyType: "MARKETING_COMMUNICATIONS",
      action: enabled ? "GRANTED" : "WITHDRAWN",
      documentVersion: currentPolicyVersions.marketing,
      // ติดที่มาไว้ด้วย จะได้แยกออกว่ากดจากหน้าตั้งค่าหรือจากด่านตอนเข้าระบบครั้งแรก
      source: "ACCOUNT_SETTINGS",
      requestId,
    },
  });
}
