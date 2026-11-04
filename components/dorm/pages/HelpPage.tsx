"use client";
// ศูนย์ช่วยเหลือของเจ้าของหอ ค้นหาและอ่านคู่มือ เนื้อหาอยู่ใน lib/help/owner-guide.ts
// แต่ละบทความเป็นขั้นตอนที่ทำตามได้จริง และมีปุ่มพาไปหน้าที่ต้องทำต่อ

import Link from "next/link";
import { ArrowRight, ChevronRight, CircleHelp, Search } from "lucide-react";
import { useState } from "react";
import { SearchEmptyState } from "@/components/ui/SearchEmptyState";
import { helpTopicSearchText, ownerHelpTopics, type HelpAction } from "@/lib/help/owner-guide";
import { ownerPagePath } from "@/lib/navigation-routes";
import { platformProfile } from "@/lib/platform-profile";

function actionHref(propertyId: string, action: HelpAction) {
  const path = ownerPagePath(propertyId, action.page);
  return action.query ? `${path}?${action.query}` : path;
}

export function HelpPage({ propertyId }: Readonly<{ propertyId: string }>) {
  const [query, setQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedArticleIndex, setSelectedArticleIndex] = useState(0);
  const selectedTopic = ownerHelpTopics.find((topic) => topic.id === selectedTopicId);
  const article = selectedTopic?.articles[selectedArticleIndex];
  const nextArticle = selectedTopic?.articles[selectedArticleIndex + 1];
  const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");
  const filteredTopics = ownerHelpTopics.filter((topic) =>
    helpTopicSearchText(topic).toLocaleLowerCase("th-TH").includes(normalizedQuery),
  );

  // เปิดบทความแล้วเลื่อนหน้าไปหา เพราะบนมือถือเนื้อหาอยู่ใต้รายการหัวข้อ
  const openTopic = (topicId: string, articleIndex = 0) => {
    setSelectedTopicId(topicId);
    setSelectedArticleIndex(articleIndex);
    // รอให้บทความถูกวาดก่อนค่อยเลื่อนไปหา ไม่งั้นยังไม่มีองค์ประกอบให้เลื่อนไป
    window.requestAnimationFrame(() => document.getElementById("help-article")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <section className="help-page">
      <article className="help-center-hero">
        <span><CircleHelp size={36} /></span>
        <p>ศูนย์ช่วยเหลือ {platformProfile.name}</p>
        <h2>ต้องการให้เราช่วยเรื่องอะไร?</h2>
        <label><Search size={21} /><input aria-label="ค้นหาคู่มือ" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหา เช่น สัญญา PromptPay ย้ายออก" value={query} /></label>
        <small>ค้นหาคำตอบและขั้นตอนการใช้งานทุกส่วนของระบบบริหารหอพัก</small>
      </article>

      <section className="help-catalog">
        <div className="help-section-heading"><p>คู่มือการใช้งานระบบ</p><h2>เลือกหัวข้อที่ต้องการ</h2></div>
        <div className="help-topic-grid">
          {filteredTopics.map((topic, index) => (
            <button key={topic.id} onClick={() => openTopic(topic.id)} type="button">
              <span>{index + 1}</span>
              <div><strong>{topic.title}</strong><small>{topic.summary}</small><em>{topic.articles.length} บทความ</em></div>
              <ChevronRight size={20} />
            </button>
          ))}
        </div>
        {filteredTopics.length === 0 ? <SearchEmptyState description="ลองใช้คำค้นอื่น เช่น บิล ห้องพัก หรือผู้เช่า" title="ไม่พบหัวข้อที่ค้นหา" /> : null}
      </section>

      {selectedTopic && article ? (
        <section className="help-article-layout" id="help-article">
          <aside>
            <small>บทความในหมวดนี้</small>
            <h3>{selectedTopic.title}</h3>
            {selectedTopic.articles.map((item, index) => (
              <button aria-current={selectedArticleIndex === index ? "true" : undefined} className={selectedArticleIndex === index ? "active" : ""} key={item.id} onClick={() => setSelectedArticleIndex(index)} type="button">{item.title}</button>
            ))}
          </aside>
          <article aria-labelledby="help-article-title">
            <p>ศูนย์ช่วยเหลือ / {selectedTopic.title}</p>
            <h2 id="help-article-title">{article.title}</h2>
            {article.intro ? <p className="help-article-intro">{article.intro}</p> : null}
            <ol className="help-article-body">
              {article.steps.map((step, index) => <li key={step}><span aria-hidden="true">{index + 1}</span><p>{step}</p></li>)}
            </ol>
            {article.action || nextArticle ? <div className="help-article-actions">
              {article.action ? <Link className="primary-button" href={actionHref(propertyId, article.action)}><ArrowRight aria-hidden="true" size={17} /> {article.action.label}</Link> : null}
              {nextArticle ? <button className="secondary-button" onClick={() => setSelectedArticleIndex(selectedArticleIndex + 1)} type="button">บทความถัดไป: {nextArticle.title}</button> : null}
            </div> : null}
            <div className="help-article-note"><CircleHelp size={20} /><p><strong>ยังต้องการความช่วยเหลือ?</strong><span>กดปุ่มแชทมุมขวาล่าง แล้วเลือกทีมช่วยเหลือ {platformProfile.name}</span></p></div>
          </article>
        </section>
      ) : null}
    </section>
  );
}
