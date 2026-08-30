/**
 * หน้าที่ของไฟล์นี้: ชั้น repository security.repository เป็นจุดอ่านและเขียนฐานข้อมูลของโดเมนนี้ เพื่อไม่ให้ UI ติดต่อฐานข้อมูลโดยตรง
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { AuditResult, type AdminRole, type Prisma } from "@prisma/client";
import { db } from "@/server/db/client";

export class AdminRepository {
  findActiveByUsername(username: string) {
    return db.admin.findFirst({
      where: { usernameNormalized: username.trim().toLowerCase(), isActive: true, deletedAt: null },
    });
  }

  countActiveSuperAdmins() {
    return db.admin.count({ where: { role: "SUPER_ADMIN", isActive: true, deletedAt: null } });
  }

  create(data: { username: string; displayName: string; role: AdminRole; passwordHash: string }) {
    const usernameNormalized = data.username.trim().toLowerCase();
    return db.admin.create({ data: { ...data, username: data.username.trim(), usernameNormalized } });
  }
}

export class SessionRepository {
  create(data: Prisma.SessionUncheckedCreateInput) {
    return db.session.create({ data });
  }

  findValidByTokenHash(tokenHash: string, now = new Date()) {
    return db.session.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now }, admin: { isActive: true, deletedAt: null } },
      include: { admin: true },
    });
  }

  revokeAllForAdmin(adminId: string, reason: string) {
    return db.session.updateMany({ where: { adminId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason } });
  }
}

export class AuditRepository {
  record(input: {
    actorId?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    result: AuditResult;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Prisma.InputJsonValue;
    errorCode?: string;
  }) {
    return db.auditLog.create({ data: input });
  }
}
