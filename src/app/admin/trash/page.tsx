/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /admin/trash; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";
import { useCallback, useEffect, useState } from "react";
import { ArchiveRestore, LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-shell";
import { useUI } from "@/components/ui-feedback";
type Item = { id: string; title: string; kind: string; purgeAt: string };
const names: Record<string, string> = {
  banners: "แบนเนอร์",
  services: "บริการ",
  products: "สินค้า",
  projects: "ผลงาน",
  news: "ข่าวสาร",
  brands: "ยี่ห้อ",
  "product-types": "ประเภทสินค้า",
  "news-categories": "หมวดข่าว",
  admins: "บัญชีผู้ดูแล",
};
/** สร้างส่วนหน้าจอ TrashPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function TrashPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const { confirm, toast } = useUI();
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/trash");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setItems(body.items);
    setRole(body.role);
  }, []);
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/trash")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) {
          setItems(body.items);
          setRole(body.role);
        }
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error ? caught.message : "โหลดข้อมูลไม่สำเร็จ",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function action(item: Item, operation: "restore" | "delete") {
    if (
      pending ||
      !(await confirm({
        title: `${operation === "restore" ? "กู้คืน" : "ลบถาวร"} “${item.title}”?`,
        description:
          operation === "restore"
            ? "รายการจะกลับเข้าสู่ระบบโดยยังไม่เผยแพร่"
            : "การดำเนินการนี้ไม่สามารถย้อนกลับได้",
        confirmLabel: operation === "restore" ? "กู้คืน" : "ลบถาวร",
        tone: operation === "delete" ? "danger" : undefined,
      }))
    )
      return;
    setPending(`${item.kind}-${item.id}`);
    const taxonomy = ["brands", "product-types", "news-categories"].includes(
      item.kind,
    );
    try {
      const response = await fetch(
        item.kind === "admins"
          ? `/api/admin/users/${item.id}/transition`
          : `/api/admin/${taxonomy ? "taxonomies" : "content"}/${item.kind}/${item.id}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: operation }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(body.error ?? "ดำเนินการไม่สำเร็จ", "error");
        return;
      }
      toast(operation === "restore" ? "กู้คืนแล้ว" : "ลบถาวรแล้ว");
      try {
        await load();
      } catch {
        toast("ดำเนินการสำเร็จ แต่โหลดรายการล่าสุดไม่สำเร็จ กรุณารีเฟรชหน้า", "warning");
      }
    } catch {
      toast("การเชื่อมต่อขัดข้อง กรุณาลองอีกครั้ง", "error");
    } finally {
      setPending(null);
    }
  }
  return (
    <>
      <AdminPageHeader
        title="ถังขยะ"
        description="รายการจะถูกลบถาวรโดยงาน retention เมื่อครบ 30 วัน"
      />
      {error && <div className="auth-alert warning">{error}</div>}
      <section className="panel">
        {items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>รายการ</th>
                  <th>ประเภท</th>
                  <th>ลบถาวรหลัง</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.kind}-${item.id}`}>
                    <td>
                      <strong>{item.title}</strong>
                    </td>
                    <td>{names[item.kind]}</td>
                    <td>
                      {new Intl.DateTimeFormat("th-TH", {
                        dateStyle: "medium",
                      }).format(new Date(item.purgeAt))}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn-outline"
                          disabled={pending !== null}
                          aria-busy={pending === `${item.kind}-${item.id}`}
                          onClick={() => action(item, "restore")}
                        >
                          {pending === `${item.kind}-${item.id}` ? (
                            <>
                              <LoaderCircle className="spin" size={15} />{" "}
                              กำลังดำเนินการ…
                            </>
                          ) : (
                            <>
                              <RotateCcw size={15} /> กู้คืน
                            </>
                          )}
                        </button>
                        {role === "SUPER_ADMIN" && (
                          <button
                            className="icon-btn"
                            disabled={pending !== null}
                            aria-busy={pending === `${item.kind}-${item.id}`}
                            onClick={() => action(item, "delete")}
                            aria-label={`ลบ ${item.title} ถาวร`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state" style={{ margin: 20 }}>
            <div>
              <ArchiveRestore size={40} color="var(--green-700)" />
              <h2 className="subheading">ถังขยะว่าง</h2>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
