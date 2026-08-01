"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Check, Copy, LoaderCircle, QrCode } from "lucide-react";

export function TwoFactorSetup() {
  const [data, setData] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [failed, setFailed] = useState(false); const [copied, setCopied] = useState(false);
  useEffect(() => { void fetch("/api/auth/2fa/setup", { cache: "no-store" }).then(async response => { if (!response.ok) throw new Error(); setData(await response.json() as { secret: string; qrDataUrl: string }); }).catch(() => setFailed(true)); }, []);
  function copy() { if (!data) return; void navigator.clipboard.writeText(data.secret); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
  return <><div className="icon-box"><QrCode size={22} /></div><p className="eyebrow" style={{ marginTop: 26 }}>FIRST SIGN-IN · STEP 2 OF 3</p><h2 className="heading">ตั้งค่า Authenticator</h2><p className="muted">เปิด Google Authenticator, Microsoft Authenticator หรือแอปที่รองรับ TOTP แล้วสแกน QR Code</p>{failed && <div className="auth-alert error" role="alert"><AlertCircle size={18} /><div><strong>ไม่สามารถสร้างข้อมูลตั้งค่าได้</strong><p>กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง</p></div></div>}{!data && !failed ? <div className="qr-box" role="status"><LoaderCircle className="spin" size={28} /><span className="sr-only">กำลังสร้าง QR Code</span></div> : data && <><div className="qr-box"><Image unoptimized src={data.qrDataUrl} alt="QR Code สำหรับตั้งค่า Authenticator" width={260} height={260} /></div><div style={{ marginTop: 20 }}><p className="muted" style={{ fontSize: ".76rem" }}>หากสแกนไม่ได้ ให้กรอกรหัสตั้งค่าด้วยตนเอง</p><div className="secret-key"><span>{data.secret}</span><button type="button" className="icon-btn" onClick={copy} aria-label="คัดลอกรหัสตั้งค่า">{copied ? <Check size={17} /> : <Copy size={17} />}</button></div></div><div className="auth-alert warning"><div><strong>อย่าบันทึก QR Code นี้เป็นภาพ</strong><p>รหัสแสดงเพื่อการตั้งค่าครั้งแรกและถูกเข้ารหัส AES-256-GCM เมื่อจัดเก็บ</p></div></div><Link className="btn btn-dark" style={{ width: "100%", marginTop: 22 }} href="/setup-2fa/verify">สแกนแล้ว ดำเนินการต่อ <ArrowRight size={17} /></Link></>}</>;
}
