// เติมตัวนำหน้าให้ทุก selector ในรายการเดียว เช่น "p, h1" กลายเป็น ".document p, .document h1"
// ทำให้สไตล์ของเอกสารไม่ไปกระทบส่วนอื่นของหน้าตอนแสดงในตัวแก้ไข
function selector(scope: string, value: string) {
  const trimmedScope = scope.trim();
  // ไม่ได้ส่ง scope มาก็คืน selector เดิม ไม่ใช่เว้นวรรคนำหน้าลอย ๆ
  const prefix = trimmedScope ? `${trimmedScope} ` : "";
  return value
    .split(",")
    .map((item) => `${prefix}${item.trim()}`)
    .join(",");
}

export function getDocumentContentCss(scope = "") {
  const rule = (selectors: string, declarations: string) =>
    `${selector(scope, selectors)}{${declarations}}`;

  return [
    rule(".document", "width:100%"),
    rule("h1,h2,h3,p", "margin-top:0"),
    rule("h1", "font-size:28px;line-height:1.2"),
    rule("h2", "font-size:22px;line-height:1.25"),
    rule("h3", "font-size:18px;line-height:1.3"),
    rule(".document-title", "font-size:24px;line-height:1.3;margin-bottom:24px;text-align:center"),
    rule(".document-row", "display:flex;gap:24px;justify-content:space-between;margin:8px 0"),
    rule(".document-label", "color:#555"),
    rule(".document-value", "font-weight:700"),
    rule(".document-total", "border-top:2px solid #222;font-size:18px;font-weight:700;margin-top:16px;padding-top:12px"),
    rule(".signature-grid", "display:grid;gap:48px;grid-template-columns:1fr 1fr;margin-top:64px"),
    rule(".signature-line", "border-top:1px solid #555;padding-top:8px;text-align:center"),
    rule(".text-left", "text-align:left"),
    rule(".text-center", "text-align:center"),
    rule(".text-right", "text-align:right"),
    rule(".text-red", "color:#b42318"),
    rule(".text-blue", "color:#175cd3"),
    rule(".text-green", "color:#067647"),
    rule(".text-muted", "color:#667085"),
    rule(".text-sm", "font-size:12px"),
    rule(".text-base", "font-size:14px"),
    rule(".text-lg", "font-size:18px"),
    rule(".text-xl", "font-size:24px"),
    rule(".document-image", "display:block;height:auto;margin:12px auto;max-width:100%"),
    rule(".page-break", "break-before:page"),
    rule("hr", "border:0;border-top:1px solid #bbb;margin:16px 0"),
    rule("table", "border-collapse:collapse;margin:14px 0;width:100%"),
    rule("th,td", "border:1px solid #bbb;padding:8px;vertical-align:top"),
    rule("ul,ol", "padding-left:24px"),
  ].join("");
}
