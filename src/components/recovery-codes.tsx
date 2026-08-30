/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React recovery-codes ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { useState } from "react";
import { CheckCircle2, Download, Printer, ShieldCheck } from "lucide-react";

/** สร้างส่วนหน้าจอ RecoveryCodes; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function RecoveryCodes({ codes, onComplete }: { codes: string[]; onComplete: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  function download() { const blob = new Blob([`อยู่เย็นเป็นสุข วิศวกรรม — Recovery Codes\n\n${codes.join("\n")}\n\nแต่ละรหัสใช้ได้ครั้งเดียว`], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "yuyen-recovery-codes.txt"; anchor.click(); URL.revokeObjectURL(url); }
  return <div className="print-area"><div className="icon-box"><ShieldCheck size={22} /></div><p className="eyebrow" style={{ marginTop: 26 }}>FIRST SIGN-IN · STEP 3 OF 3</p><h2 className="heading">บันทึก Recovery Codes</h2><p className="muted">ใช้รหัสเหล่านี้เมื่อตอนที่ไม่สามารถเปิดแอป Authenticator ได้ แต่ละรหัสใช้ได้เพียงครั้งเดียว</p><div className="auth-alert warning"><div><strong>รหัสจะแสดงครั้งนี้เพียงครั้งเดียว</strong><p>เก็บไว้ในที่ปลอดภัยแยกจากอุปกรณ์ที่ใช้ Authenticator หากรีเฟรชหรือปิดหน้านี้ รหัสจะไม่แสดงอีก</p></div></div><div className="recovery-grid">{codes.map(code => <code className="recovery-code" key={code}>{code}</code>)}</div><div className="cluster no-print"><button type="button" className="btn btn-outline" onClick={download}><Download size={17} /> ดาวน์โหลด</button><button type="button" className="btn btn-outline" onClick={() => window.print()}><Printer size={17} /> พิมพ์</button></div><label className="check-row no-print" style={{ marginTop: 24 }}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>ฉันบันทึกรหัสเหล่านี้ไว้ในที่ปลอดภัยแล้ว</span></label><button type="button" onClick={onComplete} className="btn btn-dark no-print" disabled={!confirmed} style={{ width: "100%", marginTop: 18 }}><CheckCircle2 size={17} /> เสร็จสิ้นและเข้าสู่ระบบ</button></div>;
}
