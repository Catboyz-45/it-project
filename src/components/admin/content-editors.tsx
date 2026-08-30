/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React content-editors ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import {
  createContext,
  FormEvent,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Eye, Save } from "lucide-react";
import {
  EditorHeader,
  FormSection,
  MediaUploader,
  PreviewModal,
} from "./editor-ui";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { LoadingLabel } from "../loading-label";
import { setFlashMessage } from "@/lib/client-flash";
import {
  FieldErrors,
  fieldMessage,
  focusFirstInvalid,
  readFieldErrors,
} from "@/lib/form-validation";

type Kind = "banner" | "service" | "product" | "project" | "news";
type RecordData = Record<string, unknown> & {
  id?: string;
  status?: "DRAFT" | "PUBLISHED";
  title?: string;
  name?: string;
  summary?: string;
  description?: string;
};
type Option = { id: string; name?: string; title?: string };
const configs = {
  banner: {
    label: "แบนเนอร์",
    api: "banners",
    list: "/admin/banners",
    eyebrow: "HERO BANNER",
  },
  service: {
    label: "บริการ",
    api: "services",
    list: "/admin/services",
    eyebrow: "SERVICE",
  },
  product: {
    label: "สินค้า",
    api: "products",
    list: "/admin/products",
    eyebrow: "PRODUCT",
  },
  project: {
    label: "ผลงาน",
    api: "projects",
    list: "/admin/projects",
    eyebrow: "OUR PROJECT",
  },
  news: { label: "ข่าวสาร", api: "news", list: "/admin/news", eyebrow: "NEWS" },
} as const;
const string = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const nullable = (form: FormData, key: string) => string(form, key) || null;
const numberOrNull = (form: FormData, key: string) =>
  string(form, key) ? Number(string(form, key)) : null;
const dateTimeOrNull = (form: FormData, key: string) => {
  const value = string(form, key);
  return value ? new Date(value).toISOString() : null;
};
const ValidationContext = createContext<FieldErrors>({});

