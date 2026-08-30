/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React taxonomy-manager ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { AdminPageHeader } from "../admin-shell";
import { useUI } from "../ui-feedback";
type Kind = "brands" | "product-types" | "news-categories";
type Item = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  _count: { products?: number; news?: number };
};
const tabs = [
  ["/admin/taxonomies/news-categories", "หมวดหมู่ข่าว"],
  ["/admin/taxonomies/brands", "ยี่ห้อสินค้า"],
  ["/admin/taxonomies/product-types", "ประเภทสินค้า"],
] as const;
/** สร้างส่วนหน้าจอ TaxonomyManager; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function TaxonomyManager({
  title,
  description,
  singular,
  kind,
}: {
  title: string;
  description: string;
  singular: string;
  kind: Kind;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const { confirm, toast } = useUI();
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/taxonomies/${kind}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setItems(body.items);
  }, [kind]);
  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/taxonomies/${kind}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setItems(body.items);
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
  }, [kind]);
  async function request(url: string, init: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error);
  }
  async function add(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending("add");
    setError("");
    try {
      await request(`/api/admin/taxonomies/${kind}`, {
        method: "POST",
        body: JSON.stringify({
          name,
          slug,
          sortOrder: items.length,
          isActive: true,
        }),
      });
      setName("");
      setSlug("");
      toast(`เพิ่ม${singular}แล้ว`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
    } finally {
      setPending(null);
    }
  }
  async function save(item: Item) {
    if (pending) return;
    setPending(item.id);
    try {
      await request(`/api/admin/taxonomies/${kind}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          slug: item.slug,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
        }),
      });
      setEditing(null);
      await load();
      toast("บันทึกแล้ว");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
    } finally {
      setPending(null);
    }
  }
  async function remove(item: Item) {
    if (pending) return;
    if (
      !(await confirm({
        title: `ย้าย “${item.name}” ไปถังขยะ?`,
        description: "ทำได้เฉพาะรายการที่ไม่มีเนื้อหาอ้างอิง",
        confirmLabel: "ย้ายไปถังขยะ",
        tone: "danger",
      }))
    )
      return;
    setPending(item.id);
    try {
      const response = await fetch(`/api/admin/taxonomies/${kind}/${item.id}`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error);
      await load();
      toast("ย้ายไปถังขยะแล้ว");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ลบไม่สำเร็จ");
    } finally {
      setPending(null);
    }
  }
  return (
    <>
      <AdminPageHeader title={title} description={description} />
      <nav
        className="cluster"
        style={{ marginTop: 24 }}
        aria-label="ประเภทหมวดหมู่"
      >
        {tabs.map(([href, label]) => (
          <Link key={href} className="btn btn-outline" href={href}>
            {label}
          </Link>
        ))}
      </nav>
      {error && (
        <div className="auth-alert warning" role="alert">
          {error}
        </div>
      )}
      <div className="taxonomy-grid">
        <form
          className="form-section"
          onSubmit={add}
          aria-busy={pending === "add"}
        >
          <div className="form-section-head">
            <h2>เพิ่ม{singular}</h2>
            <p>ชื่อและ slug ต้องไม่ซ้ำกับรายการเดิม</p>
          </div>
          <div className="form-stack">
            <label>
              ชื่อ
              <input
                className="field"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label>
              Slug
              <input
                className="field"
                value={slug}
                onChange={(event) =>
                  setSlug(
                    event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  )
                }
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              />
            </label>
            <button
              className="btn btn-dark"
              disabled={pending !== null}
              aria-busy={pending === "add"}
            >
              {pending === "add" ? (
                <>
                  <LoaderCircle className="spin" size={17} /> กำลังเพิ่ม…
                </>
              ) : (
                <>
                  <Plus size={17} /> เพิ่ม{singular}
                </>
              )}
            </button>
          </div>
        </form>
        <section className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>Slug</th>
                  <th>ใช้งาน</th>
                  <th aria-label="การทำงาน" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const count = item._count.products ?? item._count.news ?? 0;
                  return (
                    <tr key={item.id}>
                      <td>
                        {editing === item.id ? (
                          <input
                            className="field"
                            value={editName}
                            onChange={(event) =>
                              setEditName(event.target.value)
                            }
                            aria-label={`แก้ไขชื่อ ${item.name}`}
                          />
                        ) : (
                          <strong>{item.name}</strong>
                        )}
                      </td>
                      <td>{item.slug}</td>
                      <td>{count} รายการ</td>
                      <td>
                        <div className="row-actions">
                          {editing === item.id ? (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={pending !== null}
                                aria-busy={pending === item.id}
                                aria-label={`บันทึกการแก้ไข ${item.name}`}
                                onClick={() => save(item)}
                              >
                                {pending === item.id ? (
                                  <LoaderCircle className="spin" size={16} />
                                ) : (
                                  <Check size={16} />
                                )}
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={pending !== null}
                                aria-label={`ยกเลิกการแก้ไข ${item.name}`}
                                onClick={() => setEditing(null)}
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={pending !== null}
                                aria-label={`แก้ไข ${item.name}`}
                                onClick={() => {
                                  setEditing(item.id);
                                  setEditName(item.name);
                                }}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={
                                  count > 0
                                    ? `ไม่สามารถลบ ${item.name} เนื่องจากมีข้อมูลอ้างอิง ${count} รายการ`
                                    : `ย้าย ${item.name} ไปถังขยะ`
                                }
                                disabled={count > 0 || pending !== null}
                                aria-busy={pending === item.id}
                                onClick={() => remove(item)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
