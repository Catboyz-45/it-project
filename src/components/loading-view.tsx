/**
 * หน้าที่ของไฟล์นี้: หน้าหรือส่วนแสดงสถานะกำลังโหลด เพื่อให้ผู้ใช้ทราบว่าระบบยังทำงานอยู่
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
/** สร้างส่วนหน้าจอ LoadingView; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function LoadingView({ admin = false }: { admin?: boolean }) {
  return <div className={admin ? "admin-content" : "container section"} role="status" aria-live="polite" aria-label="กำลังโหลด"><div className="skeleton" style={{ width: "28%", minWidth: 180, height: 18 }} /><div className="skeleton" style={{ width: "55%", height: 44, marginTop: 16 }} /><div className="grid-3" style={{ marginTop: 34 }}>{Array.from({ length: 3 }, (_, index) => <div className="card" key={index}><div className="skeleton" style={{ height: 220, borderRadius: 0 }} /><div className="card-body"><div className="skeleton" style={{ width: "35%", height: 15 }} /><div className="skeleton" style={{ width: "78%", height: 24, marginTop: 16 }} /><div className="skeleton" style={{ width: "92%", height: 15, marginTop: 12 }} /></div></div>)}</div><span className="sr-only">กำลังโหลดข้อมูล กรุณารอสักครู่</span></div>;
}
