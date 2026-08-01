import Link from "next/link";
import { Clock3, LogIn } from "lucide-react";

export default function SessionExpiredPage() { return <main className="session-card"><div className="card card-body"><span className="icon-box" style={{ marginInline: "auto" }}><Clock3 size={22} /></span><p className="eyebrow" style={{ marginTop: 24 }}>SESSION EXPIRED</p><h1 className="heading">เซสชันหมดอายุแล้ว</h1><p className="lead">เพื่อความปลอดภัย ระบบออกจากบัญชีของคุณหลังไม่มีการใช้งาน กรุณาเข้าสู่ระบบใหม่ งานที่บันทึกแล้วจะไม่สูญหาย</p><Link className="btn btn-dark" href="/login"><LogIn size={17} /> เข้าสู่ระบบอีกครั้ง</Link></div></main>; }
