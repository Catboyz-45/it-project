/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /projects; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { Search } from "lucide-react";
import { StoryCard } from "@/components/content-cards";
import {
  EmptyPublicResults,
  PublicPagination,
} from "@/components/public-pagination";
import { createMetadata } from "@/lib/seo";
import { PublicContentService } from "@/server/services/public-content.service";
import { formatThaiDate } from "@/lib/date";
import { ThemeSelect } from "@/components/theme-select";
import {
  ClearPublicFilters,
  PublicFilterForm,
  PublicFilterSubmit,
  PublicResultCount,
} from "@/components/public-filter-feedback";

export const metadata = createMetadata({
  title: "ผลงาน",
  description: "ตัวอย่างผลงานติดตั้ง บำรุงรักษาระบบปรับอากาศ และงานระบบ M&E",
  path: "/projects",
});
type Params = { q?: string; projectType?: string; page?: string };
/** สร้างส่วนหน้าจอ ProjectsPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const raw = await searchParams;
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  const content = new PublicContentService();
  const [result, types] = await Promise.all([
    content.listProjects({
      page,
      pageSize: 9,
      query: raw.q,
      projectType: raw.projectType,
    }),
    content.getProjectTypes(),
  ]);
  const items = result.items.map((item) => ({
    slug: item.slug,
    title: item.title,
    category: item.projectType,
    area: item.area,
    date: formatThaiDate(item.completedAt, { year: "numeric", month: "short" }),
    summary: item.summary,
    tone: "office",
    media: item.coverMedia,
  }));
  const filtered = Boolean(raw.q || raw.projectType);
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">OUR PROJECTS</p>
          <h1 className="display">ผลงานของเรา</h1>
          <p className="lead">
            ตัวอย่างงานติดตั้ง บำรุงรักษา
            และงานระบบวิศวกรรมที่ได้รับการดูแลอย่างเป็นขั้นตอน
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <PublicFilterForm action="/projects">
            <label className="search-field">
              <span className="sr-only">ค้นหาผลงาน</span>
              <Search size={18} />
              <input
                className="field"
                name="q"
                defaultValue={raw.q}
                maxLength={120}
                placeholder="ค้นหาชื่อผลงานหรือพื้นที่"
              />
            </label>
            <ThemeSelect
              name="projectType"
              label="กรองตามประเภท"
              defaultValue={raw.projectType}
              options={[
                { value: "", label: "ทุกประเภท" },
                ...types.map((value) => ({
                  value: value.projectType,
                  label: value.projectType,
                })),
              ]}
            />
            <PublicFilterSubmit />
            {filtered && <ClearPublicFilters href="/projects" />}
          </PublicFilterForm>
          <PublicResultCount>
            พบ {result.total} รายการ
            {filtered ? " จากเงื่อนไขที่เลือก" : ""}
          </PublicResultCount>
          {items.length ? (
            <div className="grid-3">
              {items.map((item) => (
                <StoryCard key={item.slug} item={item} type="projects" />
              ))}
            </div>
          ) : (
            <EmptyPublicResults resetHref="/projects" />
          )}
          <PublicPagination
            page={result.page}
            pageCount={result.pageCount}
            pathname="/projects"
            params={{ q: raw.q, projectType: raw.projectType }}
          />
        </div>
      </section>
    </>
  );
}
