// คำสั่งระดับย่อหน้าของตัวแก้ไขเอกสาร แยกออกมาจากคอมโพเนนต์เพราะเป็นงานจัดการ DOM ล้วน ๆ
// ทุกฟังก์ชันรับ root คือกล่องที่ย่อหน้าวางเรียงกันอยู่ (.document หรือตัวแก้ไขเอง)

const textBlockSelector = "p,h1,h2,h3";
const removeButtonClass = "page-break-remove";

// ย่อหน้าชั้นบนสุดที่ node อยู่ข้างใน คือลูกตรง ๆ ของ root
export function topLevelBlock(root: HTMLElement, node: Node | null) {
  let current: Node | null = node;
  while (current && current.parentNode !== root) current = current.parentNode;
  return current instanceof HTMLElement ? current : null;
}

export function isManualPageBreak(node: Node | null): node is HTMLElement {
  return node instanceof HTMLElement && node.classList.contains("page-break") && !node.classList.contains("editor-auto-page-break");
}

export function isPageBreak(node: Node | null): boolean {
  return node instanceof HTMLElement && node.classList.contains("page-break");
}

// ช่วงข้อความระหว่างขอบย่อหน้ากับเคอร์เซอร์ไม่มีอะไรเลย ทั้งตัวอักษร ป้าย และรูป
function isEmptySpan(span: Range) {
  const content = span.cloneContents();
  return !content.textContent && !content.querySelector("img,[data-placeholder],table");
}

export function isAtBlockStart(block: HTMLElement, range: Range) {
  const span = document.createRange();
  span.setStart(block, 0);
  span.setEnd(range.startContainer, range.startOffset);
  return isEmptySpan(span);
}

export function isAtBlockEnd(block: HTMLElement, range: Range) {
  const span = document.createRange();
  span.setStart(range.endContainer, range.endOffset);
  span.setEnd(block, block.childNodes.length);
  return isEmptySpan(span);
}

function isBlank(element: HTMLElement) {
  return !element.textContent?.replaceAll(" ", " ").trim() && !element.querySelector("img,[data-placeholder],table");
}

// ย่อหน้าว่างต้องมี <br> ไม่งั้นเบราว์เซอร์ยุบความสูงเหลือศูนย์และวางเคอร์เซอร์ไม่ได้
// ตัดย่อหน้าตรงท้ายข้อความจะได้โหนดข้อความเปล่าติดมา ซึ่งไม่ช่วยให้ย่อหน้ามีความสูง ต้องเช็คจากเนื้อหาจริง
function keepEditable(element: HTMLElement) {
  if (element.textContent || element.querySelector("br,img,table,[data-placeholder]")) return;
  element.replaceChildren(document.createElement("br"));
}

// ตัดย่อหน้าออกเป็นสองท่อนตรงเคอร์เซอร์ ท่อนหลังเป็นแท็กเดียวกันและคลาสเดียวกัน
export function splitBlockAtCaret(block: HTMLElement, range: Range) {
  const tail = document.createRange();
  tail.setStart(range.startContainer, range.startOffset);
  tail.setEnd(block, block.childNodes.length);
  const next = block.cloneNode(false) as HTMLElement;
  next.append(tail.extractContents());
  block.after(next);
  keepEditable(next);
  return next;
}

export function placeCaretAtStart(element: Node) {
  const range = document.createRange();
  range.setStart(element, 0);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return range;
}

// ตัวคั่นหน้าที่ผู้ใช้ใส่เอง แก้ข้างในไม่ได้ เคอร์เซอร์จะได้ไม่หลุดเข้าไปพิมพ์ในช่องเทาระหว่างหน้า
// ปุ่มกากบาทเป็นของแสดงผลอย่างเดียว ตัดทิ้งตอนบันทึก
export function decoratePageBreak(pageBreak: HTMLElement) {
  pageBreak.contentEditable = "false";
  if (pageBreak.querySelector(`.${removeButtonClass}`)) return;
  const button = document.createElement("button");
  button.className = removeButtonClass;
  button.type = "button";
  // ไม่ให้ Tab จากในเอกสารกระโดดมาหยุดที่ป้ายนี้ เอาตัวแบ่งออกด้วยแป้นพิมพ์ใช้ Backspace ต้นหน้าแทน
  button.tabIndex = -1;
  button.title = "เอาตัวแบ่งหน้าออก แล้วรวมเนื้อหากับหน้าก่อน";
  button.setAttribute("aria-label", "เอาตัวแบ่งหน้าออก");
  button.textContent = "ตัวแบ่งหน้า ✕";
  pageBreak.append(button);
}

export function decoratePageBreaks(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(".page-break:not(.editor-auto-page-break)").forEach(decoratePageBreak);
}

