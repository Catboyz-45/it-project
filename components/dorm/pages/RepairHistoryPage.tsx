"use client";
// เก็บตัวกรองและโหลดข้อมูลทีละหน้าจากเบราว์เซอร์

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DropdownField } from "@/components/dorm/DropdownField";
import { repairStatusClass, repairStatusLabel, type OwnerRepairTicket } from "@/types/repairs";
import { ServerTablePagination, type ServerPageInfo } from "@/components/dorm/TablePagination";
import { createApiError, formatClientError } from "@/lib/client/api-error";
import { ownerPagePath } from "@/lib/navigation-routes";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";

// tickets ที่ส่งมาคือชุดแรกที่เซิร์ฟเวอร์เตรียมไว้ หน้าถัดไปโหลดเองจากเบราว์เซอร์
type RepairHistoryPageProps = {
  propertyId: string;
  tickets: OwnerRepairTicket[];
};

// หน้าประวัติงานซ่อมที่ปิดเรื่องแล้ว แยกจากหน้าเรื่องร้องเรียนที่ยังทำอยู่
export function RepairHistoryPage({ propertyId, tickets: initialTickets }: RepairHistoryPageProps) {
  const [tickets, setTickets] = useState(initialTickets);
  const [pageInfo, setPageInfo] = useState<ServerPageInfo>({ page: 1, pageSize: 20, hasNextPage: false });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const loadTickets = useCallback(async (targetPage = 1) => {
    setIsLoading(true);
    setLoadError("");
    try {
      // ให้เซิร์ฟเวอร์กรองเฉพาะงานซ่อมที่ปิดแล้ว ประวัติสะสมเยอะเกินจะโหลดมาทั้งหมด
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
      // เช็คทั้งสถานะและตัวข้อมูล เพราะตอบ 200 แต่ข้อมูลไม่ครบก็แสดงผลต่อไม่ได้
      if (!response.ok || !payload.data || !payload.pageInfo) throw createApiError(payload, "โหลดประวัติการซ่อมไม่สำเร็จ");
      // แปลงจากรูปแบบของ API เป็นรูปแบบที่หน้าจอใช้ จัดวันเวลาให้เป็นแบบไทยตั้งแต่ตรงนี้
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
  // โหลดใหม่ตั้งแต่เปิดหน้า เพื่อให้ได้ pageInfo มาใช้กับแถบแบ่งหน้า
  useEffect(() => { void loadTickets(); }, [loadTickets]);
  // กรองซ้ำอีกชั้น เผื่อข้อมูลชุดแรกจากเซิร์ฟเวอร์มีงานที่ยังไม่ปิดปนมา
  const completedTickets = useMemo(() => tickets.filter((ticket) => ticket.status === "done"), [tickets]);
  // ตัวแรกของเลขห้องคือชั้น เช่นห้อง 301 อยู่ชั้น 3 Set ตัดชั้นที่ซ้ำกันออก
  const floors = useMemo(() => Array.from(new Set(completedTickets.map((ticket) => ticket.roomId.charAt(0)))).sort(), [completedTickets]);
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [query, setQuery] = useState("");

  // รายการห้องขึ้นกับชั้นที่เลือกอยู่ เลือกชั้น 3 ก็เห็นเฉพาะห้องชั้น 3
  const roomOptions = useMemo(() => {
    return Array.from(
      new Set(
        completedTickets
          .filter((ticket) => selectedFloor === "all" || ticket.roomId.startsWith(selectedFloor))
          .map((ticket) => ticket.roomId),
      ),
    // localeCompare แบบไทย เพราะเลขห้องบางที่มีตัวอักษรไทยปนอยู่
    ).sort((a, b) => a.localeCompare(b, "th"));
  }, [completedTickets, selectedFloor]);

  // กรองสามอย่างพร้อมกัน ชั้น ห้อง และคำค้น ทำในเครื่องกับข้อมูลของหน้าที่โหลดมาแล้ว
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

  const handleFloorChange = (floor: string) => {
    setSelectedFloor(floor);
    // รีเซ็ตห้องด้วย ไม่งั้นจะค้างห้องของชั้นเดิมแล้วผลลัพธ์ว่างเปล่าโดยไม่รู้สาเหตุ
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
          // ว่างเพราะกรองจนไม่เหลือ กับว่างเพราะยังไม่มีประวัติเลย ต้องบอกคนละแบบ
          ) : query.trim() || selectedFloor !== "all" || selectedRoom !== "all" ? (
            <SearchEmptyState description="ลองเปลี่ยนคำค้นหา ชั้น หรือห้องที่ต้องการดู" title="ไม่พบประวัติการซ่อม" />
          ) : (
            <div className="empty-state"><strong>ยังไม่มีประวัติการซ่อม</strong><p>งานซ่อมที่ปิดเรื่องแล้วจะมาเก็บไว้ที่นี่</p></div>
          )}
        </div>
        <ServerTablePagination currentItemCount={tickets.length} disabled={isLoading} onPageChange={(nextPage) => void loadTickets(nextPage)} pageInfo={pageInfo} />
      </article>
    </section>
  );
}
