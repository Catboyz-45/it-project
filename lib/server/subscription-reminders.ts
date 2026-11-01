import { platformProfile } from "@/lib/platform-profile";
import { ownerPagePath } from "@/lib/navigation-routes";
import { getDatabase } from "@/lib/server/db";
import { appLink, isEmailConfigured, logEmailFailure, sendEmail } from "@/lib/server/email";

// เตือนล่วงหน้ากี่วันก่อนแพ็กเกจหมดอายุ ตามสเปกคือ 7 วัน
export const subscriptionReminderWindowDays = 7;
const millisecondsPerDay = 86_400_000;

// ส่งอีเมลเตือนเจ้าของหอที่แพ็กเกจจะหมดอายุภายใน 7 วัน งานเบื้องหลังเรียกทุกรอบ
// ส่งครั้งเดียวต่อหนึ่งวันหมดอายุ จำไว้ที่ expiryReminderSentFor ต่ออายุแล้ววันหมดอายุเปลี่ยน จึงเตือนรอบถัดไปได้อีก
// ทำนอก transaction ของงานหลัก เพราะการยิงไปบริการอีเมลช้าและล้มได้ ไม่ควรถือการล็อกฐานข้อมูลไว้ระหว่างนั้น
export async function sendSubscriptionExpiryReminders(runAt = new Date()) {
  // เครื่อง dev ที่ยังไม่ตั้งค่าอีเมลไม่ต้องทำอะไร และต้องไม่บันทึกว่าส่งแล้ว ตั้งค่าเมื่อไหร่จะได้ส่งจริง
  if (!isEmailConfigured() && process.env.NODE_ENV !== "production") return { expiryRemindersSent: 0 };
  const windowEnd = new Date(runAt.getTime() + subscriptionReminderWindowDays * millisecondsPerDay);
  const candidates = await getDatabase().propertySubscription.findMany({
    where: { status: { in: ["TRIAL", "ACTIVE"] }, expiresAt: { gt: runAt, lte: windowEnd } },
    select: {
      propertyId: true, planName: true, expiresAt: true, expiryReminderSentFor: true,
      property: {
        select: {
          name: true, isActive: true,
          memberships: {
            where: { user: { role: "PROPERTY_ADMIN", isActive: true, approvalStatus: "APPROVED" } },
            select: { user: { select: { email: true, displayName: true } } },
          },
        },
      },
    },
  });
  let expiryRemindersSent = 0;
  for (const subscription of candidates) {
    // Prisma เทียบสองคอลัมน์กันใน where ไม่ได้ จึงกรองตรงนี้ จำนวนแถวในช่วง 7 วันมีไม่มาก
    if (subscription.expiryReminderSentFor?.getTime() === subscription.expiresAt.getTime()) continue;
    if (!subscription.property.isActive || subscription.property.memberships.length === 0) continue;
    // จองก่อนส่ง ใส่เงื่อนไขค่าเดิมไว้ใน where ถ้างานสองรอบรันซ้อนกัน จะมีรอบเดียวที่แก้แถวนี้ได้และเป็นคนส่ง
    const claim = await getDatabase().propertySubscription.updateMany({
      where: {
        propertyId: subscription.propertyId,
        expiresAt: subscription.expiresAt,
        expiryReminderSentFor: subscription.expiryReminderSentFor,
      },
      data: { expiryReminderSentFor: subscription.expiresAt },
    });
    if (claim.count !== 1) continue;
    try {
      for (const { user } of subscription.property.memberships) {
        await sendEmail(expiryReminderEmail(user, subscription, runAt), "ไม่สามารถส่งอีเมลเตือนแพ็กเกจได้");
      }
      expiryRemindersSent += 1;
    } catch (error) {
      logEmailFailure("subscription_expiry_reminder_failed", subscription.propertyId, error);
      // ส่งไม่ผ่านก็คืนค่าเดิม รอบหน้าจะได้ลองส่งใหม่
      await getDatabase().propertySubscription.updateMany({
        where: { propertyId: subscription.propertyId, expiryReminderSentFor: subscription.expiresAt },
        data: { expiryReminderSentFor: subscription.expiryReminderSentFor },
      });
    }
  }
  return { expiryRemindersSent };
}

function expiryReminderEmail(
  user: { email: string; displayName: string },
  subscription: { propertyId: string; planName: string; expiresAt: Date; property: { name: string } },
  runAt: Date,
) {
  const daysLeft = Math.max(1, Math.ceil((subscription.expiresAt.getTime() - runAt.getTime()) / millisecondsPerDay));
  const expiresOn = subscription.expiresAt.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
  const renewLink = appLink(ownerPagePath(subscription.propertyId, "subscription"));
  return {
    to: user.email,
    subject: `แพ็กเกจของ ${subscription.property.name} จะหมดอายุในอีก ${daysLeft} วัน`,
    text: `สวัสดี ${user.displayName}\n\nแพ็กเกจ ${subscription.planName} ของ ${subscription.property.name} จะหมดอายุวันที่ ${expiresOn} (อีก ${daysLeft} วัน)\nหลังหมดอายุ ระบบจะเปลี่ยนเป็นโหมดอ่านอย่างเดียว ออกบิลใหม่หรือเพิ่มข้อมูลไม่ได้จนกว่าจะต่ออายุ\n\nต่ออายุได้ที่:\n${renewLink}\n\nหากต่ออายุแล้ว สามารถละเว้นอีเมลนี้ได้\n${platformProfile.name}`,
  };
}