export function stripPageBreakDecorations(root: HTMLElement) {
  root.querySelectorAll(`.${removeButtonClass}`).forEach((button) => button.remove());
  root.querySelectorAll<HTMLElement>(".page-break").forEach((pageBreak) => pageBreak.removeAttribute("contenteditable"));
}

export function createPageBreak() {
  const pageBreak = document.createElement("div");
  pageBreak.className = "page-break";
  decoratePageBreak(pageBreak);
  return pageBreak;
}

// ต่อเนื้อหาของ current ท้าย previous แบบกด Backspace ต้นย่อหน้าใน Word คืนจุดรอยต่อไว้วางเคอร์เซอร์
export function mergeBlocks(previous: HTMLElement, current: HTMLElement) {
  if (!previous.matches(textBlockSelector) || !current.matches(textBlockSelector)) return null;
  previous.querySelectorAll(":scope > br:last-child").forEach((lineBreak) => lineBreak.remove());
  const joinAt = previous.childNodes.length;
  while (current.firstChild) {
    if (current.firstChild instanceof HTMLBRElement && !current.firstChild.nextSibling) current.firstChild.remove();
    else previous.append(current.firstChild);
  }
  current.remove();
  keepEditable(previous);
  const range = document.createRange();
  range.setStart(previous, Math.min(joinAt, previous.childNodes.length));
  range.collapse(true);
  return range;
}

// ย่อหน้าชั้นบนสุดทั้งหมดที่ช่วงเลือกแตะอยู่ ไม่นับตัวคั่นหน้า
export function selectedBlocks(root: HTMLElement, range: Range) {
  const first = topLevelBlock(root, range.startContainer);
  const last = topLevelBlock(root, range.endContainer);
  if (!first || !last) return [];
  const blocks: HTMLElement[] = [];
  for (let block: Element | null = first; block; block = block.nextElementSibling) {
    if (block instanceof HTMLElement && !isPageBreak(block)) blocks.push(block);
    if (block === last) break;
  }
  return blocks;
}

// เปลี่ยนแท็กของย่อหน้าโดยย้ายลูกเดิมไปทั้งชุด โหนดข้อความยังเป็นตัวเดิม เคอร์เซอร์จึงคืนตำแหน่งเดิมได้
function renameBlock(block: HTMLElement, tagName: string) {
  const renamed = document.createElement(tagName);
  if (block.className) renamed.className = block.className;
  const style = block.getAttribute("style");
  if (style) renamed.setAttribute("style", style);
  while (block.firstChild) renamed.append(block.firstChild);
  block.replaceWith(renamed);
  keepEditable(renamed);
  return renamed;
}

type SavedRange = { endContainer: Node; endOffset: number; startContainer: Node; startOffset: number };

export function saveRange(range: Range): SavedRange {
  return { endContainer: range.endContainer, endOffset: range.endOffset, startContainer: range.startContainer, startOffset: range.startOffset };
}

// คืนช่วงเลือกหลังเปลี่ยนแท็ก ถ้าจุดเดิมเป็นย่อหน้าที่ถูกแทนที่ไปแล้ว ใช้ย่อหน้าใหม่แทน
export function restoreRange(saved: SavedRange, replaced: Map<Node, Node>) {
  const resolve = (node: Node, offset: number): [Node, number] => {
    const mapped = replaced.get(node);
    if (mapped) return [mapped, Math.min(offset, mapped.childNodes.length)];
    return node.isConnected ? [node, offset] : [document.body, 0];
  };
  const [startNode, startOffset] = resolve(saved.startContainer, saved.startOffset);
  const [endNode, endOffset] = resolve(saved.endContainer, saved.endOffset);
  if (startNode === document.body || endNode === document.body) return null;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return range;
}

// ปุ่มหัวข้อทำงานกับทั้งย่อหน้าแบบสไตล์ใน Word ถ้าทุกย่อหน้าที่เลือกเป็นหัวข้ออยู่แล้วให้กลับเป็นย่อหน้าธรรมดา
export function toggleHeading(root: HTMLElement, range: Range) {
  const blocks = selectedBlocks(root, range).filter((block) => block.matches(textBlockSelector));
  if (!blocks.length) return false;
  const saved = saveRange(range);
  const tagName = blocks.every((block) => block.matches("h1,h2,h3")) ? "p" : "h2";
  const replaced = new Map<Node, Node>();
  blocks.forEach((block) => replaced.set(block, renameBlock(block, tagName)));
  restoreRange(saved, replaced);
  return true;
}

