"use client";

import { ChevronsUpDown } from "lucide-react";
import { accountInitials } from "@/lib/account-initials";
import { useOwnAvatarUrl } from "@/lib/client/own-avatar";

// ปุ่มบัญชีท้ายแถบเมนูของทุกบทบาท แบบ Slack/Discord: วงกลมตัวย่อชื่อ ชื่อ และป้ายบทบาท
// เห็นทันทีว่ากำลังใช้งานในฐานะใคร ที่หอหรือห้องไหน ไม่ต้องกดเปิดเมนูก่อน

export type AccountRoleTone = "owner" | "tenant" | "admin";

export function AccountChip({ avatarUrl, context, name, roleLabel, tone }: Readonly<{
  avatarUrl?: string | null;
  // ข้อความต่อท้ายป้ายบทบาท เช่นชื่อหอหรือเลขห้อง ไม่มีก็แสดงแค่ป้าย
  context?: string;
  name: string;
  roleLabel: string;
  tone: AccountRoleTone;
}>) {
  const imageUrl = useOwnAvatarUrl(avatarUrl);
  return <>
    <span aria-hidden="true" className={`account-avatar account-tone-${tone}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- รูปส่วนตัวที่ต้องส่งคุกกี้ไปด้วย next/image ปรับขนาดผ่านเซิร์ฟเวอร์ให้ไม่ได้ */}
      {imageUrl ? <img alt="" src={imageUrl} /> : accountInitials(name)}
    </span>
    {/* ตอนแถบเมนูถูกย่อ ส่วนนี้กลายเป็นป้ายลอยข้างวงกลม ตามกฎเดียวกับชื่อเมนูอื่น */}
    <span className="account-chip-text">
      <strong>{name}</strong>
      <small><span className={`account-role-tag account-tone-${tone}`}>{roleLabel}</span>{context ? <span className="account-chip-context">{context}</span> : null}</small>
    </span>
    <ChevronsUpDown aria-hidden="true" className="account-chip-chevron" size={16} />
  </>;
}
