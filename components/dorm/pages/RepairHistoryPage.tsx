"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Repair History Page” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DropdownField } from "@/components/dorm/DropdownField";
import { repairStatusClass, repairStatusLabel, type OwnerRepairTicket } from "@/types/repairs";
import { ServerTablePagination, type ServerPageInfo } from "@/components/dorm/TablePagination";
import { createApiError, formatClientError } from "@/lib/client/api-error";
import { ownerPagePath } from "@/lib/navigation-routes";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Repair History Page Props” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type RepairHistoryPageProps = {
  propertyId: string;
  tickets: OwnerRepairTicket[];
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Repair History Page” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { propertyId, tickets: initialTickets }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function RepairHistoryPage({ propertyId, tickets: initialTickets }: RepairHistoryPageProps) {
  const [tickets, setTickets] = useState(initialTickets);
  const [pageInfo, setPageInfo] = useState<ServerPageInfo>({ page: 1, pageSize: 20, hasNextPage: false });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “load Tickets” แล้วส่งผลที่เหมาะสมกลับไป
   * รับค่า:
   * - targetPage: ค่า “target Page” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const loadTickets = useCallback(async (targetPage = 1) => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/v1/admin/properties/${propertyId}/tickets?type=REPAIR&status=RESOLVED&page=${targetPage}&pageSize=20`, { cache: "no-store" });
      const payload = await response.json() as {
        data?: Array<{
          id: string; title: string; detail: string; priority: string;
          updatedAt: string; resolvedAt: string | null; room: { number: string } | null;
        }>;
        error?: string;
        requestId?: string;
        pageInfo?: ServerPageInfo;
      };
      if (!response.ok || !payload.data || !payload.pageInfo) throw createApiError(payload, "โหลดประวัติการซ่อมไม่สำเร็จ");
      /**
       * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
       * หน้าที่: แปลงข้อมูลในขั้นตอน “mapped” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
       * รับค่า:
       * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
       * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
       */
      const mapped: OwnerRepairTicket[] = payload.data.map((item) => ({
        id: item.id,
        roomId: item.room?.number ?? "-",
        title: item.title,
        detail: item.detail,
        category: "ทั่วไป",
        priority: item.priority === "URGENT" ? "ด่วน" : "ปกติ",
        status: "done",
        completedAt: item.resolvedAt ? new Date(item.resolvedAt).toLocaleString("th-TH") : undefined,
        updatedAt: new Date(item.updatedAt).toLocaleString("th-TH"),
      }));
      setTickets(mapped);
      setPageInfo(payload.pageInfo);
    } catch (error) {
      setLoadError(formatClientError(error, "โหลดประวัติการซ่อมไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);
  useEffect(() => { void loadTickets(); }, [loadTickets]);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “completed Tickets” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const completedTickets = useMemo(() => tickets.filter((ticket) => ticket.status === "done"), [tickets]);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “floors” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const floors = useMemo(() => Array.from(new Set(completedTickets.map((ticket) => ticket.roomId.charAt(0)))).sort(), [completedTickets]);
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [query, setQuery] = useState("");

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “room Options” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const roomOptions = useMemo(() => {
    return Array.from(
      new Set(
        completedTickets
          .filter((ticket) => selectedFloor === "all" || ticket.roomId.startsWith(selectedFloor))
          .map((ticket) => ticket.roomId),
      ),
    ).sort((a, b) => a.localeCompare(b, "th"));
  }, [completedTickets, selectedFloor]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “filtered Tickets” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - ticket: ค่า “ticket” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const filteredTickets = completedTickets.filter((ticket) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");
    const matchesFloor = selectedFloor === "all" || ticket.roomId.startsWith(selectedFloor);
    const matchesRoom = selectedRoom === "all" || ticket.roomId === selectedRoom;
    const matchesQuery = !normalizedQuery || [
      ticket.roomId,
      ticket.title,
      ticket.detail,
      ticket.category,
      ticket.priority,
    ].some((value) => value.toLocaleLowerCase("th-TH").includes(normalizedQuery));
    return matchesFloor && matchesRoom && matchesQuery;
  });

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รับเหตุการณ์ “handle Floor Change” จากผู้ใช้หรือระบบ แล้วเรียกขั้นตอนที่เกี่ยวข้อง
   * รับค่า:
   * - floor: ค่า “floor” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const handleFloorChange = (floor: string) => {
    setSelectedFloor(floor);
    setSelectedRoom("all");
  };

  return (
    <section className="repair-page">
      {loadError ? <p className="form-alert error" role="alert">{loadError}</p> : null}
      <nav aria-label="เลือกมุมมองเรื่องร้องเรียน" className="repair-section-tabs">
        <Link href={ownerPagePath(propertyId, "complaints")}>ร้องเรียน</Link>
        <Link className="active" href={ownerPagePath(propertyId, "repairHistory")}>ประวัติที่เสร็จแล้ว</Link>
      </nav>
      <article className="repair-board">
        <div className="repair-board-head">
          <div>
            <h2>ประวัติการซ่อมที่เสร็จแล้ว</h2>
            <p>{filteredTickets.length} รายการ · ใช้กรองตามชั้นและห้องเพื่อดูประวัติเฉพาะจุด</p>
          </div>
          <span className="badge badge-paid">{completedTickets.length} งานเสร็จแล้ว</span>
        </div>
        <div className="history-page-toolbar">
          <label className="history-search-field">
            <Search aria-hidden="true" size={18} />
            <span className="sr-only">ค้นหาประวัติการซ่อม</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาห้อง งานซ่อม หรือรายละเอียด..."
              type="search"
              value={query}
            />
          </label>
          <div className="history-filter-grid">
            <DropdownField
              label="ชั้น"
              value={selectedFloor}
              onChange={handleFloorChange}
              options={[
                { value: "all", label: "ทุกชั้น" },
                ...floors.map((floor) => ({ value: floor, label: `ชั้น ${floor}` })),
              ]}
            />
            <DropdownField
              label="ห้อง"
              value={selectedRoom}
              onChange={setSelectedRoom}
              options={[
                { value: "all", label: "ทุกห้อง" },
                ...roomOptions.map((roomId) => ({ value: roomId, label: `ห้อง ${roomId}` })),
              ]}
            />
          </div>
        </div>

        <div className="repair-history-list repair-history-page-list">
          {filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => (
              <div className="repair-history-row" key={ticket.id}>
                <div className="repair-history-main">
                  <strong>ห้อง {ticket.roomId} · {ticket.title}</strong>
                  <span>{ticket.detail}</span>
                </div>
                <div className="repair-history-meta">
                  <span>{ticket.category}</span>
                  <span>{ticket.priority}</span>
                  {ticket.scheduledAt ? <span>นัด {ticket.scheduledAt}</span> : null}
                </div>
                <span className={repairStatusClass[ticket.status]}>{repairStatusLabel[ticket.status]}</span>
                <small>{ticket.completedAt ? `ปิดงาน ${ticket.completedAt}` : `อัปเดต ${ticket.updatedAt}`}</small>
              </div>
            ))
          ) : query.trim() || selectedFloor !== "all" || selectedRoom !== "all" ? (
            <SearchEmptyState description="ลองเปลี่ยนคำค้นหา ชั้น หรือห้องที่ต้องการดู" title="ไม่พบประวัติการซ่อม" />
          ) : (
            <div className="empty-state"><strong>ยังไม่มีประวัติการซ่อม</strong></div>
          )}
        </div>
        <ServerTablePagination currentItemCount={tickets.length} disabled={isLoading} onPageChange={(nextPage) => void loadTickets(nextPage)} pageInfo={pageInfo} />
      </article>
    </section>
  );
}