// ปุ่มรายการแปลงย่อหน้าที่เลือกเป็นข้อในรายการ ถ้าอยู่ในรายการอยู่แล้วให้ถอดกลับเป็นย่อหน้า
export function toggleList(root: HTMLElement, range: Range) {
  const blocks = selectedBlocks(root, range);
  const saved = saveRange(range);
  const replaced = new Map<Node, Node>();
  if (blocks.length && blocks.every((block) => block.tagName === "UL" || block.tagName === "OL")) {
    for (const list of blocks) {
      const items = Array.from(list.children).filter((item) => range.intersectsNode(item));
      if (!items.length) continue;
      // แยกรายการเป็นสามท่อน ข้อก่อนหน้าคงเป็นรายการ ข้อที่เลือกเป็นย่อหน้า ข้อที่เหลือเป็นรายการใหม่
      const tailList = list.cloneNode(false) as HTMLElement;
      for (let item = items.at(-1)?.nextElementSibling; item; item = items.at(-1)?.nextElementSibling) tailList.append(item);
      const paragraphs = items.map((item) => {
        const paragraph = renameBlock(item as HTMLElement, "p");
        replaced.set(item, paragraph);
        return paragraph;
      });
      list.after(...paragraphs, ...(tailList.children.length ? [tailList] : []));
      if (!list.children.length) list.remove();
    }
    restoreRange(saved, replaced);
    return true;
  }
  const convertible = blocks.filter((block) => block.matches(textBlockSelector));
  if (!convertible.length) return false;
  // ต่อท้ายรายการที่อยู่ติดกันข้างบน รายการเดิมจะได้ไม่ขาดเป็นสองชุด
  const previous = convertible[0].previousElementSibling;
  const list = previous?.tagName === "UL" ? previous as HTMLElement : document.createElement("ul");
  if (list !== previous) convertible[0].before(list);
  convertible.forEach((block) => {
    const item = renameBlock(block, "li");
    replaced.set(block, item);
    list.append(item);
  });
  restoreRange(saved, replaced);
  return true;
}

// Tab ในรายการเลื่อนข้อนั้นเข้าไปเป็นข้อย่อยของข้อก่อนหน้า เหมือน Word
export function indentListItem(item: HTMLLIElement) {
  const previous = item.previousElementSibling;
  if (!(previous instanceof HTMLLIElement)) return false;
  let sublist = previous.lastElementChild;
  if (!(sublist instanceof HTMLUListElement || sublist instanceof HTMLOListElement)) {
    sublist = document.createElement(item.parentElement?.tagName === "OL" ? "ol" : "ul");
    previous.append(sublist);
  }
  sublist.append(item);
  return true;
}

// Shift+Tab เลื่อนข้อย่อยออกมาหนึ่งชั้น ข้อที่อยู่ถัดลงไปในชั้นเดิมกลายเป็นข้อย่อยของข้อนี้ ลำดับจะไม่สลับ
export function outdentListItem(item: HTMLLIElement) {
  const list = item.parentElement;
  const parentItem = list?.parentElement;
  if (!list || !(parentItem instanceof HTMLLIElement)) return false;
  const following: Element[] = [];
  for (let next = item.nextElementSibling; next; next = next.nextElementSibling) following.push(next);
  if (following.length) {
    const sublist = list.cloneNode(false) as HTMLElement;
    sublist.append(...following);
    item.append(sublist);
  }
  parentItem.after(item);
  if (!list.children.length) list.remove();
  return true;
}

// ---- สีตัวอักษร ----
// แปลง rgb(...) ที่เบราว์เซอร์คืนมาเป็น #rrggbb ให้ช่องเลือกสีใช้ได้
export function cssColorToHex(value: string, fallback: string) {
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(value.trim());
  if (!match || match[4] === "0") return fallback;
  return `#${match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`;
}

// span ที่ช่วงเลือกคลุมข้อความทั้งหมดของมันพอดี เช่นคำที่เพิ่งเปลี่ยนสีไป
// เจอแล้วให้แก้สีของ span เดิม ไม่ครอบซ้อนเพิ่มทุกครั้งที่ลากในตัวเลือกสี
export function spanCoveringRange(range: Range) {
  const common = range.commonAncestorContainer;
  const element = common instanceof Element ? common : common.parentElement;
  const span = element?.closest<HTMLSpanElement>("span[style]:not([data-placeholder])");
  if (!span || range.toString() !== span.textContent || !span.textContent) return null;
  return span;
}

// เอาสไตล์ชนิดเดียวกันออกจากข้างใน ไม่งั้นสีเก่าของคำข้างในทับสีใหม่ที่เพิ่งเลือก
export function clearInnerStyles(element: HTMLElement, properties: string[]) {
  element.querySelectorAll<HTMLElement>("span[style]").forEach((inner) => {
    properties.forEach((property) => inner.style.removeProperty(property));
    if (inner.getAttribute("style")) return;
    inner.removeAttribute("style");
    if (!inner.className && !inner.dataset.placeholder) inner.replaceWith(...Array.from(inner.childNodes));
  });
}

