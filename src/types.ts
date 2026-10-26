// Scene format, version 1.0.
// The scene is the only thing an author (person or agent) writes.
// All sizes in a scene are pixels in the background's own space.
// All times in a scene are seconds.

export type Point = [x: number, y: number];
export type Box = [x: number, y: number, w: number, h: number];

export type Target =
  | { box: Box }
  | { point: Point }
  /** CSS selector. Only for html and svg backgrounds. */
  | { selector: string }
  /** Name from the background anchor map. */
  | { anchor: string }
  /** Another mark. For an arrow, `end` picks its start or end point. */
  | { mark: string; end?: 'start' | 'end' };

export interface Background {
  type: 'image' | 'html' | 'svg';
  /** URL or path, relative to the scene file. */
  src?: string;
  /** Inline HTML or SVG markup. Use instead of `src`. */
  content?: string;
  width: number;
  height: number;
  /** Anchor map, inline or as a path to a JSON file `{ "anchors": { ... } }`. */
  anchors?: Record<string, Point | Box> | string;
}

export interface Frame {
  width: number;
  height: number;
  /** How the background fits into the frame. Default: contain. */
  fit?: 'contain' | 'cover';
  /** Frame color behind the background. Default: style `paper` color. */
  color?: string;
}

export type MarkType =
  | 'circle'
  | 'box'
  | 'underline'
  | 'highlight'
  | 'strike'
  | 'bracket'
  | 'arrow'
  | 'label'
  | 'scribble';

export type Side = 'top' | 'right' | 'bottom' | 'left';

interface MarkBase {
  id: string;
  /** Start together with this mark (same step) instead of after the previous mark. */
  with?: string;
  /** Draw time in seconds. Default: style timing for this mark type. */
  duration?: number;
  /** Wait in seconds before this mark starts. */
  delay?: number;
  /** Style color token name, never a hex value. */
  color?: string;
  /** Random seed for the hand-drawn look. Default: hash of the mark id. */
  seed?: number;
}

export interface CircleMark extends MarkBase { type: 'circle'; target: Target; pad?: number; loops?: 1 | 2 }
export interface BoxMark extends MarkBase { type: 'box'; target: Target; pad?: number }
export interface UnderlineMark extends MarkBase { type: 'underline'; target: Target; offset?: number; double?: boolean }
export interface HighlightMark extends MarkBase { type: 'highlight'; target: Target; opacity?: number }
export interface StrikeMark extends MarkBase { type: 'strike'; target: Target; crossed?: boolean }
export interface BracketMark extends MarkBase { type: 'bracket'; target: Target; sides?: Side[]; pad?: number }
export interface ArrowMark extends MarkBase { type: 'arrow'; from: Target; to: Target; bend?: number; head?: number }
export interface LabelMark extends MarkBase { type: 'label'; text: string; at: Target; side?: Side | 'auto'; maxWidth?: number; size?: number }
export interface ScribbleMark extends MarkBase { type: 'scribble'; points: Point[]; thickness?: number }

export type Mark =
  | CircleMark
  | BoxMark
  | UnderlineMark
  | HighlightMark
  | StrikeMark
  | BracketMark
  | ArrowMark
  | LabelMark
  | ScribbleMark;

export interface Step {
  id: string;
  /** Seconds the finished step stays on screen (auto-play and video). Default: style timing. */
  hold?: number;
  /** Fade out all earlier marks before this step draws. */
  clear?: boolean;
  marks: Mark[];
}

export interface Scene {
  marginalia: '1.0';
  id: string;
  background: Background;
  /** Output size. Default: background size. */
  frame?: Frame;
  /** Built-in style name, a path to a style JSON file, or an inline style. Default: "marker". */
  style?: string | StyleInput;
  steps: Step[];
}

// Styles. A style is a set of tokens. A project makes its own style by
// extending a built-in one and changing only what it needs.

export interface Style {
  name: string;
  /** Pen used for strokes. rough = thin sketchy pen (Rough.js). freehand = marker pen (perfect-freehand). */
  pen: 'rough' | 'freehand';
  /** Color tokens. Marks refer to these names. */
  colors: Record<string, string>;
  /** Token names used when a mark sets no color. */
  defaults: { stroke: string; highlight: string; label: string; paper: string };
  /** Stroke sizes are output pixels (frame space). */
  stroke: { width: number; roughness: number; bowing: number; thinning: number; highlightWidth: number };
  font: { family: string; size: number; weight?: number; lineHeight?: number; src?: string };
  timing: {
    durations: Record<MarkType, number>;
    /** Seconds per character for labels. */
    labelPerChar: number;
    /** Default step hold in seconds. */
    hold: number;
    /** Gap in seconds between marks in one step. */
    gap: number;
    /** Anime.js easing name. */
    easing: string;
  };
}

/** A partial style. `extends` names the base style (default "marker"). */
export type StyleInput = { extends?: string } & Partial<Omit<Style, 'stroke' | 'font' | 'timing' | 'defaults'>> & {
  defaults?: Partial<Style['defaults']>;
  stroke?: Partial<Style['stroke']>;
  font?: Partial<Style['font']>;
  timing?: Partial<Omit<Style['timing'], 'durations'>> & { durations?: Partial<Record<MarkType, number>> };
};

// Validation

export interface Issue {
  /** JSON path, for example `steps[1].marks[0].target`. */
  path: string;
  /** One line: what is wrong and how to fix it. */
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
}

// Runtime

/** Times in milliseconds on the scene timeline. */
export interface StepTime {
  id: string;
  /** Timeline label position where the step begins. */
  start: number;
  /** All marks of the step are fully drawn. */
  drawEnd: number;
  /** drawEnd + hold. Equals the next step's start. */
  end: number;
}
