import Link from "next/link";

export function PublicPagination({ page, pageCount, pathname, params }: { page: number; pageCount: number; pathname: string; params: Record<string, string | undefined> }) {
  if (pageCount <= 1) return null;
  const href = (nextPage: number) => { const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value); }); if (nextPage > 1) query.set("page", String(nextPage)); const suffix = query.toString(); return `${pathname}${suffix ? `?${suffix}` : ""}`; };
  return <nav className="public-pagination" aria-label="เปลี่ยนหน้าผลลัพธ์">{page > 1 ? <Link className="btn btn-outline" href={href(page - 1)}>ก่อนหน้า</Link> : <span className="btn btn-outline" aria-disabled="true">ก่อนหน้า</span>}<span>หน้า {page} จาก {pageCount}</span>{page < pageCount ? <Link className="btn btn-outline" href={href(page + 1)}>ถัดไป</Link> : <span className="btn btn-outline" aria-disabled="true">ถัดไป</span>}</nav>;
}

export function EmptyPublicResults({ resetHref }: { resetHref: string }) { return <div className="empty-state"><h2 className="subheading">ไม่พบข้อมูลที่ตรงกับการค้นหา</h2><p className="muted">ลองเปลี่ยนคำค้นหาหรือล้างตัวกรองเพื่อดูรายการทั้งหมด</p><Link className="btn btn-outline" href={resetHref}>ล้างตัวกรอง</Link></div>; }
