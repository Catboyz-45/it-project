/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React admin-table ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  FolderSearch,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { AdminPageHeader } from "./admin-shell";
import { useUI } from "./ui-feedback";
import { LoadingLabel } from "./loading-label";

type Kind = "banners" | "services" | "products" | "projects" | "news";
type Row = {
  id: string;
  slug?: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
  publishedAt?: string | null;
};
type Result = { items: Row[]; total: number; page: number; pageCount: number };
const statusText = {
  DRAFT: "ฉบับร่าง",
  PUBLISHED: "เผยแพร่แล้ว",
  ARCHIVED: "เก็บถาวร",
};
const displayStatus = (row: Row) => row.status === "PUBLISHED" && row.publishedAt && new Date(row.publishedAt).getTime() > Date.now() ? "กำหนดเผยแพร่" : statusText[row.status];

/** สร้างส่วนหน้าจอ AdminTablePage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function AdminTablePage({
  title,
  description,
  basePath,
  kind,
}: {
  title: string;
  description: string;
  basePath: string;
  kind: Kind;
}) {
  const router = useRouter();
  const { confirm, toast } = useUI();
  const [result, setResult] = useState<Result>({
    items: [],
    total: 0,
    page: 1,
    pageCount: 1,
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("updated-desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingRow, setPendingRow] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        query,
        status,
        sort,
        page: String(page),
        pageSize: "10",
      });
      const response = await fetch(`/api/admin/content/${kind}?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setResult(body);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "โหลดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, [kind, page, query, sort, status]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function transition(
    row: Row,
    action: "publish" | "unpublish" | "archive" | "trash",
  ) {
    const labels = {
      publish: "เผยแพร่",
      unpublish: "ยกเลิกเผยแพร่",
      archive: "เก็บถาวร",
      trash: "ย้ายไปถังขยะ",
    };
    const label = row.status === "ARCHIVED" && action === "unpublish"
      ? "นำกลับเป็นฉบับร่าง"
      : labels[action];
    const accepted = await confirm({
      title: `${label} “${row.title}”?`,
      description:
        action === "trash"
          ? "รายการจะถูกซ่อนและกู้คืนได้ภายใน 30 วัน"
          : row.status === "ARCHIVED" && action === "unpublish"
            ? "รายการจะกลับมาเป็นฉบับร่างและยังไม่แสดงบนเว็บไซต์ จากนั้นจึงแก้ไขหรือเผยแพร่ใหม่ได้"
          : "ระบบจะบันทึกการเปลี่ยนแปลงนี้ใน Audit Log",
      confirmLabel: label,
      tone: action === "trash" ? "danger" : undefined,
    });
    if (!accepted || pendingRow) return;
    setPendingRow(row.id);
    try {
      const response = await fetch(
        `/api/admin/content/${kind}/${row.id}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(body.error ?? "ดำเนินการไม่สำเร็จ", "error");
        return;
      }
      toast(`${label}แล้ว`);
      await load();
    } catch {
      toast("การเชื่อมต่อขัดข้อง กรุณาลองอีกครั้ง", "error");
    } finally {
      setPendingRow(null);
    }
  }
  return (
    <>
      <AdminPageHeader
        title={title}
        description={description}
        action={
          <button
            className="btn btn-dark"
            onClick={() => router.push(`${basePath}/new`)}
          >
            + เพิ่มรายการ
          </button>
        }
      />
      <div className="admin-filters">
        <label className="search-field">
          <span className="sr-only">ค้นหา</span>
          <Search size={18} />
          <input
            className="field"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={`ค้นหา${title}`}
          />
        </label>
        <select
          className="select filter-select"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="กรองตามสถานะ"
        >
          <option value="ALL">ทุกสถานะ</option>
          <option value="PUBLISHED">เผยแพร่แล้ว</option>
          <option value="DRAFT">ฉบับร่าง</option>
          <option value="ARCHIVED">เก็บถาวร</option>
        </select>
        <select
          className="select filter-select"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          aria-label="เรียงลำดับ"
        >
          <option value="updated-desc">แก้ไขล่าสุด</option>
          <option value="updated-asc">แก้ไขเก่าสุด</option>
          <option value="title-asc">ชื่อ ก–ฮ</option>
          <option value="title-desc">ชื่อ ฮ–ก</option>
        </select>
      </div>
      {error && (
        <div className="auth-alert warning" role="alert">
          {error}
        </div>
      )}
      <section className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ชื่อรายการ</th>
                <th>สถานะ</th>
                <th>แก้ไขล่าสุด</th>
                <th aria-label="การทำงาน" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>กำลังโหลด…</td>
                </tr>
              ) : (
                result.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.title}</strong>
                    </td>
                    <td>
                      <span
                        className={`status ${row.status !== "PUBLISHED" ? "draft" : ""}`}
                      >
                        {displayStatus(row)}
                      </span>
                    </td>
                    <td className="muted">
                      {new Intl.DateTimeFormat("th-TH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(row.updatedAt))}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-btn"
                          disabled={pendingRow !== null}
                          aria-busy={pendingRow === row.id}
                          aria-label={
                            row.status === "PUBLISHED"
                              ? "ยกเลิกเผยแพร่"
                              : row.status === "ARCHIVED"
                                ? `นำ ${row.title} กลับเป็นฉบับร่าง`
                              : "เผยแพร่"
                          }
                          onClick={() =>
                            transition(
                              row,
                              row.status === "PUBLISHED"
                                ? "unpublish"
                                : row.status === "ARCHIVED"
                                  ? "unpublish"
                                : "publish",
                            )
                          }
                        >
                          {pendingRow === row.id ? (
                            <LoadingLabel busy busyText="">
                              <span className="sr-only">กำลังดำเนินการ</span>
                            </LoadingLabel>
                          ) : row.status === "PUBLISHED" ? (
                            <EyeOff size={16} />
                          ) : row.status === "ARCHIVED" ? (
                            <ArchiveRestore size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                        <button
                          className="icon-btn"
                          disabled={pendingRow !== null}
                          aria-label={`แก้ไข ${row.title}`}
                          onClick={() =>
                            router.push(
                              `${basePath}/${row.slug ?? row.id}/edit`,
                            )
                          }
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={`เก็บ ${row.title} ถาวร`}
                          disabled={
                            row.status === "ARCHIVED" || pendingRow !== null
                          }
                          aria-busy={pendingRow === row.id}
                          onClick={() => transition(row, "archive")}
                        >
                          <Archive size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          disabled={pendingRow !== null}
                          aria-busy={pendingRow === row.id}
                          aria-label={`ย้าย ${row.title} ไปถังขยะ`}
                          onClick={() => transition(row, "trash")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && !result.items.length && (
          <div className="empty-state" style={{ margin: 20 }}>
            <div>
              <FolderSearch size={38} color="var(--green-700)" />
              <h2 className="subheading" style={{ marginTop: 16 }}>
                ไม่พบรายการ
              </h2>
              <p className="muted">ลองเปลี่ยนคำค้นหาหรือสถานะที่เลือก</p>
            </div>
          </div>
        )}
        <div className="pagination">
          <span>ทั้งหมด {result.total} รายการ</span>
          <div className="cluster">
            <button
              className="btn btn-ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              ก่อนหน้า
            </button>
            <span>
              หน้า {result.page}/{result.pageCount}
            </span>
            <button
              className="btn btn-ghost"
              disabled={page >= result.pageCount || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              ถัดไป
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
