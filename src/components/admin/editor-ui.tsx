/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React editor-ui ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Check,
  Eye,
  FileText,
  Heading2,
  Info,
  Italic,
  Link2,
  List,
  RotateCcw,
  Save,
  Upload,
  X,
} from "lucide-react";
import { useModalAccessibility } from "@/hooks/use-modal-accessibility";

/** สร้างส่วนหน้าจอ FormSection; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="form-section">
      <div className="form-section-head">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** สร้างส่วนหน้าจอ RichTextField; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function RichTextField({
  id,
  label,
  defaultValue = "",
}: {
  id: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <div className="form-group">
      <label className="required" htmlFor={id}>
        {label}
      </label>
      <div>
        <div className="rich-toolbar" aria-label={`เครื่องมือแก้ไข ${label}`}>
          {[Bold, Italic, Heading2, List, Link2].map((Icon, index) => (
            <button
              type="button"
              key={index}
              aria-label={
                ["ตัวหนา", "ตัวเอียง", "หัวข้อ", "รายการ", "ลิงก์"][index]
              }
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
        <textarea
          id={id}
          className="field rich-editor"
          rows={8}
          defaultValue={defaultValue}
        />
      </div>
      <p className="help">
        รองรับหัวข้อ รายการ ลิงก์ และการจัดรูปแบบข้อความพื้นฐาน
      </p>
    </div>
  );
}

type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "ready" | "error";
  preview?: string;
  file?: File;
  error?: string;
  newlyUploaded?: boolean;
  altText?: string;
  altStatus?: "saving" | "saved" | "error";
};
type UploadControl = {
  controller: AbortController;
  xhr?: XMLHttpRequest;
  mediaId?: string;
  cancelled: boolean;
};
function putFile(
  url: string,
  file: File,
  onProgress: (value: number) => void,
  control: UploadControl,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    control.xhr = xhr;
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 85));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("อัปโหลดไปยังพื้นที่จัดเก็บไม่สำเร็จ"));
    xhr.onerror = () => reject(new Error("การเชื่อมต่อขัดข้อง"));
    xhr.onabort = () =>
      reject(new DOMException("ยกเลิกการอัปโหลดแล้ว", "AbortError"));
    xhr.send(file);
  });
}

/** สร้างส่วนหน้าจอ MediaUploader; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function MediaUploader({
  name,
  title = "รูปภาพ",
  multiple = true,
  pdf = false,
  initial = [],
  onDirty,
}: {
  name: string;
  title?: string;
  multiple?: boolean;
  pdf?: boolean;
  initial?: { id: string; name: string; preview?: string; altText?: string }[];
  onDirty?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef(new Map<string, UploadControl>());
  const [files, setFiles] = useState<UploadItem[]>(
    initial.map((item) => ({ ...item, progress: 100, status: "ready" })),
  );
  const accepted = pdf
    ? "application/pdf,.pdf"
    : "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
  async function upload(file: File, localId = crypto.randomUUID()) {
    const max = pdf ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
    const allowed = pdf
      ? ["application/pdf"]
      : ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type) || file.size <= 0 || file.size > max) {
      setFiles((current) => [
        ...current.filter((item) => item.id !== localId),
        {
          id: localId,
          name: file.name,
          progress: 0,
          status: "error",
          file,
          error: `ชนิดไฟล์ไม่ถูกต้องหรือเกิน ${pdf ? 20 : 10} MB`,
        },
      ]);
      return;
    }
    const previous = controlsRef.current.get(localId);
    previous?.controller.abort();
    previous?.xhr?.abort();
    const control: UploadControl = {
      controller: new AbortController(),
      cancelled: false,
    };
    controlsRef.current.set(localId, control);
    const preview = pdf ? undefined : URL.createObjectURL(file);
    setFiles((current) => [
      ...current.filter((item) => item.id !== localId),
      {
        id: localId,
        name: file.name,
        progress: 2,
        status: "uploading",
        file,
        preview,
      },
    ]);
    try {
      const start = await fetch("/api/admin/media/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
        signal: control.controller.signal,
      });
      const signed = await start.json();
      if (!start.ok) throw new Error(signed.error ?? "เริ่มอัปโหลดไม่สำเร็จ");
      control.mediaId = signed.mediaId;
      if (control.cancelled) {
        await cancelServerUpload(signed.mediaId);
        return;
      }
      await putFile(
        signed.uploadUrl,
        file,
        (progress) =>
          setFiles((current) =>
            current.map((item) =>
              item.id === localId ? { ...item, progress } : item,
            ),
          ),
        control,
      );
      setFiles((current) =>
        current.map((item) =>
          item.id === localId ? { ...item, progress: 90 } : item,
        ),
      );
      const complete = await fetch(
        `/api/admin/media/uploads/${signed.mediaId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: control.controller.signal,
        },
      );
      const result = await complete.json();
      if (!complete.ok)
        throw new Error(result.error ?? "ประมวลผลไฟล์ไม่สำเร็จ");
      if (control.cancelled) {
        await cancelServerUpload(result.mediaId);
        return;
      }
      controlsRef.current.delete(localId);
      setFiles((current) =>
        current.map((item) =>
          item.id === localId
            ? {
                ...item,
                id: result.mediaId,
                progress: 100,
                status: "ready",
                file: undefined,
                preview: `/api/media/${result.mediaId}?width=640`,
                newlyUploaded: true,
              }
            : item,
        ),
      );
    } catch (caught) {
      if (
        control.cancelled ||
        (caught instanceof DOMException && caught.name === "AbortError")
      )
        return;
      setFiles((current) =>
        current.map((item) =>
          item.id === localId
            ? {
                ...item,
                status: "error",
                error:
                  caught instanceof Error ? caught.message : "อัปโหลดไม่สำเร็จ",
              }
            : item,
        ),
      );
    }
  }
  async function cancelServerUpload(mediaId: string) {
    await fetch(`/api/admin/media/uploads/${mediaId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      keepalive: true,
    }).catch(() => undefined);
  }
  async function saveAltText(file: UploadItem) {
    if (file.status !== "ready") return;
    setFiles((current) =>
      current.map((item) =>
        item.id === file.id ? { ...item, altStatus: "saving" } : item,
      ),
    );
    const response = await fetch(`/api/admin/media/${file.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ altText: file.altText?.trim() || null }),
    });
    setFiles((current) =>
      current.map((item) =>
        item.id === file.id
          ? { ...item, altStatus: response.ok ? "saved" : "error" }
          : item,
      ),
    );
  }
  function remove(file: UploadItem) {
    onDirty?.();
    const control = controlsRef.current.get(file.id);
    if (control) {
      control.cancelled = true;
      control.controller.abort();
      control.xhr?.abort();
      controlsRef.current.delete(file.id);
      if (control.mediaId) void cancelServerUpload(control.mediaId);
    } else if (file.newlyUploaded) void cancelServerUpload(file.id);
    if (file.preview?.startsWith("blob:")) URL.revokeObjectURL(file.preview);
    setFiles((items) => items.filter((item) => item.id !== file.id));
  }
  function select(selected: FileList | null) {
    if (!selected?.length) return;
    onDirty?.();
    const next = [...selected].slice(0, multiple ? 30 : 1);
    if (!multiple) files.forEach(remove);
    for (const file of next) void upload(file);
  }
  const busy = files.some((item) => item.status === "uploading");
  return (
    <div className="form-group">
      <label>{title}</label>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        aria-label={title}
        accept={accepted}
        multiple={multiple}
        onChange={(event) => {
          select(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        className="dropzone"
        type="button"
        disabled={busy && !multiple}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          select(event.dataTransfer.files);
        }}
      >
        <span>
          <Upload size={25} />
          <strong>ลากไฟล์มาวาง หรือเลือกไฟล์</strong>
          <small>
            {pdf
              ? "PDF · ไม่เกิน 20 MB"
              : "JPEG, PNG หรือ WebP · ไม่เกิน 10 MB ต่อไฟล์"}
            {multiple ? " · เลือกได้หลายไฟล์" : ""}
          </small>
        </span>
      </button>
      {files.length > 0 && (
        <div className="media-grid">
          {files.map((file) => (
            <div className="media-item" key={file.id}>
              <div className="media-thumb">
                {file.status === "ready" && (
                  <input type="hidden" name={name} value={file.id} />
                )}
                {file.preview ? (
                  // The preview is a private, pre-optimized derivative behind a signed redirect.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.preview} alt="" />
                ) : (
                  <FileText size={32} />
                )}
                <span className="media-file-name">{file.name}</span>
                {file.status === "uploading" && (
                  <>
                    <progress max={100} value={file.progress} />
                    <span className="sr-only">อัปโหลด {file.progress}%</span>
                  </>
                )}
                {file.status === "error" && (
                  <div className="media-error" role="alert">
                    {file.error}
                    <button
                      type="button"
                      onClick={() =>
                        file.file && void upload(file.file, file.id)
                      }
                      aria-label={`ลองอัปโหลด ${file.name} อีกครั้ง`}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  aria-label={`นำ ${file.name} ออก`}
                  onClick={() => remove(file)}
                >
                  <X size={14} />
                </button>
              </div>
              {!pdf && (
                <div>
                  <label
                    className="media-alt-label"
                    htmlFor={`media-alt-${file.id}`}
                  >
                    ข้อความอธิบายรูปภาพ
                  </label>
                  <input
                    id={`media-alt-${file.id}`}
                    className="field media-alt-field"
                    type="text"
                    maxLength={500}
                    value={file.altText ?? ""}
                    disabled={file.status !== "ready"}
                    placeholder="เช่น ทีมช่างติดตั้งเครื่องปรับอากาศ"
                    onChange={(event) => {
                      onDirty?.();
                      const altText = event.target.value;
                      setFiles((current) =>
                        current.map((item) =>
                          item.id === file.id
                            ? { ...item, altText, altStatus: undefined }
                            : item,
                        ),
                      );
                    }}
                    onBlur={() => void saveAltText(file)}
                  />
                  <span
                    className={`media-alt-status ${file.altStatus === "error" ? "error" : ""}`}
                    aria-live="polite"
                  >
                    {file.altStatus === "saving"
                      ? "กำลังบันทึก…"
                      : file.altStatus === "saved"
                        ? "บันทึกแล้ว"
                        : file.altStatus === "error"
                          ? "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง"
                          : "อธิบายสิ่งสำคัญในภาพสำหรับผู้ใช้โปรแกรมอ่านหน้าจอ"}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="help">
        ระบบตรวจ signature จริง ลบ metadata ปรับ orientation และสร้าง WebP, AVIF
        และ thumbnails อัตโนมัติ
      </p>
    </div>
  );
}

/** สร้างส่วนหน้าจอ Toggle; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function Toggle({
  label,
  description,
  initial = false,
}: {
  label: string;
  description?: string;
  initial?: boolean;
}) {
  const [on, setOn] = useState(initial);
  return (
    <div className="toggle-row">
      <div>
        <strong style={{ fontSize: ".86rem" }}>{label}</strong>
        {description && <p className="help">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={`switch ${on ? "on" : ""}`}
        onClick={() => setOn((value) => !value)}
      >
        <span className="sr-only">{on ? "เปิด" : "ปิด"}</span>
      </button>
    </div>
  );
}

/** สร้างส่วนหน้าจอ SeoFields; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function SeoFields({
  prefix,
  defaultSlug,
  defaultTitle,
}: {
  prefix: string;
  defaultSlug: string;
  defaultTitle: string;
}) {
  const [slug, setSlug] = useState(defaultSlug);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(
    "ข้อมูลจากบริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด พร้อมรายละเอียดที่เป็นประโยชน์สำหรับลูกค้า",
  );
  const slugChanged = Boolean(defaultSlug && slug !== defaultSlug);
  return (
    <FormSection
      title="SEO และลิงก์"
      description="กำหนดข้อมูลสำหรับผลการค้นหาและการแชร์ลิงก์"
    >
      <div className="form-stack" style={{ marginTop: 0 }}>
        <div className="form-group">
          <label className="required" htmlFor="slug">
            Slug
          </label>
          <div className="slug-input">
            <span className="slug-prefix">yuyen.co.th/{prefix}/</span>
            <input
              id="slug"
              className="field"
              value={slug}
              aria-describedby="slug-help slug-redirect-notice"
              onChange={(event) =>
                setSlug(
                  event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                )
              }
            />
          </div>
          <p id="slug-help" className="help">
            ใช้ตัวอักษรภาษาอังกฤษ ตัวเลข และขีดกลางเท่านั้น
          </p>
          {slugChanged && (
            <div
              id="slug-redirect-notice"
              className="form-notice"
              role="status"
            >
              <Info size={17} />
              <span>
                เมื่อบันทึก ระบบต้องสร้าง Redirect แบบ 301 จาก{" "}
                <strong>
                  /{prefix}/{defaultSlug}
                </strong>{" "}
                มายัง URL ใหม่นี้ เพื่อไม่ให้ลิงก์เดิมและอันดับค้นหาสูญหาย
              </span>
            </div>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="seo-title">SEO title</label>
          <input
            id="seo-title"
            className="field"
            maxLength={60}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <p className="help">{title.length}/60 ตัวอักษร</p>
        </div>
        <div className="form-group">
          <label htmlFor="seo-description">SEO description</label>
          <textarea
            id="seo-description"
            className="field"
            rows={3}
            maxLength={160}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <p className="help">{description.length}/160 ตัวอักษร</p>
        </div>
        <div className="seo-preview" aria-label="ตัวอย่างผลการค้นหา">
          <span className="seo-url">
            https://yuyen.co.th/{prefix}/{slug}
          </span>
          <h3>{title || "ชื่อหน้าจะแสดงที่นี่"}</h3>
          <p>{description || "คำอธิบายสำหรับผลการค้นหาจะแสดงที่นี่"}</p>
        </div>
      </div>
    </FormSection>
  );
}

/** สร้างส่วนหน้าจอ EditorSidebar; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function EditorSidebar({
  mode,
  listHref,
  onPreview,
}: {
  mode: "new" | "edit";
  listHref: string;
  onPreview: () => void;
}) {
  const [status, setStatus] = useState<"draft" | "published">(
    mode === "edit" ? "published" : "draft",
  );
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(false), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const save = () => setToast(true);
  return (
    <aside className="editor-aside">
      <FormSection title="สถานะ">
        <div className="status-choice">
          <button
            type="button"
            className={status === "draft" ? "selected" : ""}
            onClick={() => setStatus("draft")}
          >
            ฉบับร่าง
          </button>
          <button
            type="button"
            className={status === "published" ? "selected" : ""}
            onClick={() => setStatus("published")}
          >
            เผยแพร่
          </button>
        </div>
        <div className="editor-actions" style={{ marginTop: 18 }}>
          <button className="btn btn-dark" type="button" onClick={save}>
            <Save size={17} />{" "}
            {status === "published" ? "บันทึกและเผยแพร่" : "บันทึกฉบับร่าง"}
          </button>
          <button className="btn btn-outline" type="button" onClick={onPreview}>
            <Eye size={17} /> ดูตัวอย่าง
          </button>
          <Link className="btn btn-ghost" href={listHref}>
            ยกเลิกและกลับ
          </Link>
        </div>
      </FormSection>
      <FormSection title="การแสดงผล">
        <Toggle
          label="รายการแนะนำ"
          description="แสดงในส่วนเนื้อหาแนะนำบนหน้าแรก"
        />
        <Toggle
          label="อนุญาตให้ค้นหา"
          description="แสดงเนื้อหาในผลการค้นหาบนเว็บไซต์"
          initial
        />
      </FormSection>
      {toast && (
        <div className="editor-toast" role="status">
          <Check size={18} /> บันทึกข้อมูลตัวอย่างแล้ว
        </div>
      )}
    </aside>
  );
}

/** สร้างส่วนหน้าจอ PreviewModal; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function PreviewModal({
  title,
  eyebrow,
  description,
  onClose,
}: {
  title: string;
  eyebrow: string;
  description: string;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalAccessibility({
    containerRef: modalRef,
    initialFocusRef: closeRef,
    onClose,
  });
  return (
    <div
      className="preview-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="preview-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        tabIndex={-1}
      >
        <div className="preview-bar">
          <div className="cluster">
            <Eye size={17} />
            <strong id="preview-title">ตัวอย่างก่อนเผยแพร่</strong>
          </div>
          <button
            ref={closeRef}
            className="icon-btn"
            onClick={onClose}
            aria-label="ปิดตัวอย่าง"
          >
            <X size={19} />
          </button>
        </div>
        <section className="page-hero">
          <div className="container">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="display">{title || "ชื่อเนื้อหา"}</h1>
            <p className="lead">
              {description || "รายละเอียดเนื้อหาจะแสดงในตำแหน่งนี้"}
            </p>
          </div>
        </section>
        <section className="section-sm">
          <div className="container detail-grid">
            <div
              className="media mint"
              role="img"
              aria-label="ตำแหน่งตัวอย่างรูปปก"
              style={{ minHeight: 340, borderRadius: 20 }}
            />
            <div>
              <h2 className="heading">รายละเอียด</h2>
              <p className="lead">
                นี่คือตัวอย่างการแสดงผลบนเว็บไซต์
                ข้อมูลจริงจะอ้างอิงจากฟอร์มและสื่อที่อัปโหลด
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** สร้างส่วนหน้าจอ EditorHeader; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function EditorHeader({
  title,
  description,
  listHref,
}: {
  title: string;
  description: string;
  listHref: string;
}) {
  return (
    <div className="admin-head">
      <div>
        <p className="eyebrow">CONTENT EDITOR</p>
        <h1 className="admin-title">{title}</h1>
        <p className="admin-subtitle">{description}</p>
      </div>
      <Link className="btn btn-outline" href={listHref}>
        กลับหน้ารายการ
      </Link>
    </div>
  );
}

/** สร้างส่วนหน้าจอ CoverUploader; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function CoverUploader() {
  return <MediaUploader name="coverMediaId" title="รูปปก" multiple={false} />;
}
/** สร้างส่วนหน้าจอ GalleryUploader; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function GalleryUploader() {
  return <MediaUploader name="galleryMediaIds" title="แกลเลอรี" />;
}
/** สร้างส่วนหน้าจอ CatalogUploader; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function CatalogUploader() {
  return (
    <MediaUploader
      name="catalogMediaId"
      title="Catalog PDF"
      multiple={false}
      pdf
    />
  );
}
