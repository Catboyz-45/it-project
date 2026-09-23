// มุมมองพัสดุทั้งสองแบบ เป็นการอ่านอย่างเดียวจึง render บนเซิร์ฟเวอร์ได้ทั้งหมด
import Image from "next/image";
import { Empty, Panel, Status } from "@/components/tenant/primitives";
import { Package } from "lucide-react";

export type TenantParcel = {
  id: string; status: string; note: string | null; imageUrl: string | null;
  registeredAt: string | Date; receivedAt: string | Date | null;
};

export function ParcelCard(item: TenantParcel) {
  return <Panel key={item.id} title={item.status === "WAITING" ? "รอรับพัสดุ" : "รับแล้ว"}>
    <div className="flex gap-4">
      {item.imageUrl ? <Image alt="รูปพัสดุ" className="size-24 rounded-xl object-cover" height={96} src={item.imageUrl} unoptimized width={96} /> : null}
      <div>
        <p>{item.note || "ไม่มีหมายเหตุ"}</p>
        <time className="text-sm text-[#62646c]">รับเข้าระบบ {new Date(item.registeredAt).toLocaleString("th-TH")}</time>
        {item.receivedAt ? <time className="mt-1 block text-sm text-[#62646c]">รับพัสดุแล้ว {new Date(item.receivedAt).toLocaleString("th-TH")}</time> : null}
      </div>
    </div>
  </Panel>;
}

export function ParcelHistoryTable({ items, total }: { items: TenantParcel[]; total: number | null }) {
  if (!items.length) return <Empty description="เมื่อรับพัสดุแล้วประวัติจะมาแสดงที่นี่" icon={<Package />} text="ยังไม่มีประวัติการรับพัสดุ" />;
  return <section className="figma-table-card">
    <header className="additional-card-head">
      <div><h2>ประวัติการรับพัสดุ</h2><p>{total === null ? "กำลังนับรายการ..." : `ทั้งหมด ${total.toLocaleString("th-TH")} รายการ`}</p></div>
    </header>
    <div className="figma-table-wrap">
      <table>
        <thead><tr><th scope="col">พัสดุ</th><th scope="col">หมายเหตุ</th><th scope="col">วันที่รับเข้าระบบ</th><th scope="col">วันที่รับพัสดุ</th><th scope="col">สถานะ</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}>
          <td>{item.imageUrl ? <Image alt="รูปพัสดุ" className="size-14 rounded-xl object-cover" height={56} src={item.imageUrl} unoptimized width={56} /> : <span className="text-[#62646c]">ไม่มีรูป</span>}</td>
          <td>{item.note || "ไม่มีหมายเหตุ"}</td>
          <td>{new Date(item.registeredAt).toLocaleString("th-TH")}</td>
          <td>{item.receivedAt ? new Date(item.receivedAt).toLocaleString("th-TH") : "—"}</td>
          <td><Status value={item.status} /></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
