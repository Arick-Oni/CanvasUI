"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as fabric from "fabric";
import type { SelectedObjectProps, UIObject } from "@/lib/types";

export type DesignCanvasHandle = {
  renderObjects: (objects: UIObject[]) => void;
  clearCanvas: () => void;
  updateSelected: (changes: Partial<SelectedObjectProps>) => void;
  getSelectedAsUIObject: () => UIObject | null;
  replaceObject: (id: string, newObj: UIObject) => void;
  getAllObjects: () => UIObject[];
  getCanvasScreenshot: () => string;
};

export type DesignCanvasProps = {
  onSelectionChange: (props: SelectedObjectProps | null) => void;
};

const CANVAS_W = 1200;
const CANVAS_H = 800;
const DISPLAY_W = 960;
const SCALE = DISPLAY_W / CANVAS_W; // 0.8

// ─── Module-level helpers ────────────────────────────────────────────────────

function extractProps(obj: fabric.FabricObject): SelectedObjectProps {
  const width = Math.round(obj.width * (obj.scaleX ?? 1));
  const height = Math.round(obj.height * (obj.scaleY ?? 1));
  if (obj instanceof fabric.Textbox) {
    return {
      objectType: "text",
      width,
      height,
      text: obj.text ?? "",
      fontSize: obj.fontSize ?? 14,
      fontWeight: String(obj.fontWeight ?? "400"),
      textColor: typeof obj.fill === "string" ? obj.fill : "#0f172a",
    };
  }
  return {
    objectType: "rect",
    width,
    height,
    fill: typeof (obj as fabric.Rect).fill === "string"
      ? (obj as fabric.Rect).fill as string
      : "#e2e8f0",
    radius: (obj as fabric.Rect).rx ?? 0,
  };
}

// Stamp custom metadata onto a Fabric object
function tag(
  o: fabric.FabricObject,
  id: string,
  role: string,
  type: string,
  parentId?: string,
) {
  const r = o as unknown as Record<string, unknown>;
  r._uiId = id;
  r._uiRole = role;
  r._uiType = type;
  if (parentId !== undefined) r._uiParentId = parentId;
}

// Shadow presets keyed by elevation level (0 = none)
const SHADOWS = [
  null,
  new fabric.Shadow({ color: "rgba(0,0,0,0.08)", blur: 6,  offsetX: 0, offsetY: 2 }),
  new fabric.Shadow({ color: "rgba(0,0,0,0.10)", blur: 18, offsetX: 0, offsetY: 4 }),
  new fabric.Shadow({ color: "rgba(0,0,0,0.15)", blur: 32, offsetX: 0, offsetY: 8 }),
];

// Stamp extra visual metadata as custom properties so getAllObjects can read
// them back even after the user moves/resizes the object.
function tagExtra(o: fabric.FabricObject, obj: UIObject) {
  const r = o as unknown as Record<string, unknown>;
  r._uiElevation   = obj.elevation   ?? 0;
  r._uiStroke      = obj.stroke      ?? "";
  r._uiStrokeWidth = obj.strokeWidth ?? 1;
}

// Apply elevation shadow and stroke/border to a Fabric rect or image placeholder.
function applyVisual(rect: fabric.Rect, obj: UIObject) {
  const elv = Math.min(Math.max(Math.round(obj.elevation ?? 0), 0), 3);
  if (elv > 0) rect.set("shadow", SHADOWS[elv]);
  if (obj.stroke) {
    rect.set({
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth ?? 1,
      strokeUniform: true,      // stroke doesn't scale when object is resized
    });
  }
}

// Create Fabric objects from a UIObject. Returns [main, ...extras].
// The main object always carries _uiId; label carries _uiParentId.
function toFabricObjects(obj: UIObject): fabric.FabricObject[] {
  if (obj.type === "rect") {
    const rect = new fabric.Rect({
      left: obj.x, top: obj.y, width: obj.width, height: obj.height,
      fill: obj.fill ?? "#e2e8f0", rx: obj.radius ?? 0, ry: obj.radius ?? 0,
    });
    tag(rect, obj.id, obj.role, "rect");
    tagExtra(rect, obj);
    applyVisual(rect, obj);
    return [rect];
  }
  if (obj.type === "text") {
    const tb = new fabric.Textbox(obj.text ?? "", {
      left: obj.x, top: obj.y, width: obj.width,
      fontSize: obj.fontSize ?? 14,
      fontWeight: obj.fontWeight !== undefined ? String(obj.fontWeight) : "normal",
      fill: obj.textColor ?? "#0f172a",
      fontFamily: "Inter, sans-serif",
    });
    tag(tb, obj.id, obj.role, "text");
    return [tb];
  }
  if (obj.type === "image") {
    const rect = new fabric.Rect({
      left: obj.x, top: obj.y, width: obj.width, height: obj.height,
      fill: "#f1f5f9", rx: obj.radius ?? 0, ry: obj.radius ?? 0,
    });
    tag(rect, obj.id, obj.role, "image");
    tagExtra(rect, obj);
    applyVisual(rect, obj);
    const label = new fabric.Textbox("image", {
      left: obj.x + obj.width / 2, top: obj.y + obj.height / 2,
      width: 80, fontSize: 12, fill: "#94a3b8",
      originX: "center", originY: "center",
      selectable: false, evented: false,
    });
    tag(label, obj.id + "__label", obj.role, "image-label", obj.id);
    return [rect, label];
  }
  return [];
}

