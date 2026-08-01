"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, Printer, ShieldCheck } from "lucide-react";

export function RecoveryCodes() {
  const [confirmed, setConfirmed] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  useEffect(() => { const timer = window.setTimeout(() => { const stored = sessionStorage.getItem("yuyen-recovery-codes"); if (!stored) return; try { setCodes(JSON.parse(stored) as string[]); } catch { setCodes([]); } }, 0); return () => window.clearTimeout(timer); }, []);
  function download() { const blob = new Blob([`อยู่เย็นเป็นสุข วิศวกรรม — Recovery Codes\n\n${codes.join("\n")}\n\nแต่ละรหัสใช้ได้ครั้งเดียว`], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "yuyen-recovery-codes.txt"; anchor.click(); URL.revokeObjectURL(url); }
  return <div className="print-area"><div className="icon-box"><ShieldCheck size={22} /></div><p className="eyebrow" style={{ marginTop: 26 }}>FIRST SIGN-IN · STEP 3 OF 3</p><h2 className="heading">บันทึก Recovery Codes</h2><p className="muted">ใช้รหัสเหล่านี้เมื่อตอนที่ไม่สามารถเปิดแอป Authenticator ได้ แต่ละรหัสใช้ได้เพียงครั้งเดียว</p><div className="auth-alert warning"><div><strong>รหัสจะแสดงครั้งนี้เพียงครั้งเดียว</strong><p>เก็บไว้ในที่ปลอดภัยแยกจากอุปกรณ์ที่ใช้ Authenticator</p></div></div>{codes.length ? <><div className="recovery-grid">{codes.map(code => <code className="recovery-code" key={code}>{code}</code>)}</div><div className="cluster no-print"><button className="btn btn-outline" onClick={download}><Download size={17} /> ดาวน์โหลด</button><button className="btn btn-outline" onClick={() => window.print()}><Printer size={17} /> พิมพ์</button></div><label className="check-row no-print" style={{ marginTop: 24 }}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>ฉันบันทึกรหัสเหล่านี้ไว้ในที่ปลอดภัยแล้ว</span></label><Link onClick={() => sessionStorage.removeItem("yuyen-recovery-codes")} className="btn btn-dark no-print" aria-disabled={!confirmed} style={{ width: "100%", marginTop: 18, pointerEvents: confirmed ? "auto" : "none", opacity: confirmed ? 1 : .5 }} href="/admin"><CheckCircle2 size={17} /> เสร็จสิ้นและเข้าสู่ระบบ</Link></> : <div className="auth-alert error" role="alert"><div><strong>ไม่พบ Recovery Codes</strong><p>รหัสอาจถูกแสดงไปแล้ว กรุณาเข้าสู่ระบบใหม่หรือติดต่อ Super Admin</p></div></div>}</div>;
}
