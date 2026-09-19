import { expect, type Locator } from "@playwright/test";

// วัดสีตัวอักษรหรือสีเส้นขอบ เส้นขอบต้องเทียบกับพื้นหลังของตัวแม่ ไม่ใช่ของตัวเอง
export type ContrastKind = "border" | "foreground";

export type ContrastMeasurement = {
  background: string;
  foreground: string;
  ratio: number;
};

// วัดอัตราส่วนความต่างของสีตามสูตรของ WCAG ใช้เช็คว่าข้อความอ่านออกจริงไหม
// ทั้งก้อนรันในเบราว์เซอร์ผ่าน evaluate เพราะต้องใช้สีที่เรนเดอร์จริงหลังคำนวณ CSS ครบแล้ว
export async function measureContrast(locator: Locator, kind: ContrastKind = "foreground"): Promise<ContrastMeasurement> {
  return locator.evaluate((element, measurementKind) => {
    type Rgba = [number, number, number, number];
    type Rgb = [number, number, number];

    // ยืมมือ canvas แปลงสี CSS ทุกรูปแบบเป็นตัวเลข rgba ไม่ต้องเขียนตัวแปลงเอง
    // รองรับได้หมดทั้ง hex, rgb(), hsl() และชื่อสี เพราะเบราว์เซอร์แปลงให้
    const parseColor = (value: string): Rgba => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas 2D is required to measure contrast");
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      // canvas คืนความโปร่งใสมาเป็น 0-255 แต่ฝั่ง CSS ใช้ 0-1 จึงต้องหารกลับ
      return [red, green, blue, alpha / 255];
    };
    // ซ้อนสีโปร่งใสลงบนพื้นหลัง ได้สีที่ตาเห็นจริง สูตรมาตรฐานของการผสมสีแบบ alpha
    const composite = (foreground: Rgba, background: Rgb): Rgb => [
      foreground[0] * foreground[3] + background[0] * (1 - foreground[3]),
      foreground[1] * foreground[3] + background[1] * (1 - foreground[3]),
      foreground[2] * foreground[3] + background[2] * (1 - foreground[3]),
    ];
    // หาสีพื้นหลังที่เห็นจริง ต้องไล่ขึ้นไปหาตัวแม่เพราะตัวเองอาจโปร่งใสหรือกึ่งโปร่งใส
    const renderedBackground = (start: Element | null): Rgb => {
      const layers: Rgba[] = [];
      for (let current = start; current; current = current.parentElement) {
        const layer = parseColor(getComputedStyle(current).backgroundColor);
        if (layer[3] > 0) layers.push(layer);
        // เจอชั้นที่ทึบแล้วก็หยุด ชั้นที่อยู่เหนือขึ้นไปมองไม่เห็นอยู่ดี
        if (layer[3] >= 1) break;
      }
      // ผสมจากชั้นล่างสุดขึ้นมา เริ่มที่สีขาวเพราะเป็นสีพื้นหลังเริ่มต้นของหน้าเว็บ
      return layers.reverse().reduce<Rgb>((result, layer) => composite(layer, result), [255, 255, 255]);
    };
    // แปลงค่าสีจากที่เก็บไว้ให้เป็นค่าความสว่างเชิงเส้น ตัวเลข 0.04045 กับ 2.4 มาจากสเปก sRGB
    const linear = (value: number) => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    // ถ่วงน้ำหนักสีเขียวมากที่สุดเพราะตาคนไวต่อสีเขียวกว่าสีอื่น เป็นค่าตามสูตรของ WCAG
    const luminance = ([red, green, blue]: Rgb) => 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
    const serialize = (color: Rgb) => `rgb(${color.map((value) => Math.round(value)).join(", ")})`;

    // getComputedStyle ให้สีสุดท้ายหลังคำนวณ CSS ทุกกฎแล้ว ไม่ใช่ค่าที่เขียนไว้ในไฟล์
    const style = getComputedStyle(element);
    const background = measurementKind === "border"
      ? renderedBackground(element.parentElement)
      : renderedBackground(element);
    const source = parseColor(measurementKind === "border" ? style.borderTopColor : style.color);
    const foreground = composite(source, background);
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));

    return {
      background: serialize(background),
      foreground: serialize(foreground),
      // สูตรอัตราส่วนของ WCAG บวก 0.05 กันการหารด้วยศูนย์ตอนพื้นดำสนิท ปัดเหลือสองตำแหน่ง
      ratio: Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100,
    };
  }, kind);
}

// ตัวช่วยที่วัดแล้วเช็คให้เลย ถ้าไม่ผ่านจะบอกค่าสีจริงที่วัดได้ ไม่ใช่แค่บอกว่าเลขน้อยไป
export async function expectContrast(
  locator: Locator,
  options: { kind?: ContrastKind; minimum: number; name: string; state: string },
) {
  // ต้องมองเห็นก่อนถึงวัดได้ ของที่ซ่อนอยู่จะวัดได้ค่าที่ไม่มีความหมาย
  await expect(locator, `${options.name} must be visible before measuring contrast`).toBeVisible();
  const measurement = await measureContrast(locator, options.kind);
  expect(
    measurement.ratio,
    `${options.name} (${options.state}, ${options.kind ?? "foreground"}) uses ${measurement.foreground} on ${measurement.background}`,
  ).toBeGreaterThanOrEqual(options.minimum);
}
