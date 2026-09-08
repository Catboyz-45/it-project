"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Table Pagination” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";

const DEFAULT_PAGE_SIZE = 10;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “page Numbers” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - currentPage: ค่า “current Page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - totalPages: ค่า “total Pages” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function pageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const candidates = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return Array.from(candidates)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Pagination Pages” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { disabled = false, onPageChange, page, totalPages, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
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
      {index > 0 && pageNumber - pages[index - 1]! > 1 ? <span aria-hidden="true" className="table-pagination-ellipsis">…</span> : null}
      <button
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Server Page Info” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ServerPageInfo = {
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  total?: number;
  totalPages?: number;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: React hook “use Table Pagination” รวม state และพฤติกรรมที่คอมโพเนนต์นำกลับมาใช้ซ้ำ
 * รับค่า:
 * - items: ค่า “items” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - pageSize: ค่า “page Size” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function useTablePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “page Items” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return { page, pageItems, setPage, totalPages };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Table Pagination” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { page, setPage, totalItems, totalPages, }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
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
  const firstItem = totalItems === 0 ? 0 : (page - 1) * DEFAULT_PAGE_SIZE + 1;
  const lastItem = Math.min(page * DEFAULT_PAGE_SIZE, totalItems);
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Server Table Pagination” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { currentItemCount, disabled = false, onPageChange, pageInfo: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
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
  const knownTotalPages = pageInfo.totalPages;
  const lastKnownPage = knownTotalPages ?? (pageInfo.hasNextPage ? pageInfo.page + 1 : pageInfo.page);
  const firstItem = pageInfo.total === 0 ? 0 : (pageInfo.page - 1) * pageInfo.pageSize + 1;
  const inferredLastItem = pageInfo.page * pageInfo.pageSize;
  const lastItem = pageInfo.total === undefined ? inferredLastItem : Math.min(inferredLastItem, pageInfo.total);
  const totalPages = pageInfo.totalPages ?? lastKnownPage;
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
