import type { UIObject } from "./types";

const CANVAS_W = 1200;
const CANVAS_H = 800;

// Elevation → CSS box-shadow presets matching the Fabric shadow presets.
const SHADOW_CSS = [
  "",
  "box-shadow:0 2px 6px rgba(0,0,0,0.08);",
  "box-shadow:0 4px 18px rgba(0,0,0,0.10);",
  "box-shadow:0 8px 32px rgba(0,0,0,0.15);",
];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Build the inline style string for every element.
// Fabric's default originX/originY is "left"/"top", so obj.x/y ARE the
// top-left corner — they map directly to CSS left/top.
// Fabric rotates around the object's centre, so we match with
// transform-origin: center center.
function baseStyle(obj: UIObject, zIndex: number): string {
  const parts: string[] = [
    "position:absolute",
    `left:${obj.x}px`,
    `top:${obj.y}px`,
    `width:${obj.width}px`,
    `height:${obj.height}px`,
    `z-index:${zIndex}`,
    "box-sizing:border-box",
  ];
  if (obj.angle) {
    parts.push(`transform:rotate(${obj.angle}deg)`, "transform-origin:center center");
  }
  return parts.join(";") + ";";
}

export function exportToHTML(objects: UIObject[]): string {
  const sorted = [...objects].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

  const elements = sorted.map((obj, idx) => {
    const s = baseStyle(obj, idx);

    if (obj.type === "rect" || obj.type === "image") {
      const bg      = obj.type === "image" ? (obj.fill ?? "#f1f5f9") : (obj.fill ?? "#e2e8f0");
      const radius  = obj.radius  ? `border-radius:${obj.radius}px;`              : "";
      const shadow  = obj.elevation ? SHADOW_CSS[Math.min(obj.elevation, 3)]      : "";
      const border  = obj.stroke
        ? `border:${obj.strokeWidth ?? 1}px solid ${obj.stroke};`
        : "";

      if (obj.type === "image") {
        const isLogo =
          obj.role?.toLowerCase().includes("logo") ||
          obj.role?.toLowerCase().includes("badge") ||
          obj.src?.toLowerCase().includes("/logos/") ||
          obj.src?.toLowerCase().endsWith(".svg");
        if (obj.src) {
          return (
            `  <div style="${s}background:${bg};${radius}${shadow}${border}">` +
            `<img src="${esc(obj.src)}" alt="${esc(obj.alt || "")}" style="width:100%;height:100%;object-fit:${isLogo ? "contain" : "cover"};border-radius:${obj.radius ? obj.radius : 0}px;pointer-events:none;" draggable="false" /></div>`
          );
        } else {
          return (
            `  <div style="${s}background:${bg};${radius}${shadow}${border}` +
            `display:flex;align-items:center;justify-content:center;">` +
            `<span style="color:#94a3b8;font-size:12px;font-family:Inter,sans-serif;">image</span></div>`
          );
        }
      }
      return `  <div style="${s}background:${bg};${radius}${shadow}${border}"></div>`;
    }

    if (obj.type === "text") {
      const color  = obj.textColor ?? "#0f172a";
      const size   = obj.fontSize  ?? 14;
      const weight = obj.fontWeight ?? 400;
      const text   = esc(obj.text ?? "");
      const align  = obj.textAlign ?? (
        obj.role?.toLowerCase().includes("button") ||
        obj.role?.toLowerCase().includes("label") ||
        obj.role?.toLowerCase().includes("badge") ||
        obj.role?.toLowerCase().includes("pill")
          ? "center"
          : "left"
      );
      const isCentered = align === "center";
      const isRight = align === "right";
      const justify = isCentered ? "center" : isRight ? "flex-end" : "flex-start";
      const defaultFont = obj.role?.toLowerCase().includes("heading")
        ? "'Oswald', 'Montserrat', sans-serif"
        : "'Lato', 'Inter', sans-serif";
      const family = obj.fontFamily ?? defaultFont;

      return (
        `  <div style="${s}color:${color};font-size:${size}px;font-weight:${weight};` +
        `font-family:${family};margin:0;line-height:1.25;` +
        `display:flex;align-items:center;justify-content:${justify};text-align:${align};` +
        `white-space:pre-wrap;overflow:hidden;">${text}</div>`
      );
    }

    return "";
  }).filter(Boolean).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Design</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lato:wght@400;700;900&family=Montserrat:wght@600;700;800&family=Oswald:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 48px 0;
      background: #f8fafc;
      display: flex;
      justify-content: center;
      min-height: 100vh;
    }
    .canvas-export {
      position: relative;
      width: ${CANVAS_W}px;
      height: ${CANVAS_H}px;
      background: #ffffff;
      box-shadow: 0 4px 32px rgba(0,0,0,0.08);
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div class="canvas-export">
${elements}
  </div>
</body>
</html>`;
}
