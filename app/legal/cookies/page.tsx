import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { currentPolicyVersions } from "@/lib/legal/policies";

export const metadata: Metadata = { title: "นโยบายคุกกี้ | Nestly" };

/** ระบุคุกกี้ที่ระบบใช้จริง ปัจจุบันไม่มีการโหลดคุกกี้โฆษณาหรือวิเคราะห์จากบุคคลที่สาม */
export default function CookiesPage() {
  return <LegalDocumentPage title="นโยบายคุกกี้" version={currentPolicyVersions.privacy}>
    <section><h2>คุกกี้คืออะไร</h2><p>คุกกี้เป็นข้อมูลขนาดเล็กที่เบราว์เซอร์เก็บไว้เพื่อให้เว็บไซต์จดจำสถานะที่จำเป็นระหว่างการใช้งาน</p></section>
    <section><h2>คุกกี้ที่จำเป็น</h2><ul><li><strong>dorm_session</strong> ใช้ยืนยันว่าคุณเข้าสู่ระบบแล้ว มีอายุไม่เกิน 8 ชั่วโมง ตั้งค่า HttpOnly และ SameSite=Lax</li><li><strong>ตัวเลือกการเข้าพัก</strong> ใช้จดจำหอและห้องที่ผู้เช่าเลือก เพื่อแสดงข้อมูลในขอบเขตที่ถูกต้อง</li></ul><p>คุกกี้เหล่านี้จำเป็นต่อความปลอดภัยและการทำงานหลัก หากปิดกั้น ระบบบางส่วนจะใช้งานไม่ได้</p></section>
    <section><h2>คุกกี้วิเคราะห์และการตลาด</h2><p>ปัจจุบัน Nestly ไม่โหลดคุกกี้โฆษณาหรือคุกกี้วิเคราะห์จากบุคคลที่สาม หากเพิ่มในอนาคต ระบบจะไม่โหลดคุกกี้ที่ไม่จำเป็นจนกว่าคุณจะเลือก และจะมีหน้าสำหรับเปลี่ยนการตั้งค่า</p></section>
    <section><h2>การควบคุมคุกกี้</h2><p>คุณลบหรือปิดกั้นคุกกี้ได้จากการตั้งค่าเบราว์เซอร์ การออกจากระบบจะทำให้เซสชันฝั่งเซิร์ฟเวอร์ถูกเพิกถอนด้วย</p></section>
  </LegalDocumentPage>;
}
