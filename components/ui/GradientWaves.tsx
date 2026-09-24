"use client";
// ใช้ WebGL วาดลงบน canvas จึงต้องทำงานฝั่งเบราว์เซอร์

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

// ยิ่งละเอียดยิ่งสวยแต่กินการ์ดจอมากขึ้น ดูค่าจริงได้ที่ detailToSteps
type GradientWavesDetail = "low" | "medium" | "high";

// ทุกตัวมีค่าเริ่มต้นให้แล้ว ส่งมาเฉพาะตัวที่อยากปรับ
type GradientWavesProps = {
  amplitude?: number;
  brightness?: number;
  className?: string;
  crestColor?: string;
  detail?: GradientWavesDetail;
  fogDepth?: number;
  grain?: boolean;
  grainIntensity?: number;
  height?: number;
  horizonColor?: string;
  mouseInteraction?: boolean;
  opacity?: number;
  parallaxStrength?: number;
  speed?: number;
  swell?: number;
  tilt?: number;
  turbulence?: number;
  waveColor?: string;
  waveRatio?: number;
  waveScale?: number;
  zoom?: number;
};

// vertex shader ไม่ทำอะไรเลย แค่ส่งสามเหลี่ยมที่คลุมทั้งจอต่อไป งานจริงอยู่ที่ fragment shader
const vertexShader = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// fragment shader คำนวณสีทีละจุดบนจอ ตัวนี้คือที่มาของลายคลื่นทั้งหมด
const fragmentShader = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaveScale;
uniform float uWaveRatio;
uniform float uSwell;
uniform float uTurbulence;
uniform float uTilt;
uniform float uZoom;
uniform float uHeight;
uniform float uFogDepth;
uniform float uSteps;
uniform float uBrightness;
uniform float uOpacity;
uniform float uGrain;
uniform float uGrainIntensity;
uniform vec2 uMouse;
uniform float uParallax;
uniform bool uEnableMouse;
uniform vec3 uHorizonColor;
uniform vec3 uWaveColor;
uniform vec3 uCrestColor;
out vec4 fragColor;

const float MAX_DIST = 20000.0;

// สุ่มเลขจากพิกัด ใช้ทำเกรนให้ภาพไม่เนียนเกินจนเห็นเป็นวงสี
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// บอกว่าจุดนี้อยู่ห่างจากผิวคลื่นเท่าไร ติดลบคือจมอยู่ใต้ผิว
float plasma(vec3 r, vec2 freq, vec4 tc) {
  float mx = r.x + tc.x;
  mx += uSwell * sin((r.y + mx) / 20.0 + tc.y);
  float my = r.y - tc.z;
  my += uTurbulence * cos(r.x / 23.0 + tc.w);
  return r.z - (sin(mx * freq.x) * uAmplitude + sin(my * freq.y) * uAmplitude + uHeight);
}

// ยิงเส้นจากกล้องแล้วคืบไปทีละก้าวจนชนผิวคลื่น ได้ระยะทางไปคำนวณสีต่อ
float raymarch(vec3 pos, vec3 dir, vec2 freq, vec4 tc) {
  float dist = 0.0;
  // 128 คือเพดานตายตัวที่ GLSL ต้องรู้ตอนคอมไพล์ ส่วน uSteps คือจำนวนก้าวจริงที่ใช้
  for (int i = 0; i < 128; i++) {
    if (float(i) >= uSteps) break;
    float dscene = plasma(pos + dist * dir, freq, tc);
    // ใกล้ผิวพอแล้วก็หยุด ไม่ต้องคืบต่อให้เปลืองแรง
    if (abs(dscene) < 0.1) break;
    dist += 0.9 * dscene;
    if (!(abs(dist) < MAX_DIST)) return MAX_DIST;
  }
  return dist;
}

