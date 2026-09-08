/**
 * บริการกลางสำหรับบันทึกและอ่านการตัดสินใจเรื่องนโยบาย
 * ทุกเหตุการณ์ถูกเพิ่มเป็นแถวใหม่เพื่อไม่ให้ประวัติเดิมถูกเขียนทับ
 */
import type { PolicyActionSource, Prisma } from "@/generated/prisma/client";
import type { AcceptRequiredPoliciesInput } from "@/lib/domain/legal-policies";
import { currentPolicyVersions, getMarketingPreference, hasCurrentRequiredPolicies } from "@/lib/legal/policies";
import { getDatabase } from "@/lib/server/db";

type PolicyDatabase = Prisma.TransactionClient | ReturnType<typeof getDatabase>;

const requiredPolicyWhere = {
  OR: [
    { policyType: "TERMS_OF_SERVICE" as const, documentVersion: currentPolicyVersions.terms, action: "ACCEPTED" as const },
    { policyType: "PRIVACY_NOTICE" as const, documentVersion: currentPolicyVersions.privacy, action: "ACKNOWLEDGED" as const },
  ],
};

/** คืนสถานะเอกสารบังคับและตัวเลือกการตลาดสำหรับแสดงในหน้าบัญชี */
export async function getPolicyPreferences(userId: string, database: PolicyDatabase = getDatabase()) {
  const actions = await database.policyAction.findMany({
    where: { userId },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    select: { policyType: true, action: true, documentVersion: true, occurredAt: true },
  });
  const terms = actions.find((item) => item.policyType === "TERMS_OF_SERVICE"
    && item.action === "ACCEPTED"
    && item.documentVersion === currentPolicyVersions.terms);
  const privacy = actions.find((item) => item.policyType === "PRIVACY_NOTICE"
    && item.action === "ACKNOWLEDGED"
    && item.documentVersion === currentPolicyVersions.privacy);
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

/** ใช้ในระบบยืนยันตัวตนเพื่อปิดกั้นบัญชีเดิมที่ยังไม่รับเอกสารเวอร์ชันปัจจุบัน */
export async function hasAcceptedRequiredPolicies(userId: string, database: PolicyDatabase = getDatabase()) {
  const actions = await database.policyAction.findMany({
    where: { userId, ...requiredPolicyWhere },
    select: { policyType: true, action: true, documentVersion: true },
  });
  return hasCurrentRequiredPolicies(actions);
}

/** บันทึกเอกสารบังคับและตัวเลือกการตลาดพร้อมกันภายใน transaction เดียว */
export async function recordRequiredPolicies(
  userId: string,
  input: AcceptRequiredPoliciesInput,
  source: PolicyActionSource,
  requestId?: string,
  database: PolicyDatabase = getDatabase(),
) {
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
  rows.push({
    userId,
    policyType: "MARKETING_COMMUNICATIONS",
    action: input.marketingConsent ? "GRANTED" : "WITHDRAWN",
    documentVersion: currentPolicyVersions.marketing,
    source,
    requestId,
  });
  await database.policyAction.createMany({ data: rows });
}

/** เพิ่มเหตุการณ์ให้หรือถอนความยินยอมด้านข่าวสารจากหน้าตั้งค่าบัญชี */
export async function recordMarketingPreference(userId: string, enabled: boolean, requestId?: string) {
  await getDatabase().policyAction.create({
    data: {
      userId,
      policyType: "MARKETING_COMMUNICATIONS",
      action: enabled ? "GRANTED" : "WITHDRAWN",
      documentVersion: currentPolicyVersions.marketing,
      source: "ACCOUNT_SETTINGS",
      requestId,
    },
  });
}
