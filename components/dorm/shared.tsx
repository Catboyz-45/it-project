/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “shared” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import type { ReactNode } from "react";
import { Plus, QrCode } from "lucide-react";
import { currency, getStatusClass, statusText, totalInvoice } from "@/lib/dorm-utils";
import type { Invoice, Room, Tenant } from "@/types/dorm";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Metric” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { icon, label, value, detail, tone = "indigo" }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function Metric({ icon, label, value, detail, tone = "indigo" }: { icon: ReactNode; label: string; value: ReactNode; detail: string; tone?: "blue" | "green" | "indigo" | "orange" | "red" }) {
  return (
    <article className={`metric tone-${tone}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </div>
    </article>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Panel Title” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { title, action }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function PanelTitle({ title, action }: { title: string; action: string }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      <small>{action}</small>
    </div>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Room Grid” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { rooms, selectedRoomId, onSelectRoom }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function RoomGrid({ rooms, selectedRoomId, onSelectRoom }: { rooms: Room[]; selectedRoomId: string; onSelectRoom: (roomId: string) => void }) {
  return (
    <div className="room-grid">
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Room Detail Panel” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { onEditTenant, selectedRoom, selectedTenant }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function RoomDetailPanel({ onEditTenant, selectedRoom, selectedTenant }: { onEditTenant?: () => void; selectedRoom: Room; selectedTenant?: Tenant }) {
  return (
    <article className="panel">
      <PanelTitle title={`ห้อง ${selectedRoom.id}`} action={selectedTenant ? selectedTenant.name : "ยังว่าง"} />
      <dl className="detail-list">
        <div><dt>สถานะ</dt><dd><span className={getStatusClass(selectedRoom.status)}>{statusText[selectedRoom.status]}</span></dd></div>
        <div><dt>ประเภท</dt><dd>{selectedRoom.roomType === "air" ? "ห้องแอร์" : selectedRoom.roomType === "fan" ? "ห้องพัดลม" : selectedRoom.roomType}</dd></div>
        <div><dt>ค่าเช่า</dt><dd>{currency.format(selectedRoom.rent)}</dd></div>
        <div><dt>เบอร์โทร</dt><dd>{selectedTenant?.phone ?? "-"}</dd></div>
        <div><dt>สัญญาถึง</dt><dd>{selectedTenant?.contractEnd ?? "-"}</dd></div>
        <div><dt>เฟอร์นิเจอร์</dt><dd>{selectedRoom.furniture.length} รายการ</dd></div>
      </dl>
      {onEditTenant ? (
        <button className="primary-button" onClick={onEditTenant} type="button"><Plus size={17} /> เพิ่ม/แก้ไขผู้เช่า</button>
      ) : null}
    </article>
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Invoice List” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { invoices }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
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
          <strong>{currency.format(totalInvoice(invoice))}</strong>
        </div>
      ))}
    </div>
  );
}
