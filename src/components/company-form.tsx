"use client";
import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useUI } from "./ui-feedback";
type Company = Record<string, string | null>;
const fields = [
  ["legalName", "ชื่อบริษัทตามกฎหมาย", true], ["displayName", "ชื่อที่แสดง", true], ["shortDescription", "คำอธิบายบริษัท", false],
  ["history", "ประวัติบริษัท", false], ["vision", "วิสัยทัศน์", false], ["mission", "พันธกิจ", false], ["address", "ที่อยู่", false],
  ["phoneDisplay", "เบอร์โทรที่แสดง", false], ["phoneHref", "เบอร์โทรสำหรับลิงก์", false], ["email", "อีเมล", false], ["lineLabel", "LINE Official", false],
  ["lineUrl", "LINE URL", false], ["facebookUrl", "Facebook URL", false], ["mapsUrl", "Google Maps URL", false], ["mapsEmbedUrl", "Maps Embed URL", false],
  ["businessHours", "เวลาทำการ", false], ["seoTitle", "SEO title", false], ["seoDescription", "SEO description", false],
] as const;
export function CompanyForm() { const [company, setCompany] = useState<Company | null>(null); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const { toast } = useUI();
  useEffect(() => { let active = true; void fetch("/api/admin/company").then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); if (active) setCompany(body.company ?? {}); }).catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "โหลดข้อมูลไม่สำเร็จ"); }); return () => { active = false; }; }, []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); const payload = Object.fromEntries(fields.map(([key]) => [key, String(form.get(key) ?? "").trim() || null])); Object.assign(payload, { logoMediaId: null }); try { const response = await fetch("/api/admin/company", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setCompany(body.company); toast("บันทึกข้อมูลบริษัทเรียบร้อยแล้ว"); } catch (caught) { setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ"); } finally { setSaving(false); } }
  if (!company) return <div className="card-body">{error || "กำลังโหลด…"}</div>;
  return <form className="card-body form-stack" style={{ maxWidth: 840, margin: 0 }} onSubmit={submit}>{error && <div className="auth-alert warning">{error}</div>}{fields.map(([key, label, required]) => <div className="form-group" key={key}><label className={required ? "required" : ""} htmlFor={key}>{label}</label>{["shortDescription", "history", "vision", "mission", "address", "seoDescription"].includes(key) ? <textarea id={key} name={key} className="field" rows={3} defaultValue={company[key] ?? ""} required={required} /> : <input id={key} name={key} className="field" defaultValue={company[key] ?? ""} required={required} type={key === "email" ? "email" : "text"} />}</div>)}<button className="btn btn-dark" disabled={saving}><Save size={17} /> {saving ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนแปลง"}</button></form>;
}
