/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React auth-shell ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { Logo } from "./logo";

/** สร้างส่วนหน้าจอ AuthShell; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function AuthShell({
  children,
  badge,
  title,
  description,
  compact = false,
}: {
  children: React.ReactNode;
  badge: React.ReactNode;
  title: React.ReactNode;
  description: string;
  compact?: boolean;
}) {
  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <Logo inverse />
        <div style={{ position: "relative", zIndex: 1 }}>
          <span className="hero-badge">{badge}</span>
          <h1 className="display">{title}</h1>
          <p className="lead" style={{ color: "rgba(255,255,255,.68)", maxWidth: 570 }}>{description}</p>
        </div>
        <p style={{ fontSize: ".78rem", color: "rgba(255,255,255,.58)" }}>© 2026 อยู่เย็นเป็นสุข วิศวกรรม จำกัด</p>
      </section>
      <section className="auth-form-wrap">
        <div className={`auth-card ${compact ? "auth-card-wide" : ""}`}>{children}</div>
      </section>
    </main>
  );
}
