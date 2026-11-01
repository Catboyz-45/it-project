import { ChevronsUpDown } from "lucide-react";
import { accountInitials } from "@/lib/account-initials";

// ปุ่มบัญชีท้ายแถบเมนูของทุกบทบาท แบบ Slack/Discord: วงกลมตัวย่อชื่อ ชื่อ และป้ายบทบาท
// เห็นทันทีว่ากำลังใช้งานในฐานะใคร ที่หอหรือห้องไหน ไม่ต้องกดเปิดเมนูก่อน

export type AccountRoleTone = "owner" | "tenant" | "admin";

export function AccountChip({ context, name, roleLabel, tone }: Readonly<{
  // ข้อความต่อท้ายป้ายบทบาท เช่นชื่อหอหรือเลขห้อง ไม่มีก็แสดงแค่ป้าย
  context?: string;
  name: string;
  roleLabel: string;
  tone: AccountRoleTone;
}>) {
  return <>
    <span aria-hidden="true" className={`account-avatar account-tone-${tone}`}>{accountInitials(name)}</span>
    {/* ตอนแถบเมนูถูกย่อ ส่วนนี้กลายเป็นป้ายลอยข้างวงกลม ตามกฎเดียวกับชื่อเมนูอื่น */}
    <span className="account-chip-text">
      <strong>{name}</strong>
      <small><span className={`account-role-tag account-tone-${tone}`}>{roleLabel}</span>{context ? <span className="account-chip-context">{context}</span> : null}</small>
    </span>
    <ChevronsUpDown aria-hidden="true" className="account-chip-chevron" size={16} />
  </>;
}