void main() {
  float T = iTime * uSpeed;
  vec2 freq = vec2(uWaveScale / 7.0, (uWaveScale * uWaveRatio) / 3.0);
  vec4 tc = vec4(T / 0.130, T / 0.810, T / 0.200, T / 0.710);
  float c, s;
  float vfov = (3.14159 / 2.3) / max(uZoom, 0.05);
  vec3 cam = vec3(0.0, 0.0, 30.0);
  vec2 uv = (gl_FragCoord.xy / iResolution.xy) - 0.5;
  uv.x *= iResolution.x / iResolution.y;
  uv.y *= -1.0;

  vec3 dir = vec3(0.0, 0.0, -1.0);
  float ulen = length(uv);
  float xrot = vfov * ulen;
  c = cos(xrot); s = sin(xrot);
  dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  vec2 nuv = ulen > 1e-5 ? uv / ulen : vec2(1.0, 0.0);
  c = nuv.x; s = nuv.y;
  dir = mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0) * dir;
  c = cos(uTilt); s = sin(uTilt);
  dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;

  if (uEnableMouse) {
    float yaw = (uMouse.x - 0.5) * uParallax * 0.4;
    float pitch = (uMouse.y - 0.5) * uParallax * 0.4;
    c = cos(yaw); s = sin(yaw);
    dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;
    c = cos(pitch); s = sin(pitch);
    dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  }

  float dist = raymarch(cam, dir, freq, tc);
  vec3 pos = cam + dist * dir;
  float t = clamp(uFogDepth / max(dist, 0.001), 0.0, 1.0);
  vec3 body = mix(uWaveColor, uCrestColor, clamp(pos.z * 0.08 + 0.5, 0.0, 1.0));
  vec3 col = mix(uHorizonColor, body, t);
  col *= uBrightness;
  col = clamp(col, 0.0, 1.0);

  float alpha = clamp(t, 0.0, 1.0) * uOpacity;
  if (uGrain > 0.5) {
    float g = hash21(gl_FragCoord.xy + mod(iTime, 64.0) * 11.0);
    alpha += (g - 0.5) * uGrainIntensity;
  }
  alpha = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(col * alpha, alpha);
}
`;

// shader รับสีเป็นเลข 0-1 ไม่ใช่ #rrggbb จึงต้องแปลงก่อนส่งเข้าไป
function hexToRgb(hex: string): Float32Array {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  // รูปแบบสีผิดก็คืนสีขาวไปก่อน ดีกว่าปล่อยให้ shader พังทั้งจอ
  if (!match) return new Float32Array([1, 1, 1]);

  return new Float32Array([
    Number.parseInt(match[1], 16) / 255,
    Number.parseInt(match[2], 16) / 255,
    Number.parseInt(match[3], 16) / 255,
  ]);
}

// แปลงระดับความละเอียดเป็นจำนวนก้าวของ raymarch ยิ่งมากยิ่งคมแต่ยิ่งหนัก
function detailToSteps(detail: GradientWavesDetail): number {
  if (detail === "low") return 40;
  if (detail === "high") return 110;
  return 70;
}

// พื้นหลังคลื่นไล่สีของหน้าเข้าสู่ระบบ เป็นภาพประดับล้วน ไม่มีข้อมูลอยู่ในนั้น
export function GradientWaves({
  amplitude = 2.5,
  brightness = 1,
  className = "",
  crestColor = "#FFFFFF",
  detail = "medium",
  fogDepth = 15,
  grain = true,
  grainIntensity = 0.05,
  height = 5.5,
  horizonColor = "#5227FF",
  mouseInteraction = true,
  opacity = 1,
  parallaxStrength = 0.5,
  speed = 0.4,
  swell = 35,
  tilt = 1.11,
  turbulence = 20,
  waveColor = "#FF9FFC",
  waveRatio = 0.9,
  waveScale = 0.6,
  zoom = 1,
}: Readonly<GradientWavesProps>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        alpha: true,
        antialias: false,
        // จำกัดความละเอียดไว้ที่ 1.5 เท่า จอ Retina จะได้ไม่ต้องวาดพิกเซลเยอะจนเครื่องร้อน
        dpr: Math.min(window.devicePixelRatio || 1, 1.5),
        premultipliedAlpha: true,
        webgl: 2,
      });
    } catch {
      // เครื่องที่ไม่รองรับ WebGL 2 ก็ปล่อยพื้นหลังว่างไป ไม่ต้องทำให้หน้าเข้าสู่ระบบพัง
      return;
    }

    const gl = renderer.gl;
    // สร้าง canvas เองแล้วยัดเข้า container แทนที่จะให้ React วาด เพราะ ogl เป็นคนคุมมัน
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.display = "block";
    canvas.style.height = "100%";
    canvas.style.width = "100%";
    // พื้นหลังโปร่งใส เนื้อหาที่วางทับข้างบนจะได้มองทะลุเห็นคลื่น
    gl.clearColor(0, 0, 0, 0);
    container.appendChild(canvas);

    // uniforms คือค่าที่ส่งจาก JavaScript เข้าไปให้ shader ใช้ ชื่อต้องตรงกับที่ประกาศไว้ข้างบน
    const uniforms = {
      iResolution: { value: new Float32Array([1, 1]) },
      iTime: { value: 0 },
      uAmplitude: { value: amplitude },
      uBrightness: { value: brightness },
      uCrestColor: { value: hexToRgb(crestColor) },
      uEnableMouse: { value: mouseInteraction },
      uFogDepth: { value: fogDepth },
      uGrain: { value: grain ? 1 : 0 },
      uGrainIntensity: { value: grainIntensity },
      uHeight: { value: height },
      uHorizonColor: { value: hexToRgb(horizonColor) },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uOpacity: { value: opacity },
      uParallax: { value: parallaxStrength },
      uSpeed: { value: speed },
      uSteps: { value: detailToSteps(detail) },
      uSwell: { value: swell },
      uTilt: { value: tilt },
      uTurbulence: { value: turbulence },
      uWaveColor: { value: hexToRgb(waveColor) },
      uWaveRatio: { value: waveRatio },
      uWaveScale: { value: waveScale },
      uZoom: { value: zoom },
    };

    // สามเหลี่ยมใหญ่อันเดียวที่คลุมทั้งจอ ถูกกว่าใช้สี่เหลี่ยมสองอัน
    const geometry = new Triangle(gl);
    const program = new Program(gl, { fragment: fragmentShader, uniforms, vertex: vertexShader });
    const mesh = new Mesh(gl, { geometry, program });
    // คนที่ตั้งเครื่องไว้ว่าไม่อยากเห็นภาพเคลื่อนไหว จะได้เห็นเป็นภาพนิ่งแทน
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const startTime = performance.now();
    let animationFrame = 0;
    let isPageVisible = !document.hidden;
    let isVisible = true;
    let reduceMotion = reduceMotionQuery.matches;

    const draw = (time = startTime) => {
      // ตรึงเวลาไว้ที่ 0 ตอนปิดภาพเคลื่อนไหว คลื่นจะหยุดนิ่งแต่ยังเห็นภาพอยู่
      uniforms.iTime.value = reduceMotion ? 0 : (time - startTime) * 0.001;
      renderer.render({ scene: mesh });
    };

    const stop = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    // วาดหนึ่งเฟรมแล้วค่อยขอเฟรมถัดไป หยุดทันทีเมื่อไม่มีใครเห็น จะได้ไม่กินแบตเปล่า
    const animate = (time: number) => {
      animationFrame = 0;
      draw(time);
      if (isPageVisible && isVisible && !reduceMotion) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    const start = () => {
      // เช็ค animationFrame ก่อน กันเรียกซ้ำจนมีลูปวาดซ้อนกันสองชุด
      if (!animationFrame && isPageVisible && isVisible && !reduceMotion) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    const resize = () => {
      const { height: nextHeight, width: nextWidth } = container.getBoundingClientRect();
      // อย่างน้อย 1 พิกเซล เพราะขนาด 0 ทำให้ WebGL error ตอนกล่องยังไม่มีขนาด
      renderer.setSize(Math.max(1, nextWidth), Math.max(1, nextHeight));
      // ใช้ขนาดจริงของบัฟเฟอร์ ไม่ใช่ขนาด CSS เพราะสองค่านี้ต่างกันบนจอความละเอียดสูง
      uniforms.iResolution.value[0] = gl.drawingBufferWidth;
      uniforms.iResolution.value[1] = gl.drawingBufferHeight;
      // ตอนภาพหยุดอยู่ ต้องสั่งวาดเองหนึ่งครั้ง ไม่งั้นขนาดใหม่จะไม่ขึ้น
      if (!animationFrame) draw();
    };

    // ส่งตำแหน่งเมาส์เป็นสัดส่วน 0-1 ให้ shader เอียงกล้องตาม
    const handlePointerMove = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect();
      uniforms.uMouse.value[0] = (event.clientX - bounds.left) / bounds.width;
      // กลับแกน y เพราะ WebGL นับจากล่างขึ้นบน แต่ DOM นับจากบนลงล่าง
      uniforms.uMouse.value[1] = 1 - (event.clientY - bounds.top) / bounds.height;
    };

    // สลับไปแท็บอื่นก็หยุดวาด กลับมาค่อยวาดต่อ
    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) start();
      else stop();
    };

    // ผู้ใช้เปลี่ยนการตั้งค่าระหว่างเปิดหน้าอยู่ก็ปรับตามทันที ไม่ต้องรีเฟรช
    const handleReducedMotionChange = () => {
      reduceMotion = reduceMotionQuery.matches;
      if (reduceMotion) {
        stop();
        draw();
      } else {
        start();
      }
    };

    // ตามขนาดกล่องแทนการฟัง resize ของหน้าต่าง เพราะกล่องอาจเปลี่ยนขนาดเองได้
    const resizeObserver = new ResizeObserver(resize);
    // เลื่อนจนพื้นหลังพ้นจอก็หยุดวาด
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) start();
      else stop();
    });

    resizeObserver.observe(container);
    intersectionObserver.observe(container);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reduceMotionQuery.addEventListener("change", handleReducedMotionChange);
    if (mouseInteraction) container.addEventListener("pointermove", handlePointerMove);

    resize();
    start();

    // เก็บกวาดให้ครบทุกอย่างตอนออกจากหน้า ไม่งั้น listener กับ context ของการ์ดจอจะค้าง
    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reduceMotionQuery.removeEventListener("change", handleReducedMotionChange);
      container.removeEventListener("pointermove", handlePointerMove);
      if (canvas.parentElement === container) canvas.remove();
      // คืน WebGL context ให้เบราว์เซอร์ทันที เพราะแต่ละแท็บเปิดได้จำกัดจำนวน
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [
    amplitude,
    brightness,
    crestColor,
    detail,
    fogDepth,
    grain,
    grainIntensity,
    height,
    horizonColor,
    mouseInteraction,
    opacity,
    parallaxStrength,
    speed,
    swell,
    tilt,
    turbulence,
    waveColor,
    waveRatio,
    waveScale,
    zoom,
  ]);

  // aria-hidden เพราะเป็นภาพประดับล้วน โปรแกรมอ่านหน้าจอไม่ต้องสนใจ
  return <div ref={containerRef} aria-hidden="true" className={`gradient-waves-container ${className}`.trim()} />;
}
