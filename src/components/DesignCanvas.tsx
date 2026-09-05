"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from "react";
import Moveable from "react-moveable";
import { toJpeg } from "html-to-image";
import type { SelectedObjectProps, UIObject } from "@/lib/types";

export type DesignCanvasHandle = {
  renderObjects: (objects: UIObject[]) => void;
  clearCanvas: () => void;
  updateSelected: (changes: Partial<SelectedObjectProps>) => void;
  getSelectedAsUIObject: () => UIObject | null;
  replaceObject: (id: string, newObj: UIObject) => void;
  getAllObjects: () => UIObject[];
  getCanvasScreenshot: () => Promise<string>;
};

export type DesignCanvasProps = {
  onSelectionChange: (props: SelectedObjectProps | null) => void;
  previewMode?: boolean;
};

const CANVAS_W = 1200;
const CANVAS_H = 800;
const DISPLAY_W = 960;
const SCALE = DISPLAY_W / CANVAS_W; // 0.8

// ─── Module-level helpers ────────────────────────────────────────────────────

function extractProps(obj: UIObject): SelectedObjectProps {
  if (obj.type === "text") {
    return {
      objectType: "text",
      width: obj.width,
      height: obj.height,
      text: obj.text ?? "",
      fontSize: obj.fontSize ?? 14,
      fontWeight: String(obj.fontWeight ?? "400"),
      textColor: obj.textColor ?? "#0f172a",
      textAlign: obj.textAlign ?? "left",
      fontFamily: obj.fontFamily,
    };
  }
  if (obj.type === "image") {
    return {
      objectType: "image",
      width: obj.width,
      height: obj.height,
      src: obj.src,
      alt: obj.alt,
    };
  }
  return {
    objectType: "rect",
    width: obj.width,
    height: obj.height,
    fill: obj.fill ?? "#e2e8f0",
    radius: obj.radius ?? 0,
  };
}

const SHADOW_CSS = [
  "",
  "0 2px 6px rgba(0,0,0,0.08)",
  "0 4px 18px rgba(0,0,0,0.10)",
  "0 8px 32px rgba(0,0,0,0.15)",
];

// ─── Component ───────────────────────────────────────────────────────────────