// ─── Component ───────────────────────────────────────────────────────────────

const DesignCanvas = forwardRef<DesignCanvasHandle, DesignCanvasProps>(
  function DesignCanvas({ onSelectionChange }, ref) {
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);
    const onSelectionChangeRef = useRef(onSelectionChange);
    useEffect(() => { onSelectionChangeRef.current = onSelectionChange; });

    // Canvas init + Fabric selection events
    useEffect(() => {
      const el = canvasElRef.current;
      if (!el || fabricRef.current) return;
      const fc = new fabric.Canvas(el, { width: CANVAS_W, height: CANVAS_H });
      fabricRef.current = fc;

      function notifySelected() {
        const actives = fc.getActiveObjects();
        if (actives.length !== 1) { onSelectionChangeRef.current(null); return; }
        onSelectionChangeRef.current(extractProps(actives[0]));
      }

      fc.on("selection:created", notifySelected);
      fc.on("selection:updated", notifySelected);
      fc.on("selection:cleared", () => onSelectionChangeRef.current(null));
      fc.on("object:modified", notifySelected);

      return () => { fc.dispose(); fabricRef.current = null; };
    }, []);

    // Keyboard delete
    useEffect(() => {
      function onKeyDown(e: KeyboardEvent) {
        if (e.key !== "Delete" && e.key !== "Backspace") return;
        const tag = (document.activeElement as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        const fc = fabricRef.current;
        if (!fc) return;
        const actives = fc.getActiveObjects();
        if (actives.length === 0) return;
        if (actives.some((o) => "isEditing" in o && (o as fabric.Textbox).isEditing)) return;
        // Also remove any linked labels (_uiParentId matches deleted object's _uiId)
        const deletedIds = new Set(actives.map((o) => (o as unknown as Record<string, unknown>)._uiId));
        const labels = fc.getObjects().filter(
          (o) => deletedIds.has((o as unknown as Record<string, unknown>)._uiParentId),
        );
        [...actives, ...labels].forEach((o) => fc.remove(o));
        fc.discardActiveObject();
        fc.renderAll();
        onSelectionChangeRef.current(null);
      }
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        renderObjects(objects: UIObject[]) {
          const fc = fabricRef.current;
          if (!fc) return;
          fc.clear();
          const sorted = [...objects].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
          for (const obj of sorted) fc.add(...toFabricObjects(obj));
          fc.renderAll();
        },

        clearCanvas() {
          const fc = fabricRef.current;
          if (!fc) return;
          fc.clear();
          fc.renderAll();
          onSelectionChangeRef.current(null);
        },

        updateSelected(changes: Partial<SelectedObjectProps>) {
          const fc = fabricRef.current;
          if (!fc) return;
          const obj = fc.getActiveObject();
          if (!obj) return;
          if (changes.width !== undefined) {
            if (obj instanceof fabric.Textbox) {
              obj.set("width", changes.width / (obj.scaleX ?? 1));
            } else if (obj.width) {
              obj.set("scaleX", changes.width / obj.width);
            }
          }
          if (changes.height !== undefined && obj.height) {
            obj.set("scaleY", changes.height / obj.height);
          }
          if (obj instanceof fabric.Rect) {
            if (changes.fill !== undefined) obj.set("fill", changes.fill);
            if (changes.radius !== undefined) { obj.set("rx", changes.radius); obj.set("ry", changes.radius); }
          } else if (obj instanceof fabric.Textbox) {
            if (changes.text !== undefined) obj.set("text", changes.text);
            if (changes.fontSize !== undefined) obj.set("fontSize", changes.fontSize);
            if (changes.fontWeight !== undefined) obj.set("fontWeight", changes.fontWeight);
            if (changes.textColor !== undefined) obj.set("fill", changes.textColor);
          }
          obj.setCoords();
          fc.renderAll();
        },

        getSelectedAsUIObject(): UIObject | null {
          const fc = fabricRef.current;
          if (!fc) return null;
          const obj = fc.getActiveObject();
          if (!obj) return null;
          const r = obj as unknown as Record<string, unknown>;
          const id = r._uiId;
          const role = r._uiRole;
          const uiType = r._uiType;
          if (typeof id !== "string" || typeof role !== "string") return null;

          const x = Math.round(obj.left ?? 0);
          const y = Math.round(obj.top ?? 0);
          const width = Math.round(obj.width * (obj.scaleX ?? 1));
          const height = Math.round(obj.height * (obj.scaleY ?? 1));
          const z = fc.getObjects().indexOf(obj);

          if (obj instanceof fabric.Textbox) {
            return {
              id, role, type: "text", x, y, width, height, z,
              text: obj.text ?? "",
              fontSize: obj.fontSize,
              fontWeight: Number(obj.fontWeight ?? 400),
              textColor: typeof obj.fill === "string" ? obj.fill : "#0f172a",
            };
          }
          if (obj instanceof fabric.Rect) {
            const type = typeof uiType === "string"
              ? uiType as UIObject["type"]
              : "rect";
            return {
              id, role, type, x, y, width, height, z,
              fill: typeof obj.fill === "string" ? obj.fill : "#e2e8f0",
              radius: obj.rx ?? 0,
            };
          }
          return null;
        },

        replaceObject(id: string, newObj: UIObject) {
          const fc = fabricRef.current;
          if (!fc) return;

          // Find existing object(s): main by _uiId, labels by _uiParentId
          const allObjs = fc.getObjects();
          let insertAt = allObjs.length;
          const toRemove = allObjs.filter((o) => {
            const r = o as unknown as Record<string, unknown>;
            if (r._uiId === id) { insertAt = Math.min(insertAt, allObjs.indexOf(o)); return true; }
            if (r._uiParentId === id) return true;
            return false;
          });
          toRemove.forEach((o) => fc.remove(o));

          // Create and add replacement
          const newObjs = toFabricObjects(newObj);
          if (newObjs.length === 0) return;
          fc.add(...newObjs);

          // Restore z-order: move main object back to its original stack position
          const main = newObjs[0];
          const topIdx = fc.getObjects().indexOf(main);
          const steps = topIdx - Math.min(insertAt, fc.getObjects().length - 1);
          for (let i = 0; i < steps; i++) fc.sendObjectBackwards(main, false);

          // Select the replacement and update the panel
          fc.setActiveObject(main);
          onSelectionChangeRef.current(extractProps(main));
          fc.renderAll();
        },

        getAllObjects(): UIObject[] {
          const fc = fabricRef.current;
          if (!fc) return [];
          const result: UIObject[] = [];
          fc.getObjects().forEach((obj, idx) => {
            const r = obj as unknown as Record<string, unknown>;
            if (r._uiParentId) return; // skip image labels
            const id = r._uiId;
            const role = r._uiRole;
            const uiType = r._uiType;
            if (typeof id !== "string" || typeof role !== "string") return;

            const x = Math.round(obj.left ?? 0);
            const y = Math.round(obj.top ?? 0);
            const width = Math.round(obj.width * (obj.scaleX ?? 1));
            const height = Math.round(obj.height * (obj.scaleY ?? 1));
            const angle = obj.angle ? Math.round(obj.angle * 100) / 100 : 0;

            // Read back metadata stamped by tagExtra()
            const elevation   = typeof r._uiElevation   === "number" ? r._uiElevation   : 0;
            const stroke      = typeof r._uiStroke      === "string" ? r._uiStroke      : undefined;
            const strokeWidth = typeof r._uiStrokeWidth === "number" ? r._uiStrokeWidth : undefined;

            if (obj instanceof fabric.Textbox) {
              result.push({
                id, role, type: "text", x, y, width, height, z: idx, angle,
                text: obj.text ?? "",
                fontSize: obj.fontSize,
                fontWeight: Number(obj.fontWeight ?? 400),
                textColor: typeof obj.fill === "string" ? obj.fill : "#0f172a",
              });
            } else if (obj instanceof fabric.Rect) {
              const type = (typeof uiType === "string" ? uiType : "rect") as UIObject["type"];
              result.push({
                id, role, type, x, y, width, height, z: idx, angle,
                fill: typeof obj.fill === "string" ? obj.fill : "#e2e8f0",
                radius: obj.rx ?? 0,
                elevation: elevation || undefined,
                stroke: stroke || undefined,
                strokeWidth: strokeWidth || undefined,
              });
            }
          });
          return result;
        },

        getCanvasScreenshot(): string {
          const fc = fabricRef.current;
          if (!fc) return "";
          // White bg so the screenshot is useful for Gemini grounding
          const prevBg = fc.backgroundColor;
          fc.backgroundColor = "#ffffff";
          const url = fc.toDataURL({ format: "jpeg", quality: 0.85 } as Parameters<typeof fc.toDataURL>[0]);
          fc.backgroundColor = prevBg;
          fc.renderAll();
          return url;
        },
      }),
      [],
    );

    return (
      <div
        style={{ width: DISPLAY_W, height: DISPLAY_W * (CANVAS_H / CANVAS_W), overflow: "hidden" }}
        className="rounded-xl border border-slate-200 shadow-sm"
      >
        <div
          style={{
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
            width: CANVAS_W,
            height: CANVAS_H,
            backgroundColor: "#ffffff",
            backgroundImage: "radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)",
            backgroundSize: "24px 24px",
          }}
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>
    );
  },
);

export default DesignCanvas;
