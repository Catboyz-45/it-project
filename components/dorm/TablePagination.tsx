"use client";
// เก็บเลขหน้าปัจจุบันไว้ในสถานะฝั่งเบราว์เซอร์

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";

// 10 แถวต่อหน้า ถ้าจะแก้ต้องแก้ทั้งฝั่งเซิร์ฟเวอร์ด้วย ไม่งั้นเลขรายการที่แสดงจะเพี้ยน
const DEFAULT_PAGE_SIZE = 10;

// เลือกว่าจะโชว์เลขหน้าไหนบ้าง มี 100 หน้าก็โชว์ไม่หมดอยู่แล้ว
function pageNumbers(currentPage: number, totalPages: number) {
  // ไม่เกิน 5 หน้าก็โชว์หมดเลย ไม่ต้องคิดมาก
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  // เกินนั้นเอาหน้าแรก หน้าสุดท้าย และรอบ ๆ หน้าปัจจุบัน Set ช่วยตัดตัวซ้ำตอนอยู่ใกล้ขอบ
  const candidates = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return Array.from(candidates)
    // ตัดหน้า 0 กับหน้าที่เกินจริงทิ้ง จากการบวกลบข้างบน
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

// แถวปุ่มเลขหน้า ใช้ร่วมกันทั้งแบบแบ่งหน้าฝั่งเบราว์เซอร์และฝั่งเซิร์ฟเวอร์
function PaginationPages({
  disabled = false,
  onPageChange,
  page,
  totalPages,
}: {
  disabled?: boolean;
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  const pages = pageNumbers(page, totalPages);
  return pages.map((pageNumber, index) => (
    <span className="contents" key={pageNumber}>
      {/* เลขหน้าขาดช่วงก็คั่นด้วยจุดไข่ปลา เช่น 1 … 7 8 9 … 20 */}
      {index > 0 && pageNumber - pages[index - 1]! > 1 ? <span aria-hidden="true" className="table-pagination-ellipsis">…</span> : null}
      <button
        // aria-current บอกโปรแกรมอ่านหน้าจอว่ากำลังอยู่หน้านี้ ไม่ใช่แค่ทำให้สีเข้ม
        aria-current={pageNumber === page ? "page" : undefined}
        aria-label={`หน้า ${pageNumber}`}
        className={`pagination-page${pageNumber === page ? " active" : ""}`}
        disabled={disabled}
        onClick={() => onPageChange(pageNumber)}
        type="button"
      >
        {pageNumber}
      </button>
    </span>
  ));
}

// ข้อมูลหน้าที่ API ส่งมา บาง endpoint ไม่ได้นับทั้งหมดให้ จึงมีแค่ hasNextPage
export type ServerPageInfo = {
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  // สองตัวนี้ไม่บังคับ เพราะการนับทั้งตารางทุกครั้งแพงเกินไปสำหรับข้อมูลชุดใหญ่
  total?: number;
  totalPages?: number;
};

// แบ่งหน้าจากข้อมูลที่โหลดมาครบแล้ว ใช้กับตารางที่ข้อมูลไม่เยอะ
export function useTablePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // ลบรายการจนหน้าหายไป ก็ดึงกลับมาหน้าสุดท้ายที่ยังมีอยู่ ไม่ปล่อยให้ค้างหน้าว่าง
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  // useMemo กันตัดอาเรย์ใหม่ทุกครั้งที่ re-render ทั้งที่ข้อมูลกับหน้ายังเหมือนเดิม
  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return { page, pageItems, setPage, totalPages };
}

// แถบแบ่งหน้าที่คู่กับ useTablePagination ข้างบน
export function TablePagination({
  page,
  setPage,
  totalItems,
  totalPages,
}: {
  page: number;
  setPage: (page: number) => void;
  totalItems: number;
  totalPages: number;
}) {
  // เลขลำดับรายการที่กำลังแสดง เช่น "แสดง 11 ถึง 20 จาก 57 รายการ"
  const firstItem = totalItems === 0 ? 0 : (page - 1) * DEFAULT_PAGE_SIZE + 1;
  const lastItem = Math.min(page * DEFAULT_PAGE_SIZE, totalItems);
  // สรุปเป็นประโยคให้โปรแกรมอ่านหน้าจอ เพราะมองไม่เห็นว่าตารางเปลี่ยนหน้าไปแล้ว
  const resultSummary = totalItems === 0
    ? "ไม่พบรายการ"
    : `พบ ${totalItems.toLocaleString("th-TH")} รายการ กำลังแสดงหน้า ${page.toLocaleString("th-TH")} จาก ${totalPages.toLocaleString("th-TH")} หน้า รายการที่ ${firstItem.toLocaleString("th-TH")} ถึง ${lastItem.toLocaleString("th-TH")}`;

  return (
    <>
      <LiveAnnouncement message={resultSummary} />
      <nav aria-label="แบ่งหน้าตาราง" className="table-pagination" role="navigation">
        <span>แสดง {firstItem.toLocaleString("th-TH")} ถึง {lastItem.toLocaleString("th-TH")} จาก {totalItems.toLocaleString("th-TH")} รายการ</span>
        <div>
          <IconButton className="pagination-arrow" label="หน้าก่อนหน้า" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></IconButton>
          <PaginationPages onPageChange={setPage} page={page} totalPages={totalPages} />
          <IconButton className="pagination-arrow" label="หน้าถัดไป" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></IconButton>
        </div>
      </nav>
    </>
  );
}

// แบ่งหน้าที่ให้เซิร์ฟเวอร์ตัดข้อมูลมาให้ ใช้กับตารางที่ข้อมูลเยอะเกินจะโหลดมาทั้งหมด
export function ServerTablePagination({
  currentItemCount,
  disabled = false,
  onPageChange,
  pageInfo,
}: {
  currentItemCount?: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  pageInfo: ServerPageInfo;
}) {
  // ไม่รู้จำนวนหน้าทั้งหมดก็เดาจาก hasNextPage ว่ายังมีอีกอย่างน้อยหนึ่งหน้า
  const knownTotalPages = pageInfo.totalPages;
  const lastKnownPage = knownTotalPages ?? (pageInfo.hasNextPage ? pageInfo.page + 1 : pageInfo.page);
  const firstItem = pageInfo.total === 0 ? 0 : (pageInfo.page - 1) * pageInfo.pageSize + 1;
  const inferredLastItem = pageInfo.page * pageInfo.pageSize;
  // หน้าสุดท้ายมักไม่เต็ม 10 แถว จึงต้องหนีบไม่ให้เกินจำนวนจริง
  const lastItem = pageInfo.total === undefined ? inferredLastItem : Math.min(inferredLastItem, pageInfo.total);
  const totalPages = pageInfo.totalPages ?? lastKnownPage;
  // ข้อความสรุปมีหลายแบบ เพราะบางครั้งรู้จำนวนทั้งหมด บางครั้งรู้แค่ว่ามีหน้าถัดไป
  const resultSummary = disabled
    ? `กำลังโหลดหน้า ${pageInfo.page.toLocaleString("th-TH")}`
      : pageInfo.total === 0 || currentItemCount === 0
      ? "ไม่พบรายการ"
      : pageInfo.total === undefined
        ? currentItemCount === undefined
          ? `กำลังแสดงหน้า ${pageInfo.page.toLocaleString("th-TH")}`
          : `พบ ${currentItemCount.toLocaleString("th-TH")} รายการในหน้านี้ กำลังแสดงหน้า ${pageInfo.page.toLocaleString("th-TH")}`
        : `พบ ${pageInfo.total.toLocaleString("th-TH")} รายการ กำลังแสดงหน้า ${pageInfo.page.toLocaleString("th-TH")} จาก ${totalPages.toLocaleString("th-TH")} หน้า รายการที่ ${firstItem.toLocaleString("th-TH")} ถึง ${lastItem.toLocaleString("th-TH")}`;

  return (
    <>
      <LiveAnnouncement message={resultSummary} />
      {/* aria-busy บอกว่ากำลังโหลดหน้าใหม่อยู่ ตัวเลขที่เห็นยังเป็นของหน้าเดิม */}
      <nav aria-busy={disabled} aria-label="แบ่งหน้าตาราง" className="table-pagination" role="navigation">
      <span>
        {pageInfo.total === undefined
          ? `หน้า ${pageInfo.page}`
          : `แสดง ${firstItem.toLocaleString("th-TH")} ถึง ${lastItem.toLocaleString("th-TH")} จาก ${pageInfo.total.toLocaleString("th-TH")} รายการ`}
      </span>
      <div>
        <button
          aria-label="หน้าก่อนหน้า"
          className="pagination-arrow"
          disabled={disabled || pageInfo.page <= 1}
          onClick={() => onPageChange(pageInfo.page - 1)}
          type="button"
        >
          <ChevronLeft size={17} />
        </button>
        <PaginationPages disabled={disabled} onPageChange={onPageChange} page={pageInfo.page} totalPages={lastKnownPage} />
        <button
          aria-label="หน้าถัดไป"
          className="pagination-arrow"
          // ปิดปุ่มถัดไปจาก hasNextPage เพราะบางที่ไม่รู้ว่าทั้งหมดมีกี่หน้า
          disabled={disabled || !pageInfo.hasNextPage}
          onClick={() => onPageChange(pageInfo.page + 1)}
          type="button"
        >
          <ChevronRight size={17} />
        </button>
      </div>
      </nav>
    </>
  );
}
