/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “contrast” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { expect, type Locator } from "@playwright/test";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Contrast Kind” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ContrastKind = "border" | "foreground";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Contrast Measurement” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ContrastMeasurement = {
  background: string;
  foreground: string;
  ratio: number;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “measure Contrast” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - locator: ค่า “locator” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - kind: ค่า “kind” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<ContrastMeasurement> ตามสัญญา TypeScript ของฟังก์ชัน
 */
export async function measureContrast(locator: Locator, kind: ContrastKind = "foreground"): Promise<ContrastMeasurement> {
  return locator.evaluate((element, measurementKind) => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: type “Rgba” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
     */
    type Rgba = [number, number, number, number];
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: type “Rgb” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
     */
    type Rgb = [number, number, number];

    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: แปลงข้อมูลในขั้นตอน “parse Color” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
     * รับค่า:
     * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลชนิด Rgba ตามสัญญา TypeScript ของฟังก์ชัน
     */
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
      return [red, green, blue, alpha / 255];
    };
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “composite” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - foreground: ค่า “foreground” ที่จำเป็นต่อการทำงานของก้อนนี้
     * - background: ค่า “background” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลชนิด Rgb ตามสัญญา TypeScript ของฟังก์ชัน
     */
    const composite = (foreground: Rgba, background: Rgb): Rgb => [
      foreground[0] * foreground[3] + background[0] * (1 - foreground[3]),
      foreground[1] * foreground[3] + background[1] * (1 - foreground[3]),
      foreground[2] * foreground[3] + background[2] * (1 - foreground[3]),
    ];
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: สร้างผลลัพธ์สำหรับแสดงส่วน “rendered Background” บนหน้าจอ
     * รับค่า:
     * - start: ค่า “start” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลชนิด Rgb ตามสัญญา TypeScript ของฟังก์ชัน
     */
    const renderedBackground = (start: Element | null): Rgb => {
      const layers: Rgba[] = [];
      for (let current = start; current; current = current.parentElement) {
        const layer = parseColor(getComputedStyle(current).backgroundColor);
        if (layer[3] > 0) layers.push(layer);
        if (layer[3] >= 1) break;
      }
      return layers.reverse().reduce<Rgb>((result, layer) => composite(layer, result), [255, 255, 255]);
    };
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “linear” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
     */
    const linear = (value: number) => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “luminance” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - [red, green, blue]: ค่า “[red, green, blue]” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const luminance = ([red, green, blue]: Rgb) => 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: แปลงข้อมูลในขั้นตอน “serialize” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
     * รับค่า:
     * - color: ค่า “color” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const serialize = (color: Rgb) => `rgb(${color.map((value) => Math.round(value)).join(", ")})`;

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
      ratio: Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100,
    };
  }, kind);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “expect Contrast” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - locator: ค่า “locator” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - options: ตัวเลือกเพิ่มเติมที่ปรับพฤติกรรมของฟังก์ชัน
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export async function expectContrast(
  locator: Locator,
  options: { kind?: ContrastKind; minimum: number; name: string; state: string },
) {
  await expect(locator, `${options.name} must be visible before measuring contrast`).toBeVisible();
  const measurement = await measureContrast(locator, options.kind);
  expect(
    measurement.ratio,
    `${options.name} (${options.state}, ${options.kind ?? "foreground"}) uses ${measurement.foreground} on ${measurement.background}`,
  ).toBeGreaterThanOrEqual(options.minimum);
}
