// แปลงช่อง {{key}} ในตัวแก้ไขให้เป็นป้ายภาษาไทยที่แก้ข้างในไม่ได้ และแปลงกลับตอนบันทึก
// ผู้ใช้จึงเห็นแค่ "ชื่อผู้เช่า" ไม่ต้องเห็นโค้ด ส่วนที่เก็บลงฐานข้อมูลยังเป็น {{key}} แบบเดิม
// Template เก่าเปิดได้ทันที และฝั่งเซิร์ฟเวอร์ไม่ต้องรู้จักป้ายนี้เลย

const placeholderPattern = /{{\s*([a-z][a-z0-9_]*)\s*}}/g;
export const chipSelector = "span[data-placeholder]";

export function createPlaceholderChip(key: string, label: string) {
  const chip = document.createElement("span");
  chip.className = "template-variable";
  chip.dataset.placeholder = key;
  // contentEditable=false ทำให้ป้ายถูกเลือกและลบได้ทั้งก้อน พิมพ์แทรกกลางคำจนตัวแปรเสียไม่ได้
  chip.contentEditable = "false";
  chip.textContent = label;
  return chip;
}

// ไล่ทุกข้อความใต้ root แล้วแทนช่องที่รู้จักด้วยป้าย ช่องที่ไม่รู้จักปล่อยเป็นข้อความ
// ให้การตรวจตอนบันทึกฟ้องผู้ใช้ แทนที่จะหายไปเงียบ ๆ
export function chipifyPlaceholders(root: Node, labels: Record<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => node.parentElement?.closest(chipSelector) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeValue?.includes("{{")) textNodes.push(node as Text);
  }
  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? "";
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of text.matchAll(placeholderPattern)) {
      const key = match[1];
      if (!(key in labels)) continue;
      fragment.append(text.slice(cursor, match.index), createPlaceholderChip(key, labels[key]));
      cursor = match.index + match[0].length;
    }
    if (cursor === 0) continue;
    fragment.append(text.slice(cursor));
    textNode.replaceWith(fragment);
  }
}

// ทำบนสำเนาเท่านั้น คืนป้ายทุกอันให้กลับเป็น {{key}} ก่อนส่งไปบันทึกหรือเทียบว่าแก้อะไรไปหรือยัง
export function serializePlaceholders(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(chipSelector).forEach((chip) => {
    chip.replaceWith(document.createTextNode(`{{${chip.dataset.placeholder}}}`));
  });
}

// สลับข้อความบนป้ายระหว่างชื่อช่องกับค่าจริงจากเอกสารล่าสุด
// ค่าว่างแสดงเป็นชื่อช่องในวงเล็บ ผู้ใช้จะรู้ว่าช่องนั้นยังไม่มีข้อมูล ไม่ใช่ป้ายหายไป
export function renderPlaceholderChip(chip: HTMLElement, labels: Record<string, string>, values: Record<string, string> | null) {
  const key = chip.dataset.placeholder ?? "";
  const label = labels[key] ?? key;
  const value = values?.[key];
  chip.classList.toggle("is-value", Boolean(values));
  chip.classList.toggle("is-empty", Boolean(values) && !value);
  chip.textContent = values ? value || `(${label})` : label;
  chip.title = values ? label : "";
}

export function showPlaceholderValues(root: ParentNode, labels: Record<string, string>, values: Record<string, string> | null) {
  root.querySelectorAll<HTMLElement>(chipSelector).forEach((chip) => renderPlaceholderChip(chip, labels, values));
}

// ช่องที่มีอยู่ในเอกสารตอนนี้ ใช้เช็คว่าข้อมูลสำคัญครบหรือยัง
export function usedPlaceholderKeys(root: ParentNode) {
  return new Set(Array.from(root.querySelectorAll<HTMLElement>(chipSelector), (chip) => chip.dataset.placeholder ?? ""));
}

// แปลงข้อความ HTML สำเร็จรูปเป็นชิ้นส่วนที่มีป้ายพร้อมแทรก
export function snippetFragment(html: string, labels: Record<string, string>) {
  const template = document.createElement("template");
  template.innerHTML = html;
  chipifyPlaceholders(template.content, labels);
  return template.content;
}
