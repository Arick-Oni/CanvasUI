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
  <title>Save the Children - Interactive Appeal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lato:wght@400;700;900&family=Montserrat:wght@600;700;800&family=Oswald:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #0f172a;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      font-family: 'Lato', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .viewport-wrapper {
      width: 100%;
      max-width: 1200px;
      overflow-x: hidden;
      display: flex;
      justify-content: center;
      padding: 24px 0;
    }
    .canvas-export {
      position: relative;
      width: ${CANVAS_W}px;
      height: ${CANVAS_H}px;
      background: #ffffff;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      border-radius: 8px;
      overflow: hidden;
      transform-origin: top center;
    }
    @media (max-width: 1240px) {
      .canvas-export {
        transform: scale(calc((100vw - 32px) / 1200));
        margin-bottom: calc(800px * (calc((100vw - 32px) / 1200) - 1));
      }
    }
    .interactive-hover {
      cursor: pointer !important;
      transition: transform 0.15s ease, box-shadow 0.15s ease !important;
    }
    .interactive-hover:hover {
      transform: scale(1.02) !important;
    }
  </style>
</head>
<body>
  <div class="viewport-wrapper">
    <div class="canvas-export">
${elements}
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      let currentAmount = 50;
      let frequency = 'Monthly';

      const allElements = document.querySelectorAll('.canvas-export > div');
      allElements.forEach(el => {
        const text = el.textContent.trim();
        if (text.startsWith('$') || text.includes('DONATE') || text.includes('GIVE') || text.includes('Monthly') || text.includes('Once')) {
          el.classList.add('interactive-hover');
        }

        // Amount Selection
        const match = text.match(/^\\$(\\d+)$/);
        if (match) {
          el.addEventListener('click', () => {
            currentAmount = parseInt(match[1]);
            allElements.forEach(other => {
              if (/^\\$\\d+$/.test(other.textContent.trim())) {
                other.style.borderColor = '#cbd5e1';
                other.style.backgroundColor = '#ffffff';
                other.style.color = '#111827';
                other.style.fontWeight = '600';
              }
            });
            el.style.borderColor = '#DA291C';
            el.style.backgroundColor = '#fef2f2';
            el.style.color = '#DA291C';
            el.style.fontWeight = '700';

            // Sync CTA button
            allElements.forEach(cta => {
              if (cta.textContent.includes('DONATE') || cta.textContent.includes('GIVE NOW')) {
                cta.textContent = 'DONATE $' + currentAmount + ' ' + frequency.toUpperCase();
              }
            });
          });
        }

        // Frequency Toggles
        if (text === 'Give Monthly' || text === 'Give Once') {
          el.addEventListener('click', () => {
            frequency = text.replace('Give ', '');
            allElements.forEach(cta => {
              if (cta.textContent.includes('DONATE')) {
                cta.textContent = 'DONATE $' + currentAmount + ' ' + frequency.toUpperCase();
              }
            });
          });
        }

        // Action confirmation
        if (text.includes('DONATE') || text.includes('GIVE NOW')) {
          el.addEventListener('click', () => {
            alert('❤️ Thank you for your emergency gift of $' + currentAmount + ' ' + frequency + '!\\n\\nYour support provides emergency food, clean water, and essential medical supplies to children in crisis via Save the Children.');
          });
        }
      });
    });
  </script>
</body>
</html>`;
}

export function exportToReact(objects: UIObject[]): string {
  const jsonObjects = JSON.stringify(objects, null, 2);

  return `'use client';

import React, { useState } from 'react';

