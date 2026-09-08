"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Click Spark” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Spark Easing” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type SparkEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Spark” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type Spark = {
  angle: number;
  startTime: number;
  x: number;
  y: number;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Click Spark Props” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type ClickSparkProps = {
  children: ReactNode;
  duration?: number;
  easing?: SparkEasing;
  extraScale?: number;
  sparkColor?: string;
  sparkCount?: number;
  sparkRadius?: number;
  sparkSize?: number;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “ease” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - progress: ค่า “progress” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - easing: ค่า “easing” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function ease(progress: number, easing: SparkEasing) {
  switch (easing) {
    case "linear":
      return progress;
    case "ease-in":
      return progress * progress;
    case "ease-in-out":
      return progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;
    default:
      return progress * (2 - progress);
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Click Spark” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { children, duration = 420, easing = "ease-out", extraScale : ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function ClickSpark({
  children,
  duration = 420,
  easing = "ease-out",
  extraScale = 1,
  sparkColor = "#ec48bd",
  sparkCount = 8,
  sparkRadius = 18,
  sparkSize = 10,
}: ClickSparkProps) {
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotionRef = useRef(false);
  const sparksRef = useRef<Spark[]>([]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “resize Canvas” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * pixelRatio);
    canvas.height = Math.round(window.innerHeight * pixelRatio);
    canvas.getContext("2d")?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }, []);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “draw” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - timestamp: ค่า “timestamp” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const draw = useCallback(function drawFrame(timestamp: number) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      animationFrameRef.current = null;
      return;
    }

    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “active Sparks” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - spark: ค่า “spark” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
     */
    const activeSparks = sparksRef.current.filter((spark) => {
      const elapsed = timestamp - spark.startTime;
      if (elapsed >= duration) return false;

      const easedProgress = ease(elapsed / duration, easing);
      const distance = easedProgress * sparkRadius * extraScale;
      const lineLength = sparkSize * (1 - easedProgress);
      const cosine = Math.cos(spark.angle);
      const sine = Math.sin(spark.angle);

      context.beginPath();
      context.moveTo(spark.x + distance * cosine, spark.y + distance * sine);
      context.lineTo(
        spark.x + (distance + lineLength) * cosine,
        spark.y + (distance + lineLength) * sine,
      );
      context.lineCap = "round";
      context.lineWidth = 2;
      context.strokeStyle = sparkColor;
      context.stroke();
      return true;
    });

    sparksRef.current = activeSparks;
    animationFrameRef.current = activeSparks.length > 0
      ? window.requestAnimationFrame(drawFrame)
      : null;
  }, [duration, easing, extraScale, sparkColor, sparkRadius, sparkSize]);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Motion Preference” โดยใช้ค่าที่รับเข้ามา
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const updateMotionPreference = () => {
      reduceMotionRef.current = motionQuery.matches;
      if (motionQuery.matches) sparksRef.current = [];
    };

    updateMotionPreference();
    resizeCanvas();
    motionQuery.addEventListener("change", updateMotionPreference);
    window.addEventListener("resize", resizeCanvas, { passive: true });

    return () => {
      motionQuery.removeEventListener("change", updateMotionPreference);
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [resizeCanvas]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รับเหตุการณ์ “handle Pointer Down” จากผู้ใช้หรือระบบ แล้วเรียกขั้นตอนที่เกี่ยวข้อง
   * รับค่า:
   * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || reduceMotionRef.current) return;

    const startTime = performance.now();
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “new Sparks” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - _: ค่า “” ที่จำเป็นต่อการทำงานของก้อนนี้
     * - index: ค่า “index” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const newSparks = Array.from({ length: sparkCount }, (_, index) => ({
      angle: (2 * Math.PI * index) / sparkCount,
      startTime,
      x: event.clientX,
      y: event.clientY,
    }));
    sparksRef.current.push(...newSparks);

    if (animationFrameRef.current === null) {
      animationFrameRef.current = window.requestAnimationFrame(draw);
    }
  };

  return (
    <div className="click-spark-root" onPointerDown={handlePointerDown}>
      <canvas aria-hidden="true" className="click-spark-canvas" ref={canvasRef} />
      {children}
    </div>
  );
}