function ContentEditor({
  mode,
  kind,
  idOrSlug,
}: {
  mode: "new" | "edit";
  kind: Kind;
  idOrSlug?: string;
}) {
  const config = configs[kind];
  const router = useRouter();
  const { markDirty, markClean } = useDirtyForm();
  const [record, setRecord] = useState<RecordData>({});
  const [options, setOptions] = useState<{
    brands: Option[];
    types: Option[];
    categories: Option[];
    services: Option[];
  }>({ brands: [], types: [], categories: [], services: [] });
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [preview, setPreview] = useState(false);
  const [previewData, setPreviewData] = useState({ title: "", summary: "" });
  useEffect(() => {
    let active = true;
    const tasks: Promise<void>[] = [];
    if (mode === "edit" && idOrSlug)
      tasks.push(
        fetch(
          `/api/admin/content/${config.api}/${encodeURIComponent(idOrSlug)}`,
        ).then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error);
          if (active) setRecord(body.record);
        }),
      );
    if (kind === "product")
      tasks.push(
        Promise.all([
          fetch("/api/admin/taxonomies/brands").then((r) => r.json()),
          fetch("/api/admin/taxonomies/product-types").then((r) => r.json()),
        ]).then(([brands, types]) => {
          if (active)
            setOptions((value) => ({
              ...value,
              brands: brands.items,
              types: types.items,
            }));
        }),
      );
    if (kind === "news")
      tasks.push(
        fetch("/api/admin/taxonomies/news-categories")
          .then((r) => r.json())
          .then((body) => {
            if (active)
              setOptions((value) => ({ ...value, categories: body.items }));
          }),
      );
    if (kind === "project")
      tasks.push(
        fetch("/api/admin/content/services?pageSize=100&status=ALL")
          .then((r) => r.json())
          .then((body) => {
            if (active)
              setOptions((value) => ({ ...value, services: body.items }));
          }),
      );
    void Promise.all(tasks)
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error ? caught.message : "โหลดข้อมูลไม่สำเร็จ",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [config.api, idOrSlug, kind, mode]);

  function payload(form: FormData, status: "DRAFT" | "PUBLISHED") {
    const common = {
      status,
      isFeatured: form.get("isFeatured") === "on",
      isSearchable: form.get("isSearchable") === "on",
      seoTitle: nullable(form, "seoTitle"),
      seoDescription: nullable(form, "seoDescription"),
      coverMediaId: nullable(form, "coverMediaId"),
    };
    if (kind === "banner")
      return {
        title: string(form, "title"),
        description: nullable(form, "description"),
        buttonLabel: nullable(form, "buttonLabel"),
        buttonUrl: nullable(form, "buttonUrl"),
        imageId: nullable(form, "imageId"),
        sortOrder: Number(string(form, "sortOrder") || 0),
        status,
      };
    if (kind === "service")
      return {
        ...common,
        slug: string(form, "slug"),
        title: string(form, "title"),
        eyebrow: nullable(form, "eyebrow"),
        summary: string(form, "summary"),
        content: nullable(form, "content"),
        sortOrder: Number(string(form, "sortOrder") || 0),
      };
    if (kind === "product") {
      let specifications: Record<string, string> | null = null;
      const raw = string(form, "specifications");
      if (raw)
        specifications = Object.fromEntries(
          raw
            .split("\n")
            .map((line) => line.split(":", 2).map((value) => value.trim()))
            .filter((parts) => parts.length === 2),
        );
      return {
        ...common,
        slug: string(form, "slug"),
        name: string(form, "name"),
        model: string(form, "model"),
        summary: string(form, "summary"),
        content: nullable(form, "content"),
        btuMin: numberOrNull(form, "btuMin"),
        btuMax: numberOrNull(form, "btuMax"),
        features: nullable(form, "features"),
        specifications,
        warranty: nullable(form, "warranty"),
        seer: numberOrNull(form, "seer"),
        refrigerant: nullable(form, "refrigerant"),
        priceLabel: string(form, "priceLabel") || "สอบถามราคา",
        brandId: string(form, "brandId"),
        productTypeId: string(form, "productTypeId"),
        catalogMediaId: nullable(form, "catalogMediaId"),
        galleryMediaIds: form.getAll("galleryMediaIds").map(String),
      };
    }
    if (kind === "project")
      return {
        ...common,
        slug: string(form, "slug"),
        title: string(form, "title"),
        projectType: string(form, "projectType"),
        area: string(form, "area"),
        customerName: nullable(form, "customerName"),
        showCustomerName: form.get("showCustomerName") === "on",
        summary: string(form, "summary"),
        content: nullable(form, "content"),
        completedAt: nullable(form, "completedAt"),
        galleryMediaIds: form.getAll("galleryMediaIds").map(String),
        serviceIds: form.getAll("serviceIds").map(String),
      };
    return {
      ...common,
      slug: string(form, "slug"),
      title: string(form, "title"),
      summary: string(form, "summary"),
      content: nullable(form, "content"),
      categoryId: string(form, "categoryId"),
      publishedAt: dateTimeOrNull(form, "publishedAt"),
    };
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const status = submitter?.value === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
    const formData = new FormData(form);
    const requestedPublication =
      kind === "news" ? dateTimeOrNull(formData, "publishedAt") : null;
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      const response = await fetch(
        mode === "edit"
          ? `/api/admin/content/${config.api}/${record.id}`
          : `/api/admin/content/${config.api}`,
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(mode === "edit" && typeof record.updatedAt === "string"
              ? { "If-Unmodified-Since": record.updatedAt }
              : {}),
          },
          body: JSON.stringify(payload(formData, status)),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        const nextErrors = readFieldErrors(body);
        setFieldErrors(nextErrors);
        focusFirstInvalid(form, nextErrors);
        throw new Error(body.error ?? "บันทึกไม่สำเร็จ");
      }
      markClean();
      const scheduled =
        status === "PUBLISHED" &&
        requestedPublication !== null &&
        new Date(requestedPublication).getTime() > Date.now();
      setFlashMessage(
        scheduled
          ? "บันทึกข่าวและกำหนดเวลาเผยแพร่แล้ว"
          : status === "PUBLISHED"
            ? `บันทึกและเผยแพร่${config.label}แล้ว`
            : `บันทึก${config.label}เป็นฉบับร่างแล้ว`,
      );
      router.push(config.list);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  }
  function showPreview(form: HTMLFormElement) {
    const data = new FormData(form);
    setPreviewData({
      title: string(data, kind === "product" ? "name" : "title"),
      summary: string(data, kind === "banner" ? "description" : "summary"),
    });
    setPreview(true);
  }
  const value = (key: string, fallback = "") =>
    typeof record[key] === "string" || typeof record[key] === "number"
      ? String(record[key])
      : fallback;
  if (loading) return <p>กำลังโหลดข้อมูล…</p>;
  return (
    <ValidationContext.Provider value={fieldErrors}>
      <EditorHeader
        title={`${mode === "new" ? "เพิ่ม" : "แก้ไข"}${config.label}`}
        description={`ข้อมูลทั้งหมดตรวจสอบด้วย Zod ที่ฝั่งเซิร์ฟเวอร์ก่อนบันทึก`}
        listHref={config.list}
      />
      {error && (
        <div className="auth-alert warning" role="alert">
          {error}
        </div>
      )}
      <form
        onSubmit={submit}
        onChange={markDirty}
        onInput={markDirty}
        aria-busy={saving}
      >
        <div className="editor-layout">
          <div className="editor-main">
            <FormSection title="ข้อมูลหลัก">
              <div className="form-stack" style={{ marginTop: 0 }}>
                {kind === "product" ? (
                  <Field
                    label="ชื่อสินค้า"
                    name="name"
                    defaultValue={value("name")}
                    required
                  />
                ) : (
                  <Field
                    label={
                      kind === "banner"
                        ? "ข้อความหัวเรื่อง"
                        : `ชื่อ${config.label}`
                    }
                    name="title"
                    defaultValue={value("title")}
                    required
                  />
                )}
                {kind !== "banner" && (
                  <Field
                    label="Slug"
                    name="slug"
                    defaultValue={value("slug")}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    required
                  />
                )}
                {kind === "banner" && (
                  <>
                    <Area
                      label="คำอธิบาย"
                      name="description"
                      defaultValue={value("description")}
                    />
                    <div className="grid-2">
                      <Field
                        label="ข้อความบนปุ่ม"
                        name="buttonLabel"
                        defaultValue={value("buttonLabel")}
                      />
                      <Field
                        label="ลิงก์ปุ่ม"
                        name="buttonUrl"
                        defaultValue={value("buttonUrl")}
                      />
                    </div>
                    <Field
                      label="ลำดับ"
                      name="sortOrder"
                      type="number"
                      defaultValue={value("sortOrder", "0")}
                    />
                  </>
                )}
                {kind === "service" && (
                  <>
                    <Field
                      label="ข้อความเหนือหัวข้อ"
                      name="eyebrow"
                      defaultValue={value("eyebrow")}
                    />
                    <Area
                      label="คำอธิบายสั้น"
                      name="summary"
                      defaultValue={value("summary")}
                      required
                    />
                    <Area
                      label="รายละเอียด"
                      name="content"
                      defaultValue={value("content")}
                    />
                    <Field
                      label="ลำดับ"
                      name="sortOrder"
                      type="number"
                      defaultValue={value("sortOrder", "0")}
                    />
                  </>
                )}
                {kind === "product" && (
                  <>
                    <div className="grid-2">
                      <Select
                        label="ยี่ห้อ"
                        name="brandId"
                        items={options.brands}
                        defaultValue={value("brandId")}
                      />
                      <Field
                        label="รุ่น"
                        name="model"
                        defaultValue={value("model")}
                        required
                      />
                    </div>
                    <Select
                      label="ประเภทสินค้า"
                      name="productTypeId"
                      items={options.types}
                      defaultValue={value("productTypeId")}
                    />
                    <Area
                      label="คำอธิบายสั้น"
                      name="summary"
                      defaultValue={value("summary")}
                      required
                    />
                    <Area
                      label="รายละเอียด"
                      name="content"
                      defaultValue={value("content")}
                    />
                    <div className="grid-2">
                      <Field
                        label="BTU ต่ำสุด"
                        name="btuMin"
                        type="number"
                        defaultValue={value("btuMin")}
                      />
                      <Field
                        label="BTU สูงสุด"
                        name="btuMax"
                        type="number"
                        defaultValue={value("btuMax")}
                      />
                    </div>
                    <Area
                      label="คุณสมบัติเด่น"
                      name="features"
                      defaultValue={value("features")}
                    />
                    <Area
                      label="สเปก (หนึ่งบรรทัดต่อ ชื่อ: ค่า)"
                      name="specifications"
                      defaultValue=""
                    />
                    <div className="grid-3">
                      <Field
                        label="การรับประกัน"
                        name="warranty"
                        defaultValue={value("warranty")}
                      />
                      <Field
                        label="SEER"
                        name="seer"
                        type="number"
                        defaultValue={value("seer")}
                      />
                      <Field
                        label="สารทำความเย็น"
                        name="refrigerant"
                        defaultValue={value("refrigerant")}
                      />
                    </div>
                    <Field
                      label="ข้อความราคา"
                      name="priceLabel"
                      defaultValue={value("priceLabel", "สอบถามราคา")}
                      required
                    />
                  </>
                )}
                {kind === "project" && (
                  <>
                    <div className="grid-2">
                      <Field
                        label="ประเภทงาน"
                        name="projectType"
                        defaultValue={value("projectType")}
                        required
                      />
                      <Field
                        label="จังหวัด/พื้นที่"
                        name="area"
                        defaultValue={value("area")}
                        required
                      />
                    </div>
                    <div className="grid-2">
                      <Field
                        label="วันที่เสร็จงาน"
                        name="completedAt"
                        type="date"
                        defaultValue={value("completedAt").slice(0, 10)}
                      />
                      <Field
                        label="ชื่อลูกค้า"
                        name="customerName"
                        defaultValue={value("customerName")}
                      />
                    </div>
                    <Check
                      name="showCustomerName"
                      label="ได้รับอนุญาตให้เปิดเผยชื่อลูกค้า"
                      initial={Boolean(record.showCustomerName)}
                    />
                    <Area
                      label="คำอธิบายสั้น"
                      name="summary"
                      defaultValue={value("summary")}
                      required
                    />
                    <Area
                      label="รายละเอียด"
                      name="content"
                      defaultValue={value("content")}
                    />
                    <div className="form-group">
                      <label>บริการที่เกี่ยวข้อง</label>
                      {options.services.map((item) => (
                        <Check
                          key={item.id}
                          name="serviceIds"
                          value={item.id}
                          label={item.title ?? ""}
                          initial={
                            Array.isArray(record.services) &&
                            record.services.some(
                              (entry) =>
                                typeof entry === "object" &&
                                entry !== null &&
                                "serviceId" in entry &&
                                entry.serviceId === item.id,
                            )
                          }
                        />
                      ))}
                    </div>
                  </>
                )}
                {kind === "news" && (
                  <>
                    <Select
                      label="หมวดหมู่ข่าว"
                      name="categoryId"
                      items={options.categories}
                      defaultValue={value("categoryId")}
                    />
                    <Field
                      label="วันและเวลาที่เผยแพร่"
                      name="publishedAt"
                      type="datetime-local"
                      defaultValue={value("publishedAt").slice(0, 16)}
                    />
                    <p className="help">
                      หากกำหนดเวลาในอนาคต
                      ข่าวจะยังไม่ปรากฏบนเว็บไซต์จนกว่าจะถึงเวลานั้น
                      วันที่นี้จะถูกเก็บไว้แม้บันทึกเป็นฉบับร่าง
                    </p>
                    <Area
                      label="คำอธิบายสั้น"
                      name="summary"
                      defaultValue={value("summary")}
                      required
                    />
                    <Area
                      label="รายละเอียด"
                      name="content"
                      defaultValue={value("content")}
                    />
                  </>
                )}
              </div>
            </FormSection>
            <FormSection title="สื่อ">
              <div className="form-stack" style={{ marginTop: 0 }}>
                <MediaUploader
                  name={kind === "banner" ? "imageId" : "coverMediaId"}
                  title={kind === "banner" ? "รูปแบนเนอร์" : "รูปปก"}
                  multiple={false}
                  initial={initialMedia(
                    kind === "banner" ? record.image : record.coverMedia,
                  )}
                  onDirty={markDirty}
                />
                {(kind === "product" || kind === "project") && (
                  <MediaUploader
                    name="galleryMediaIds"
                    title="แกลเลอรี"
                    initial={initialGallery(record.gallery)}
                    onDirty={markDirty}
                  />
                )}
                {kind === "product" && (
                  <MediaUploader
                    name="catalogMediaId"
                    title="Catalog PDF"
                    multiple={false}
                    pdf
                    initial={initialMedia(record.catalogMedia)}
                    onDirty={markDirty}
                  />
                )}
              </div>
            </FormSection>
            {kind !== "banner" && (
              <FormSection title="SEO และการแสดงผล">
                <div className="form-stack" style={{ marginTop: 0 }}>
                  <Field
                    label="SEO title"
                    name="seoTitle"
                    maxLength={60}
                    defaultValue={value("seoTitle")}
                  />
                  <Area
                    label="SEO description"
                    name="seoDescription"
                    maxLength={160}
                    defaultValue={value("seoDescription")}
                  />
                  <Check
                    name="isFeatured"
                    label="รายการแนะนำ"
                    initial={Boolean(record.isFeatured)}
                  />
                  <Check
                    name="isSearchable"
                    label="อนุญาตให้ค้นหา"
                    initial={record.isSearchable !== false}
                  />
                </div>
              </FormSection>
            )}
          </div>
          <aside className="editor-aside">
            <FormSection title="บันทึก">
              <div className="editor-actions">
                <button
                  className="btn btn-dark"
                  name="status"
                  value="DRAFT"
                  disabled={saving}
                  aria-busy={saving}
                >
                  <LoadingLabel busy={saving} busyText="กำลังบันทึก…">
                    <>
                      <Save size={17} /> บันทึกฉบับร่าง
                    </>
                  </LoadingLabel>
                </button>
                <button
                  className="btn btn-outline"
                  name="status"
                  value="PUBLISHED"
                  disabled={saving}
                  aria-busy={saving}
                >
                  <LoadingLabel busy={saving} busyText="กำลังเผยแพร่…">
                    <>
                      <Save size={17} /> บันทึกและเผยแพร่
                    </>
                  </LoadingLabel>
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  disabled={saving}
                  onClick={(event) => showPreview(event.currentTarget.form!)}
                >
                  <Eye size={17} /> ดูตัวอย่างฉบับร่าง
                </button>
              </div>
            </FormSection>
          </aside>
        </div>
      </form>
      {preview && (
        <PreviewModal
          title={previewData.title}
          eyebrow={config.eyebrow}
          description={previewData.summary}
          onClose={() => setPreview(false)}
        />
      )}
    </ValidationContext.Provider>
  );
}