// Save the Children Interactive Appeal Component
export default function SaveTheChildrenAppeal() {
  const [amount, setAmount] = useState<number>(50);
  const [frequency, setFrequency] = useState<'Monthly' | 'Once'>('Monthly');
  const [submitted, setSubmitted] = useState<boolean>(false);

  const amounts = [25, 50, 100, 250];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-900 flex flex-col items-center py-8 px-4 font-sans">
      {/* Container */}
      <div className="w-full max-w-6xl bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Navigation Bar */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <img
              src="/assets/stc/logos/logo_save_the_children_uk.svg"
              alt="Save the Children"
              className="h-10 w-auto object-contain"
            />
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
            <a href="#emergencies" className="hover:text-red-600 transition">Emergencies</a>
            <a href="#what-we-do" className="hover:text-red-600 transition">What We Do</a>
            <a href="#stories" className="hover:text-red-600 transition">Our Impact</a>
          </nav>
          <button
            onClick={() => window.scrollTo({ top: 300, behavior: 'smooth' })}
            className="bg-[#DA291C] hover:bg-red-700 text-white font-bold text-sm px-5 py-2.5 rounded-md transition shadow"
          >
            DONATE NOW
          </button>
        </header>

        {/* Hero Banner with Vignette */}
        <div className="relative min-h-[480px] flex items-center">
          <img
            src="/assets/stc/images/image_children-walk-down-the-destroyed-streets-of-k.jpg"
            alt="Children in crisis"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[1px]" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 md:p-12 w-full">
            {/* Left Narrative */}
            <div className="lg:col-span-7 flex flex-col justify-center text-white space-y-4">
              <div className="inline-flex items-center gap-2 bg-[#DA291C] text-white text-xs font-bold px-3 py-1 rounded w-fit uppercase tracking-wider">
                Urgent Crisis Appeal
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold uppercase font-['Oswald',sans-serif] leading-tight tracking-wide">
                Children in Crisis Cannot Wait for Peace
              </h1>
              <p className="text-slate-200 text-base md:text-lg leading-relaxed max-w-xl">
                Millions of children in Gaza, Sudan, and war-torn regions face starvation and displacement.
                Your urgent gift delivers life-saving therapeutic nutrition, clean drinking water, and trauma healthcare.
              </p>
            </div>

            {/* Right Donation Card */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-xl p-6 shadow-2xl border border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Make an Emergency Gift</h2>

                {/* Frequency Toggle */}
                <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-lg mb-4">
                  <button
                    onClick={() => setFrequency('Monthly')}
                    className={\`py-2 text-xs font-bold rounded-md transition \${frequency === 'Monthly' ? 'bg-[#DA291C] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}\`}
                  >
                    Give Monthly
                  </button>
                  <button
                    onClick={() => setFrequency('Once')}
                    className={\`py-2 text-xs font-bold rounded-md transition \${frequency === 'Once' ? 'bg-[#DA291C] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}\`}
                  >
                    Give Once
                  </button>
                </div>

                {/* Amount Matrix */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {amounts.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setAmount(amt)}
                      className={\`py-3 rounded-lg border font-bold text-sm transition \${
                        amount === amt
                          ? 'border-[#DA291C] bg-red-50 text-[#DA291C] shadow-sm ring-1 ring-red-500'
                          : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                      }\`}
                    >
                      \${amt}
                    </button>
                  ))}
                </div>

                {/* Impact Statement */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 mb-5 leading-relaxed">
                  <strong>\${amount}</strong> {frequency === 'Monthly' ? 'every month' : 'today'} can supply emergency food parcels and hygiene kits for children displaced by violence.
                </div>

                {/* Submit Action */}
                <button
                  onClick={() => setSubmitted(true)}
                  className="w-full bg-[#DA291C] hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-lg shadow-md transition text-sm uppercase tracking-wide"
                >
                  DONATE \${amount} {frequency.toUpperCase()}
                </button>

                {/* Trust Badges */}
                <div className="mt-4 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                  <span className="font-semibold text-[11px]">100% SECURE GIVING</span>
                  <div className="flex items-center gap-2">
                    <img src="/assets/stc/logos/logo_visa.svg" alt="Visa" className="h-5 w-auto" />
                    <img src="/assets/stc/logos/logo_mastercard.svg" alt="Mastercard" className="h-5 w-auto" />
                    <img src="/assets/stc/logos/logo_icon---paypal---color-ch11139104.webp" alt="PayPal" className="h-5 w-auto" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Impact Statistics */}
        <section className="bg-slate-50 py-10 px-8 border-t border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm text-center">
              <div className="text-4xl font-extrabold text-[#DA291C] font-['Oswald',sans-serif]">85%</div>
              <p className="text-sm font-medium text-slate-600 mt-2">
                Of total budget goes directly into humanitarian program services for children.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm text-center">
              <div className="text-4xl font-extrabold text-[#DA291C] font-['Oswald',sans-serif]">45M+</div>
              <p className="text-sm font-medium text-slate-600 mt-2">
                Children helped across emergency, nutrition, and education initiatives globally.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm text-center">
              <div className="text-4xl font-extrabold text-[#DA291C] font-['Oswald',sans-serif]">120+</div>
              <p className="text-sm font-medium text-slate-600 mt-2">
                Countries with active Save the Children crisis teams responding on the front lines.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Confirmation Modal */}
      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl text-center space-y-4">
            <div className="text-5xl">❤️</div>
            <h3 className="text-2xl font-bold text-slate-900">Thank You For Your Support</h3>
            <p className="text-sm text-slate-600">
              Your gift of <strong>\${amount} ({frequency})</strong> provides immediate emergency assistance to children living in crisis zones.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="w-full bg-[#DA291C] text-white font-bold py-2.5 rounded-lg hover:bg-red-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
`;
}