// ---- วางข้อความจากที่อื่น ----
// เก็บไว้แค่โครงสร้างกับตัวหนา เอียง ขีดเส้นใต้ สไตล์อื่นจาก Word หรือเว็บทิ้งหมด
// ไม่งั้นสีหรือฟอนต์แปลก ๆ จะโผล่ในตัวแก้ไขแต่หายไปตอนบันทึก เพราะเซิร์ฟเวอร์กรองออก
const pastedBlockTags = new Set(["P", "H1", "H2", "H3", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH"]);
const pastedInlineTags: Record<string, string> = { B: "strong", STRONG: "strong", I: "em", EM: "em", U: "u" };
const droppedTags = new Set(["SCRIPT", "STYLE", "META", "LINK", "TITLE", "HEAD", "IFRAME", "OBJECT", "EMBED", "SVG", "IMG", "VIDEO", "AUDIO", "FORM", "INPUT", "BUTTON", "TEMPLATE"]);

export function cleanPastedHtml(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const fragment = document.createDocumentFragment();
  const copy = (source: Node, target: Node) => {
    if (source.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(source.nodeValue ?? ""));
      return;
    }
    if (!(source instanceof HTMLElement)) return;
    const tag = source.tagName;
    if (droppedTags.has(tag)) return;
    if (tag === "BR") {
      target.appendChild(document.createElement("br"));
      return;
    }
    let element: HTMLElement | null = null;
    if (pastedBlockTags.has(tag)) element = document.createElement(tag.toLowerCase());
    // Google Docs ครอบทั้งก้อนด้วย <b style="font-weight:normal"> ต้องไม่กลายเป็นตัวหนาทั้งหมด
    else if (pastedInlineTags[tag] && source.style.fontWeight !== "normal") element = document.createElement(pastedInlineTags[tag]);
    else if (tag === "SPAN") {
      // Google Docs บอกตัวหนาเอียงขีดเส้นใต้ผ่าน style ของ span
      const weight = Number.parseInt(source.style.fontWeight, 10);
      if (weight >= 600 || source.style.fontWeight === "bold") element = document.createElement("strong");
      else if (source.style.fontStyle === "italic") element = document.createElement("em");
      else if (source.style.textDecoration.includes("underline")) element = document.createElement("u");
    }
    if (element) {
      const colspan = source.getAttribute("colspan");
      const rowspan = source.getAttribute("rowspan");
      if (colspan && /^\d+$/.test(colspan)) element.setAttribute("colspan", colspan);
      if (rowspan && /^\d+$/.test(rowspan)) element.setAttribute("rowspan", rowspan);
      target.appendChild(element);
    }
    source.childNodes.forEach((child) => copy(child, element ?? target));
  };
  parsed.body.childNodes.forEach((child) => copy(child, fragment));
  return fragment;
}

// ข้อความล้วน บรรทัดเดียววางเป็นข้อความต่อกัน หลายบรรทัดแยกเป็นย่อหน้า
export function plainTextFragment(text: string) {
  const fragment = document.createDocumentFragment();
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  if (lines.length === 1) {
    fragment.append(text);
    return fragment;
  }
  lines.forEach((line) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    keepEditable(paragraph);
    fragment.append(paragraph);
  });
  return fragment;
}

export function hasBlockContent(fragment: DocumentFragment) {
  return Array.from(fragment.childNodes).some((node) => node instanceof HTMLElement && pastedBlockTags.has(node.tagName));
}

// วางย่อหน้าหลายย่อหน้าลงกลางย่อหน้าเดิม: ตัดย่อหน้าเดิมเป็นสองท่อนแล้ววางไว้ตรงกลาง
// ข้อความลอย ๆ ที่ไม่มีย่อหน้าครอบ ห่อด้วย <p> ก่อน จะได้ไม่ไปอยู่ในระดับเดียวกับย่อหน้า
export function insertBlocksAtCaret(root: HTMLElement, range: Range, fragment: DocumentFragment) {
  const blocks: Node[] = [];
  let loose: HTMLElement | null = null;
  Array.from(fragment.childNodes).forEach((node) => {
    if (node instanceof HTMLElement && pastedBlockTags.has(node.tagName)) {
      loose = null;
      blocks.push(node);
      return;
    }
    if (!loose) {
      loose = document.createElement("p");
      blocks.push(loose);
    }
    loose.append(node);
  });
  const block = topLevelBlock(root, range.startContainer);
  if (!block) {
    root.append(...blocks);
    return blocks.at(-1) ?? null;
  }
  const atStart = isAtBlockStart(block, range);
  const tail = atStart ? null : splitBlockAtCaret(block, range);
  if (atStart) block.before(...blocks);
  else block.after(...blocks);
  if (tail && isBlank(tail)) tail.remove();
  if (!atStart && isBlank(block)) block.remove();
  return blocks.at(-1) ?? null;
}

export { isBlank as isBlankBlock };
export type { SavedRange };