const DesignCanvas = forwardRef<DesignCanvasHandle, DesignCanvasProps>(
  function DesignCanvas({ onSelectionChange, previewMode = false }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [objects, setObjects] = useState<UIObject[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Interactive Preview State
    const [donationAmount, setDonationAmount] = useState<number>(50);
    const [frequency, setFrequency] = useState<string>("Monthly");
    const [modalMessage, setModalMessage] = useState<string | null>(null);

    // Clear selection when entering preview mode
    useEffect(() => {
      if (previewMode) {
        setSelectedId(null);
        setEditingId(null);
      }
    }, [previewMode]);

    function handlePreviewClick(obj: UIObject) {
      const text = obj.text?.trim() || "";
      const role = obj.role?.toLowerCase() || "";

      // Amount Selection ($25, $50, $100, $250)
      const amtMatch = text.match(/^\$(\d+)$/);
      if (amtMatch) {
        const newAmt = parseInt(amtMatch[1]);
        setDonationAmount(newAmt);
        setObjects(prev => prev.map(o => {
          const oText = o.text?.trim() || "";
          if (/^\$\d+$/.test(oText)) {
            const isMatch = oText === `$${newAmt}`;
            return {
              ...o,
              textColor: isMatch ? "#DA291C" : "#111827",
              fontWeight: isMatch ? 700 : 600,
            };
          }
          // Highlight active button background rect if nearby
          if (o.role?.toLowerCase().includes("amount-button")) {
            const matchBtn = Math.abs(o.x - obj.x) < 20 && Math.abs(o.y - obj.y) < 20;
            return {
              ...o,
              fill: matchBtn ? "#fef2f2" : "#ffffff",
              stroke: matchBtn ? "#DA291C" : "#cbd5e1",
              strokeWidth: matchBtn ? 2 : 1,
            };
          }
          // Sync CTA button text
          if (o.text?.includes("DONATE") || o.text?.includes("GIVE NOW")) {
            return {
              ...o,
              text: `DONATE $${newAmt} ${frequency.toUpperCase()}`,
            };
          }
          return o;
        }));
        return;
      }

      // Frequency toggle (Give Monthly / Give Once)
      if (text === "Give Monthly" || text === "Give Once") {
        const newFreq = text.replace("Give ", "");
        setFrequency(newFreq);
        setObjects(prev => prev.map(o => {
          if (o.text?.includes("DONATE") || o.text?.includes("GIVE NOW")) {
            return {
              ...o,
              text: `DONATE $${donationAmount} ${newFreq.toUpperCase()}`,
            };
          }
          return o;
        }));
        return;
      }

      // Action click
      if (text.includes("DONATE") || text.includes("GIVE NOW") || role.includes("cta-button")) {
        setModalMessage(
          `❤️ Thank you for your emergency gift of $${donationAmount} (${frequency})!\n\nYour support provides immediate therapeutic nutrition, clean water, and thermal blankets to children in crisis via Save the Children.`
        );
      }
    }

    const onSelectionChangeRef = useRef(onSelectionChange);
    useEffect(() => { onSelectionChangeRef.current = onSelectionChange; }, [onSelectionChange]);

    const notifySelected = useCallback((id: string | null, objs: UIObject[] = objects) => {
      if (!id) {
        onSelectionChangeRef.current(null);
        return;
      }
      const obj = objs.find(o => o.id === id);
      if (obj) {
        onSelectionChangeRef.current(extractProps(obj));
      } else {
        onSelectionChangeRef.current(null);
      }
    }, [objects]);

    // We only want to notify the parent on selection *change*, not on every object update
    // to avoid excessive re-renders during drag/resize.
    const lastSelectedIdRef = useRef<string | null>(null);
    useEffect(() => {
      if (lastSelectedIdRef.current !== selectedId) {
        lastSelectedIdRef.current = selectedId;
        notifySelected(selectedId);
      }
    }, [selectedId, notifySelected]);

    // Keyboard delete
    useEffect(() => {
      function onKeyDown(e: KeyboardEvent) {
        if (e.key !== "Delete" && e.key !== "Backspace") return;
        const activeEl = document.activeElement as HTMLElement | null;
        if (!activeEl) return;
        const tag = activeEl.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (activeEl.isContentEditable) return;
        if (!selectedId) return;

        setObjects(prev => prev.filter(o => o.id !== selectedId));
        setSelectedId(null);
      }
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [selectedId]);

    useImperativeHandle(
      ref,
      () => ({
        renderObjects(newObjects: UIObject[]) {
          const sorted = [...newObjects].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
          // Assign sequential z index to ensure predictability
          const normalized = sorted.map((o, idx) => ({ ...o, z: idx }));
          setObjects(normalized);
          setSelectedId(null);
        },

        clearCanvas() {
          setObjects([]);
          setSelectedId(null);
        },

        updateSelected(changes: Partial<SelectedObjectProps>) {
          setObjects(prev => {
            const next = prev.map(o => {
              if (o.id !== selectedId) return o;
              const merged: UIObject = { ...o };
              if (changes.width !== undefined) merged.width = changes.width;
              if (changes.height !== undefined) merged.height = changes.height;
              if (changes.fill !== undefined) merged.fill = changes.fill;
              if (changes.radius !== undefined) merged.radius = changes.radius;
              if (changes.text !== undefined) merged.text = changes.text;
              if (changes.fontSize !== undefined) merged.fontSize = changes.fontSize;
              if (changes.fontWeight !== undefined) merged.fontWeight = Number(changes.fontWeight);
              if (changes.textColor !== undefined) merged.textColor = changes.textColor;
              return merged;
            });
            return next;
          });
        },

        getSelectedAsUIObject(): UIObject | null {
          return objects.find(o => o.id === selectedId) || null;
        },

        replaceObject(id: string, newObj: UIObject) {
          setObjects(prev => {
            let replaced = false;
            const next = prev.map(o => {
              if (o.id === id) {
                replaced = true;
                return { ...newObj, z: o.z }; // Preserve z order
              }
              return o;
            });
            if (!replaced) {
              next.push({ ...newObj, z: next.length });
            }
            return next;
          });
          setSelectedId(newObj.id);
        },

        getAllObjects(): UIObject[] {
          return objects;
        },

        async getCanvasScreenshot(): Promise<string> {
          if (!containerRef.current) return "";

          // hide moveable control before screenshot
          const oldSelectedId = selectedId;
          setSelectedId(null);
          // Wait for a frame to ensure React unmounts Moveable
          await new Promise(r => setTimeout(r, 50));

          // force white background temporarily
          const oldBg = containerRef.current.style.backgroundColor;
          const oldBgImg = containerRef.current.style.backgroundImage;
          containerRef.current.style.backgroundColor = "#ffffff";
          containerRef.current.style.backgroundImage = "none";

          try {
            const url = await toJpeg(containerRef.current, { quality: 0.85, width: CANVAS_W, height: CANVAS_H });
            return url;
          } finally {
            containerRef.current.style.backgroundColor = oldBg;
            containerRef.current.style.backgroundImage = oldBgImg;
            if (oldSelectedId) {
              setSelectedId(oldSelectedId);
            }
          }
        },
      }),
      [objects, selectedId]
    );

    // We render objects as normal DOM nodes matching exportToHTML styling
    const targetRef = useRef<HTMLDivElement | null>(null);

    return (
      <div
        style={{ width: DISPLAY_W, height: DISPLAY_W * (CANVAS_H / CANVAS_W), overflow: "hidden" }}
        className="rounded-xl border border-slate-200 shadow-sm"
      >
        <div
          ref={containerRef}
          style={{
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
            width: CANVAS_W,
            height: CANVAS_H,
            backgroundColor: "#ffffff",
            backgroundImage: "radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)",
            backgroundSize: "24px 24px",
            position: "relative",
          }}
          onClick={(e) => {
            if (e.target === containerRef.current) setSelectedId(null);
          }}
        >
          {objects.map((obj) => {
            const isSelected = obj.id === selectedId;
            const style: React.CSSProperties = {
              position: "absolute",
              left: obj.x,
              top: obj.y,
              width: obj.width,
              height: obj.height,
              zIndex: obj.z,
              boxSizing: "border-box",
              transform: obj.angle ? `rotate(${obj.angle}deg)` : undefined,
              transformOrigin: "center center",
            };

            let content = null;

            if (obj.type === "rect" || obj.type === "image") {
              const bg = obj.type === "image" ? (obj.fill ?? "#f1f5f9") : (obj.fill ?? "#e2e8f0");
              const shadow = obj.elevation ? SHADOW_CSS[Math.min(obj.elevation, 3)] : undefined;

              Object.assign(style, {
                background: bg,
                borderRadius: obj.radius ? `${obj.radius}px` : undefined,
                boxShadow: shadow,
                border: obj.stroke ? `${obj.strokeWidth ?? 1}px solid ${obj.stroke}` : undefined,
              });

              if (obj.type === "image") {
                if (obj.src) {
                  const isLogo =
                    obj.role?.toLowerCase().includes("logo") ||
                    obj.role?.toLowerCase().includes("badge") ||
                    obj.src.toLowerCase().includes("/logos/") ||
                    obj.src.toLowerCase().endsWith(".svg");
                  content = (
                    <img
                      src={obj.src}
                      alt={obj.alt || ""}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: isLogo ? "contain" : "cover",
                        borderRadius: obj.radius ? `${obj.radius}px` : 0,
                        pointerEvents: "none",
                      }}
                      draggable={false}
                    />
                  );
                } else {
                  Object.assign(style, {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  });
                  content = <span style={{ color: "#94a3b8", fontSize: "12px", fontFamily: "Inter, sans-serif" }}>image</span>;
                }
              }
            } else if (obj.type === "text") {
              const align = obj.textAlign ?? (
                obj.role?.toLowerCase().includes("button") ||
                obj.role?.toLowerCase().includes("label") ||
                obj.role?.toLowerCase().includes("badge") ||
                obj.role?.toLowerCase().includes("pill")
                  ? "center"
                  : "left"
              );
              const isCentered = align === "center";
              const isRight = align === "right";
              const defaultFont = obj.role?.toLowerCase().includes("heading")
                ? "'Oswald', 'Montserrat', sans-serif"
                : "'Lato', 'Inter', sans-serif";

              Object.assign(style, {
                color: obj.textColor ?? "#0f172a",
                fontSize: `${obj.fontSize ?? 14}px`,
                fontWeight: obj.fontWeight ?? 400,
                fontFamily: obj.fontFamily ?? defaultFont,
                display: "flex",
                alignItems: "center",
                justifyContent: isCentered ? "center" : isRight ? "flex-end" : "flex-start",
                textAlign: align,
                letterSpacing: obj.role?.toLowerCase().includes("badge") || (obj.role?.toLowerCase().includes("heading") && (obj.fontWeight ?? 400) >= 600) ? "0.02em" : "normal",
                margin: 0,
                lineHeight: 1.25,
                whiteSpace: "pre-wrap",
                overflow: "hidden",
                outline: "none", // Prevent focus ring when editing
                cursor: editingId === obj.id ? "text" : "default",
              });
              content = obj.text;
            }

            const isInteractive = previewMode && (
              obj.text?.startsWith("$") ||
              obj.text?.includes("DONATE") ||
              obj.text?.includes("GIVE") ||
              obj.text?.includes("Monthly") ||
              obj.text?.includes("Once") ||
              obj.role?.includes("button") ||
              obj.role?.includes("cta")
            );

            if (previewMode) {
              style.cursor = isInteractive ? "pointer" : "default";
              if (isInteractive) {
                style.transition = "transform 0.15s ease, box-shadow 0.15s ease";
              }
            }

            return (
              <div
                key={obj.id}
                id={obj.id}
                className={`canvas-object ${isInteractive ? "hover:scale-[1.02] hover:brightness-105" : ""}`}
                ref={!previewMode && isSelected ? targetRef : undefined}
                style={style}
                contentEditable={!previewMode && editingId === obj.id}
                suppressContentEditableWarning={true}
                onClick={(e) => {
                  e.stopPropagation();
                  if (previewMode) {
                    handlePreviewClick(obj);
                    return;
                  }
                  if (editingId !== obj.id) setSelectedId(obj.id);
                }}
                onDoubleClick={(e) => {
                  if (previewMode) return;
                  if (obj.type === "text") {
                    e.stopPropagation();
                    setEditingId(obj.id);
                    // Focus the element so the cursor appears
                    setTimeout(() => {
                      const el = document.getElementById(obj.id);
                      if (el) el.focus();
                    }, 0);
                  }
                }}
                onBlur={(e) => {
                  if (editingId === obj.id) {
                    setEditingId(null);
                    const newText = e.currentTarget.textContent || "";
                    setObjects((prev) =>
                      prev.map((o) => (o.id === obj.id ? { ...o, text: newText } : o))
                    );
                    // Update external selection props if it's selected
                    if (selectedId === obj.id) {
                      const o = objects.find((x) => x.id === obj.id);
                      if (o) onSelectionChangeRef.current(extractProps({ ...o, text: newText }));
                    }
                  }
                }}
              >
                {content}
              </div>
            );
          })}

          {!previewMode && selectedId && !editingId && targetRef.current && (
             <Moveable
               target={targetRef.current}
               container={containerRef.current}
               draggable={true}
               resizable={true}
               rotatable={true}
               origin={false}
               onDrag={({ target, left, top }) => {
                 target.style.left = `${left}px`;
                 target.style.top = `${top}px`;
               }}
               onDragEnd={({ target }) => {
                 const x = parseInt(target.style.left, 10);
                 const y = parseInt(target.style.top, 10);
                 setObjects(prev => prev.map(o => (o.id === selectedId ? { ...o, x, y } : o)));
               }}
               onResize={({ target, width, height, drag }) => {
                 target.style.width = `${width}px`;
                 target.style.height = `${height}px`;
                 target.style.left = `${drag.left}px`;
                 target.style.top = `${drag.top}px`;
               }}
               onResizeEnd={({ target }) => {
                 const w = parseInt(target.style.width, 10);
                 const h = parseInt(target.style.height, 10);
                 const x = parseInt(target.style.left, 10);
                 const y = parseInt(target.style.top, 10);
                 setObjects(prev => prev.map(o => (o.id === selectedId ? { ...o, width: w, height: h, x, y } : o)));
               }}
               onRotate={({ target, transform, rotation }) => {
                 target.style.transform = transform;
               }}
               onRotateEnd={({ target }) => {
                 const match = target.style.transform.match(/rotate\((.+?)deg\)/);
                 if (match && match[1]) {
                   const angle = Math.round(parseFloat(match[1]) * 100) / 100;
                   setObjects(prev => prev.map(o => (o.id === selectedId ? { ...o, angle } : o)));
                 }
               }}
             />
          )}

          {/* Donation Confirmed Modal for Live Preview */}
          {modalMessage && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
                <div className="text-4xl">❤️</div>
                <h3 className="text-xl font-bold text-slate-900">Donation Confirmed</h3>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {modalMessage}
                </p>
                <button
                  onClick={() => setModalMessage(null)}
                  className="w-full bg-[#DA291C] hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition text-xs uppercase"
                >
                  Close & Continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

export default DesignCanvas;