function initialMedia(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    typeof value.id !== "string"
  )
    return [];
  const item = value as {
    id: string;
    originalName?: string;
    kind?: string;
    altText?: string | null;
  };
  return [
    {
      id: item.id,
      name: item.originalName ?? "ไฟล์เดิม",
      preview:
        item.kind === "PDF" ? undefined : `/api/media/${item.id}?width=640`,
      altText: item.altText ?? "",
    },
  ];
}
function initialGallery(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const media =
      entry && typeof entry === "object" && "media" in entry
        ? entry.media
        : undefined;
    return initialMedia(media);
  });
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  pattern,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  type?: string;
  pattern?: string;
  maxLength?: number;
}) {
  const message = fieldMessage(useContext(ValidationContext), name);
  const errorId = `${name}-error`;
  const effectiveMaxLength =
    maxLength ??
    {
      slug: 180,
      title: 180,
      name: 180,
      model: 120,
      eyebrow: 80,
      projectType: 120,
      area: 160,
      customerName: 180,
      warranty: 200,
      refrigerant: 50,
      priceLabel: 80,
      buttonLabel: 80,
      buttonUrl: 500,
      seoTitle: 60,
    }[name];
  return (
    <div className="form-group">
      <label className={required ? "required" : ""} htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="field"
        type={type}
        defaultValue={defaultValue}
        required={required}
        pattern={pattern}
        maxLength={effectiveMaxLength}
        step={type === "number" ? "any" : undefined}
        aria-invalid={Boolean(message)}
        aria-describedby={message ? errorId : undefined}
      />
      {message && (
        <p className="field-error" id={errorId}>
          {message}
        </p>
      )}
    </div>
  );
}
function Area({
  label,
  name,
  defaultValue,
  required,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  maxLength?: number;
}) {
  const message = fieldMessage(useContext(ValidationContext), name);
  const errorId = `${name}-error`;
  const effectiveMaxLength =
    maxLength ??
    {
      summary: 500,
      description: 500,
      content: 50000,
      features: 20000,
      specifications: 20000,
      seoDescription: 160,
    }[name];
  return (
    <div className="form-group">
      <label className={required ? "required" : ""} htmlFor={name}>
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        className="field"
        rows={4}
        defaultValue={defaultValue}
        required={required}
        maxLength={effectiveMaxLength}
        aria-invalid={Boolean(message)}
        aria-describedby={message ? errorId : undefined}
      />
      {message && (
        <p className="field-error" id={errorId}>
          {message}
        </p>
      )}
    </div>
  );
}
function Select({
  label,
  name,
  items,
  defaultValue,
}: {
  label: string;
  name: string;
  items: Option[];
  defaultValue: string;
}) {
  const message = fieldMessage(useContext(ValidationContext), name);
  const errorId = `${name}-error`;
  return (
    <div className="form-group">
      <label className="required" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        className="select"
        defaultValue={defaultValue}
        required
        aria-invalid={Boolean(message)}
        aria-describedby={message ? errorId : undefined}
      >
        <option value="" disabled>
          เลือก{label}
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name ?? item.title}
          </option>
        ))}
      </select>
      {message && (
        <p className="field-error" id={errorId}>
          {message}
        </p>
      )}
    </div>
  );
}
function Check({
  name,
  label,
  initial,
  value,
}: {
  name: string;
  label: string;
  initial: boolean;
  value?: string;
}) {
  return (
    <label className="cluster" style={{ padding: "6px 0" }}>
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={initial}
      />{" "}
      {label}
    </label>
  );
}

/** สร้างส่วนหน้าจอ ProductEditor; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function ProductEditor({
  mode,
  idOrSlug,
}: {
  mode: "new" | "edit";
  idOrSlug?: string;
}) {
  return <ContentEditor mode={mode} kind="product" idOrSlug={idOrSlug} />;
}
/** สร้างส่วนหน้าจอ ProjectEditor; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function ProjectEditor({
  mode,
  idOrSlug,
}: {
  mode: "new" | "edit";
  idOrSlug?: string;
}) {
  return <ContentEditor mode={mode} kind="project" idOrSlug={idOrSlug} />;
}
/** สร้างส่วนหน้าจอ GeneralEditor; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function GeneralEditor({
  mode,
  kind,
  idOrSlug,
}: {
  mode: "new" | "edit";
  kind: "service" | "news" | "banner";
  idOrSlug?: string;
}) {
  return <ContentEditor mode={mode} kind={kind} idOrSlug={idOrSlug} />;
}
