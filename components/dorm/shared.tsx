
// ชิ้นส่วนเล็ก ๆ ที่หลายหน้าในฝั่งเจ้าของหอใช้ร่วมกัน แยกไว้กันเขียนซ้ำ
import type { ReactNode } from "react";
import { Plus, QrCode } from "lucide-react";
import { currency, getStatusClass, statusText, totalInvoice } from "@/lib/dorm-utils";
import type { Invoice, Room, Tenant } from "@/types/dorm";

// การ์ดตัวเลขสรุปบนหน้าภาพรวม tone คุมแค่สี ไม่มีผลกับข้อมูล
export function Metric({ icon, label, value, detail, tone = "indigo" }: { icon: ReactNode; label: string; value: ReactNode; detail: string; tone?: "blue" | "green" | "indigo" | "orange" | "red" }) {
  return (
    /* ข้อความก่อน ไอคอนทีหลัง ให้อ่านเรียงเหมือนการ์ดตัวเลขของอีกสองโรล */
    <article className={`metric tone-${tone}`}>
      <div className="min-w-0">
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </div>
      <span>{icon}</span>
    </article>
  );
}

// หัวเรื่องของแผง พร้อมข้อความประกอบด้านขวา ใช้ให้หัวข้อทุกแผงหน้าตาเหมือนกัน
export function PanelTitle({ title, action }: { title: string; action: string }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      <small>{action}</small>
    </div>
  );
}

// ผังห้องแบบตาราง กดเลือกห้องแล้วรายละเอียดข้าง ๆ จะเปลี่ยนตาม
export function RoomGrid({ rooms, selectedRoomId, onSelectRoom }: { rooms: Room[]; selectedRoomId: string; onSelectRoom: (roomId: string) => void }) {
  return (
    <div className="room-grid">
      {/* ใช้ button ไม่ใช่ div เพราะกดได้ คีย์บอร์ดกับโปรแกรมอ่านหน้าจอจะได้ใช้งานได้ */}
      {rooms.map((room) => (
        <button className={`room-card ${selectedRoomId === room.id ? "selected" : ""}`} key={room.id} onClick={() => onSelectRoom(room.id)} type="button">
          <span className="room-number">{room.id}</span>
          <span className={getStatusClass(room.status)}>{statusText[room.status]}</span>
          <small>{currency.format(room.rent)}/เดือน</small>
        </button>
      ))}
    </div>
  );
}

// รายละเอียดห้องที่เลือกอยู่ ไม่มีผู้เช่าก็แสดงว่าว่าง
export function RoomDetailPanel({ onEditTenant, selectedRoom, selectedTenant }: { onEditTenant?: () => void; selectedRoom: Room; selectedTenant?: Tenant }) {
  return (
    <article className="panel">
      <PanelTitle title={`ห้อง ${selectedRoom.id}`} action={selectedTenant ? selectedTenant.name : "ยังว่าง"} />
      {/* dl/dt/dd เพราะเป็นคู่ชื่อกับค่า โปรแกรมอ่านหน้าจอจะอ่านจับคู่ให้ถูก */}
      <dl className="detail-list">
        <div><dt>สถานะ</dt><dd><span className={getStatusClass(selectedRoom.status)}>{statusText[selectedRoom.status]}</span></dd></div>
        <div><dt>ประเภท</dt><dd>{selectedRoom.roomType === "air" ? "ห้องแอร์" : selectedRoom.roomType === "fan" ? "ห้องพัดลม" : selectedRoom.roomType}</dd></div>
        <div><dt>ค่าเช่า</dt><dd>{currency.format(selectedRoom.rent)}</dd></div>
        <div><dt>เบอร์โทร</dt><dd>{selectedTenant?.phone ?? "-"}</dd></div>
        <div><dt>สัญญาถึง</dt><dd>{selectedTenant?.contractEnd ?? "-"}</dd></div>
        <div><dt>เฟอร์นิเจอร์</dt><dd>{selectedRoom.furniture.length} รายการ</dd></div>
      </dl>
      {/* ซ่อนปุ่มแก้ไขเมื่อไม่ได้ส่ง handler มา เช่นบทบาทที่ดูได้อย่างเดียว */}
      {onEditTenant ? (
        <button className="primary-button" onClick={onEditTenant} type="button"><Plus size={17} /> เพิ่ม/แก้ไขผู้เช่า</button>
      ) : null}
    </article>
  );
}

// รายการบิลแบบย่อ ใช้บนหน้าภาพรวม ส่วนหน้าบิลเต็มใช้ตารางแยกต่างหาก
export function InvoiceList({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="invoice-list">
      {invoices.map((invoice) => (
        <div className="invoice-row" key={invoice.id}>
          <div className="qr-box"><QrCode size={28} /></div>
          <div>
            <strong>{invoice.id}</strong>
            <small>ห้อง {invoice.roomId} · {invoice.tenantName} · {invoice.month}</small>
          </div>
          <span className={getStatusClass(invoice.status)}>{statusText[invoice.status]}</span>
          {/* totalInvoice รวมค่าเช่ากับค่าน้ำค่าไฟให้แล้ว อย่าบวกเองซ้ำตรงนี้ */}
          <strong>{currency.format(totalInvoice(invoice))}</strong>
        </div>
      ))}
    </div>
  );
}
