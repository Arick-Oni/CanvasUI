export type UIObject = {
  id: string;
  type: "rect" | "text" | "image";
  role: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  radius?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  textColor?: string;
  z?: number;
  angle?: number;
  elevation?: number;   // 0 none · 1 sm · 2 md · 3 lg
  stroke?: string;      // border color hex
  strokeWidth?: number; // border width px
  src?: string;
  alt?: string;
  textAlign?: "left" | "center" | "right";
  fontFamily?: string;
};

export type SelectedObjectProps = {
  objectType: "rect" | "text" | "image";
  width: number;
  height: number;
  // rect
  fill?: string;
  radius?: number;
  // text
  text?: string;
  fontSize?: number;
  fontWeight?: string;
  textColor?: string;
  textAlign?: "left" | "center" | "right";
  fontFamily?: string;
  // image
  src?: string;
  alt?: string;
};
