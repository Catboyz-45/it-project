// โครงหน้าที่ใช้ร่วมกันทุกหน้าก่อนเข้าสู่ระบบ ซ้ายเป็นภาพแนะนำ ขวาเป็นฟอร์ม
import type { ReactNode } from "react";
import { Check, ShieldCheck, Sparkles } from "lucide-react";
import { GradientWaves } from "@/components/ui/GradientWaves";
import { PlatformBrand } from "@/components/ui/PlatformBrand";

// footer ไว้ใส่ลิงก์ท้ายฟอร์ม เช่น "ยังไม่มีบัญชี?" ที่แต่ละหน้าต่างกัน
type AuthPageLayoutProps = {
  children: ReactNode;
  description: string;
  footer?: ReactNode;
  title: string;
};

export function AuthPageLayout({ children, description, footer, title }: Readonly<AuthPageLayoutProps>) {
  return (
    <main className="login-page-shell">
      <section className="login-story" aria-labelledby="login-story-title">
        {/* ภาพประดับอย่างเดียว ค่าทั้งหมดปรับเพื่อความสวย ไม่มีผลกับข้อมูลหรือการทำงาน */}
        <GradientWaves
          amplitude={2.5}
          brightness={1.12}
          className="login-story-waves"
          crestColor="#f472b6"
          detail="medium"
          fogDepth={15}
          grain={false}
          height={5.5}
          horizonColor="#4f46e5"
          // ปิดการตอบสนองเมาส์ เพราะช่องกรอกอยู่ติดกัน ไม่อยากให้พื้นหลังขยับกวนสายตา
          mouseInteraction={false}
          opacity={0.78}
          speed={0.5}
          swell={35}
          turbulence={20}
          waveColor="#8b5cf6"
          waveScale={0.6}
          zoom={1}
        />
        <header><PlatformBrand className="login-story-brand" imageClassName="size-14" showTagline /></header>
        <div className="login-story-copy">
          <p className="login-story-eyebrow"><Sparkles size={16} /> พื้นที่เดียวสำหรับทุกงานของหอพัก</p>
          <h1 id="login-story-title">บริหารหอพัก<br /><span>ง่ายและเป็นระบบ</span></h1>
          <p className="login-story-description">ดูแลห้อง ผู้เช่า การเงิน และงานประจำวันได้ครบ โดยข้อมูลของแต่ละหอแยกจากกันอย่างชัดเจน</p>
          <ul className="login-feature-list">
            <li><Check size={16} /><span>ห้องและผู้เช่า</span></li>
            <li><Check size={16} /><span>บิลและมิเตอร์</span></li>
            <li><Check size={16} /><span>เอกสารและงานซ่อม</span></li>
          </ul>
        </div>
        <small className="login-story-note"><ShieldCheck size={16} /> เข้าถึงข้อมูลตามสิทธิ์ของแต่ละบัญชี</small>
      </section>
      <section className="login-form-panel" aria-labelledby="auth-form-title">
        <div className="login-form-container">
          <h2 id="auth-form-title">{title}</h2>
          <p className="login-form-description">{description}</p>
          {children}
          {footer ? <div className="login-register-link">{footer}</div> : null}
          <nav aria-label="เอกสารทางกฎหมาย" className="auth-legal-links"><a href="/legal/terms">ข้อกำหนด</a><a href="/legal/privacy">ความเป็นส่วนตัว</a><a href="/legal/cookies">คุกกี้</a></nav>
        </div>
      </section>
    </main>
  );
}
