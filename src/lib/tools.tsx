import { MouseEvent, WheelEvent, ReactNode, useEffect } from 'react';
import { Brush, Square, MousePointer2, LucideIcon, SquareSplitHorizontal, SquareSplitVertical, LayoutGrid, Crop, Maximize, Columns } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { convertFileSrc } from '@tauri-apps/api/core';

export type Point = { x: number; y: number };

export type ViewTransform = {
  x: number;
  y: number;
  scale: number;
};

export interface ToolContext {
  ctx: CanvasRenderingContext2D;
  transform: ViewTransform;
  image: HTMLImageElement | null;
  canvas: HTMLCanvasElement;
}

export interface ToolEvent<E = MouseEvent | WheelEvent> {
  type: 'mousedown' | 'mousemove' | 'mouseup' | 'mouseleave' | 'wheel';
  originalEvent: E;
  imagePoint: Point;
  viewPoint: Point;
}

export interface ToolVariant {
  id: string;
  name: string;
  icon: LucideIcon;
}

export abstract class Tool<S, O = void> {
  abstract id: string;
  abstract name: string;
  abstract icon: LucideIcon;

  variants?: ToolVariant[];

  abstract init(options?: O): S;

  abstract reduce(state: S, event: ToolEvent, context: ToolContext): S;

  abstract render(state: S, context: ToolContext): void;

  abstract renderPreview(state: S, context: ToolContext): void;

  get clip(): boolean { return true; }

  getData(_state: S): any { return null; }

  renderOptions(_props: { state: S, update: (val: S extends void ? never : Partial<S>) => void }): ReactNode { return null; }
}

// --- Shared States ---

export interface Shape {
  color: string;
}

export interface BrushStroke extends Shape {
  points: Point[];
  width: number;
}

export interface RectShape extends Shape {
  start: Point;
  end: Point;
}

// --- Concrete Tools ---

// 1. View Tool
export class ViewTool extends Tool<void> {
  id = 'view';
  name = 'View';
  icon = MousePointer2;

  init() { }
  reduce() { }
  render() { }
  renderPreview() { }
}

// 2. Brush Tool
export interface BrushToolState {
  shapes: BrushStroke[];
  color: string;
  currentShape: BrushStroke | null;
  isDrawing: boolean;
}

export class BrushTool extends Tool<BrushToolState> {
  id = 'brush';
  name = 'Brush';
  icon = Brush;

  init(): BrushToolState {
    return {
      shapes: [],
      color: '#ff0000',
      currentShape: null,
      isDrawing: false
    };
  }

  getData(state: BrushToolState) {
    return { drawing: state.shapes };
  }

  reduce(state: BrushToolState, event: ToolEvent<MouseEvent>, context: ToolContext): BrushToolState {
    switch (event.type) {
      case 'mousedown': {
        if (event.originalEvent.button !== 0) return state;
        return {
          ...state,
          isDrawing: true,
          currentShape: {
            color: state.color,
            width: 5,
            points: [event.imagePoint]
          }
        };
      }
      case 'mousemove': {
        context.canvas.style.cursor = 'crosshair';
        if (!state.isDrawing || !state.currentShape) return state;
        return {
          ...state,
          currentShape: {
            ...state.currentShape,
            points: [...state.currentShape.points, event.imagePoint]
          }
        };
      }
      case 'mouseup': {
        if (state.isDrawing && state.currentShape) {
          return {
            ...state,
            shapes: [...state.shapes, state.currentShape],
            currentShape: null,
            isDrawing: false
          };
        }
        return state;
      }
      case 'mouseleave': {
        context.canvas.style.cursor = 'default';
        return state;
      }
      default:
        return state;
    }
  }

  render(state: BrushToolState, context: ToolContext) {
    const { ctx, transform } = context;
    const { x, y, scale } = transform;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const drawShape = (shape: BrushStroke) => {
      ctx.beginPath();
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (shape.points.length > 0) {
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
      }
      ctx.stroke();
    };

    state.shapes.forEach(drawShape);
    if (state.currentShape) {
      drawShape(state.currentShape);
    }

    ctx.restore();
  }

  renderPreview(state: BrushToolState, context: ToolContext) {
    this.render(state, context);
  }

  renderOptions({ state, update }: { state: BrushToolState, update: (val: Partial<BrushToolState>) => void }) {
    return (
      <div className="mt-6">
        <Label className="mb-2 block text-sm font-medium text-muted-foreground">Color</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={state.color}
            onChange={(e) => update({ color: e.target.value })}
            className="w-12 h-8 p-1 cursor-pointer"
          />
          <span className="text-xs text-muted-foreground">{state.color}</span>
        </div>
      </div>
    );
  }
}

// 3. Rectangle Tool
export interface RectToolState {
  shapes: RectShape[];
  color: string;
  currentShape: RectShape | null;
  isDrawing: boolean;
}

export class RectangleTool extends Tool<RectToolState> {
  id = 'rect';
  name = 'Rectangle';
  icon = Square;

  init(): RectToolState {
    return {
      shapes: [],
      color: '#ff0000',
      currentShape: null,
      isDrawing: false
    };
  }

  getData(state: RectToolState) {
    return { drawing: state.shapes };
  }

  reduce(state: RectToolState, event: ToolEvent<MouseEvent>, context: ToolContext): RectToolState {
    switch (event.type) {
      case 'mousedown': {
        if (event.originalEvent.button !== 0) return state;
        return {
          ...state,
          isDrawing: true,
          currentShape: {
            color: state.color,
            start: event.imagePoint,
            end: event.imagePoint
          }
        };
      }
      case 'mousemove': {
        context.canvas.style.cursor = 'crosshair';
        if (!state.isDrawing || !state.currentShape) return state;
        return {
          ...state,
          currentShape: {
            ...state.currentShape,
            end: event.imagePoint
          }
        };
      }
      case 'mouseup': {
        if (state.isDrawing && state.currentShape) {
          return {
            ...state,
            shapes: [...state.shapes, state.currentShape],
            currentShape: null,
            isDrawing: false
          };
        }
        return state;
      }
      case 'mouseleave': {
        context.canvas.style.cursor = 'default';
        return state;
      }
      default:
        return state;
    }
  }

  render(state: RectToolState, context: ToolContext) {
    const { ctx, transform } = context;
    const { x, y, scale } = transform;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const drawShape = (shape: RectShape) => {
      ctx.beginPath();
      if (shape === state.currentShape) {
        ctx.fillStyle = shape.color + '80';
      } else {
        ctx.fillStyle = shape.color;
      }
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = 2;
      const w = shape.end.x - shape.start.x;
      const h = shape.end.y - shape.start.y;
      ctx.fillRect(shape.start.x, shape.start.y, w, h);
      ctx.strokeRect(shape.start.x, shape.start.y, w, h);
    };

    state.shapes.forEach(drawShape);
    if (state.currentShape) {
      drawShape(state.currentShape);
    }

    ctx.restore();
  }

  renderPreview(state: RectToolState, context: ToolContext) {
    this.render(state, context);
  }

  renderOptions({ state, update }: { state: RectToolState, update: (val: Partial<RectToolState>) => void }) {
    return (
      <div className="mt-6">
        <Label className="mb-2 block text-sm font-medium text-muted-foreground">Color</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={state.color}
            onChange={(e) => update({ color: e.target.value })}
            className="w-12 h-8 p-1 cursor-pointer"
          />
          <span className="text-xs text-muted-foreground">{state.color}</span>
        </div>
      </div>
    );
  }
}

// 4. Split Tool
export type SplitMode = 'cross' | 'horizontal' | 'vertical';

export interface SplitToolState {
  mode: SplitMode;
  splitPoint: Point | null;
  hoverPoint: Point | null;
}

export class SplitTool extends Tool<SplitToolState, SplitMode> {
  id = 'split';
  name = 'Split';
  icon = SquareSplitVertical;

  variants: ToolVariant[] = [
    { id: 'cross', name: 'Cross Split', icon: LayoutGrid },
    { id: 'horizontal', name: 'Horizontal Split', icon: SquareSplitHorizontal },
    { id: 'vertical', name: 'Vertical Split', icon: SquareSplitVertical }
  ];

  init(mode: SplitMode = 'cross'): SplitToolState {
    return {
      mode,
      splitPoint: null,
      hoverPoint: null
    };
  }

  getData(state: SplitToolState) {
    if (state.splitPoint) {
      return {
        mode: state.mode,
        point: state.splitPoint
      };
    }
    return null;
  }

  reduce(state: SplitToolState, event: ToolEvent<MouseEvent>, context: ToolContext): SplitToolState {
    switch (event.type) {
      case 'mousedown': {
        if (event.originalEvent.button === 0) {
          let newSplitPoint = state.splitPoint;
          const p = event.imagePoint;
          if (state.mode === 'cross') {
            newSplitPoint = p;
          } else if (state.mode === 'horizontal') {
            newSplitPoint = state.splitPoint ? { x: state.splitPoint.x, y: p.y } : p;
          } else if (state.mode === 'vertical') {
            newSplitPoint = state.splitPoint ? { x: p.x, y: state.splitPoint.y } : p;
          }
          return { ...state, splitPoint: newSplitPoint };
        } else if (event.originalEvent.button === 2) {
          return { ...state, splitPoint: null };
        }
        return state;
      }
      case 'mousemove': {
        context.canvas.style.cursor = 'crosshair';
        return { ...state, hoverPoint: event.imagePoint };
      }
      case 'mouseleave': {
        context.canvas.style.cursor = 'default';
        return { ...state, hoverPoint: null };
      }
      default: return state;
    }
  }

  protected drawLine(ctx: CanvasRenderingContext2D, p: Point, type: SplitMode, image: HTMLImageElement) {
    ctx.beginPath();
    if (type === 'vertical' || type === 'cross') {
      ctx.moveTo(0, p.y);
      ctx.lineTo(image.width, p.y);
    }
    if (type === 'horizontal' || type === 'cross') {
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, image.height);
    }
    ctx.stroke();
  }

  render(state: SplitToolState, context: ToolContext) {
    const { ctx, transform, image } = context;
    if (!image) return;
    const { x, y, scale } = transform;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Invert pixels
    ctx.globalCompositeOperation = 'difference';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1 / scale;

    if (state.splitPoint) {
      this.drawLine(ctx, state.splitPoint, state.mode, image);
    } else if (state.hoverPoint) {
      this.drawLine(ctx, state.hoverPoint, state.mode, image);
    }

    ctx.restore();
  }

  renderPreview(state: SplitToolState, context: ToolContext) {
    this.render(state, context);
  }
}

// 5. Trim Tool
export interface TrimToolState {
  top: number;
  bottom: number;
  left: number;
  right: number;
  dragging: 'top' | 'bottom' | 'left' | 'right' | null;
}

export class TrimTool extends Tool<TrimToolState> {
  id = 'trim';
  name = 'Trim';
  icon = Crop;

  init(): TrimToolState {
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      dragging: null
    };
  }

  getData(state: TrimToolState) {
    return {
      top: Math.round(state.top),
      bottom: Math.round(state.bottom),
      left: Math.round(state.left),
      right: Math.round(state.right)
    };
  }

  reduce(state: TrimToolState, event: ToolEvent<MouseEvent>, context: ToolContext): TrimToolState {
    if (!context.image) return state;
    const { width, height } = context.image;

    switch (event.type) {
      case 'mousedown': {
        const { x, y } = event.imagePoint;
        const threshold = 10 / context.transform.scale;
        let dragging: any = null;
        if (Math.abs(y - state.top) < threshold) dragging = 'top';
        else if (Math.abs(y - (height - state.bottom)) < threshold) dragging = 'bottom';
        else if (Math.abs(x - state.left) < threshold) dragging = 'left';
        else if (Math.abs(x - (width - state.right)) < threshold) dragging = 'right';

        if (dragging) {
          context.canvas.style.cursor = 'grabbing';
        }
        return { ...state, dragging };
      }
      case 'mousemove': {
        const { x, y } = event.imagePoint;

        if (state.dragging) {
          context.canvas.style.cursor = 'grabbing';
          let newState = { ...state };
          if (state.dragging === 'top') newState.top = Math.max(0, Math.min(y, height - state.bottom - 10));
          else if (state.dragging === 'bottom') newState.bottom = Math.max(0, Math.min(height - y, height - state.top - 10));
          else if (state.dragging === 'left') newState.left = Math.max(0, Math.min(x, width - state.right - 10));
          else if (state.dragging === 'right') newState.right = Math.max(0, Math.min(width - x, width - state.left - 10));
          return newState;
        } else {
          // Hover cursor
          const threshold = 10 / context.transform.scale;
          if (Math.abs(y - state.top) < threshold) context.canvas.style.cursor = 'ns-resize';
          else if (Math.abs(y - (height - state.bottom)) < threshold) context.canvas.style.cursor = 'ns-resize';
          else if (Math.abs(x - state.left) < threshold) context.canvas.style.cursor = 'ew-resize';
          else if (Math.abs(x - (width - state.right)) < threshold) context.canvas.style.cursor = 'ew-resize';
          else context.canvas.style.cursor = 'default';
        }
        return state;
      }
      case 'mouseup': {
        context.canvas.style.cursor = 'default';
        return { ...state, dragging: null };
      }
      case 'mouseleave': {
        // Keep dragging state if captured? But if we leave, we typically stop?
        // With pointer capture, we might not get mouseleave until release.
        // If we do get it, resetting dragging is safe.
        context.canvas.style.cursor = 'default';
        return { ...state, dragging: null };
      }
      default: return state;
    }
  }

  render(state: TrimToolState, context: ToolContext) {
    const { ctx, transform, image } = context;
    if (!image) return;
    const { x, y, scale } = transform;
    const { width, height } = image;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    if (state.top > 0) ctx.fillRect(0, 0, width, state.top);
    if (state.bottom > 0) ctx.fillRect(0, height - state.bottom, width, state.bottom);
    if (state.left > 0) ctx.fillRect(0, state.top, state.left, height - state.top - state.bottom);
    if (state.right > 0) ctx.fillRect(width - state.right, state.top, state.right, height - state.top - state.bottom);

    // Draw lines
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 / scale;
    ctx.setLineDash([5 / scale, 5 / scale]);

    ctx.strokeRect(0, state.top, width, 0); // Top
    ctx.strokeRect(0, height - state.bottom, width, 0); // Bottom
    ctx.strokeRect(state.left, 0, 0, height); // Left
    ctx.strokeRect(width - state.right, 0, 0, height); // Right

    ctx.restore();
  }

  renderPreview(state: TrimToolState, context: ToolContext) {
    this.render(state, context);
  }
}

// 6. Expand Tool
export interface ExpandToolState {
  top: number;
  bottom: number;
  left: number;
  right: number;
  color: string;
  dragging: 'top' | 'bottom' | 'left' | 'right' | null;
}

export class ExpandTool extends Tool<ExpandToolState> {
  id = 'expand';
  name = 'Expand';
  icon = Maximize;

  get clip() { return false; }

  init(): ExpandToolState {
    return {
      top: 0, bottom: 0, left: 0, right: 0,
      color: '#ffffff',
      dragging: null
    };
  }

  getData(state: ExpandToolState) {
    return {
      top: Math.round(state.top),
      bottom: Math.round(state.bottom),
      left: Math.round(state.left),
      right: Math.round(state.right),
      color: state.color
    };
  }

  renderOptions({ state, update }: { state: ExpandToolState, update: (val: Partial<ExpandToolState>) => void }) {
    return (
      <div className="mt-6 space-y-4">
        <div>
          <Label className="mb-2 block text-sm font-medium text-muted-foreground">Fill Color</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={state.color}
              onChange={(e) => update({ color: e.target.value })}
              className="w-12 h-8 p-1 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">{state.color}</span>
          </div>
        </div>
      </div>
    );
  }

  reduce(state: ExpandToolState, event: ToolEvent<MouseEvent>, context: ToolContext): ExpandToolState {
    if (!context || !context.image) return state;
    const { width, height } = context.image;

    switch (event.type) {
      case 'mousedown': {
        const { x, y } = event.imagePoint;
        const threshold = 10 / context.transform.scale;
        let dragging: any = null;
        if (Math.abs(y - (-state.top)) < threshold) dragging = 'top';
        else if (Math.abs(y - (height + state.bottom)) < threshold) dragging = 'bottom';
        else if (Math.abs(x - (-state.left)) < threshold) dragging = 'left';
        else if (Math.abs(x - (width + state.right)) < threshold) dragging = 'right';

        if (dragging) context.canvas.style.cursor = 'grabbing';

        return { ...state, dragging };
      }
      case 'mousemove': {
        const { x, y } = event.imagePoint;

        if (state.dragging) {
          context.canvas.style.cursor = 'grabbing';
          let newState = { ...state };
          if (state.dragging === 'top') newState.top = Math.max(0, -y);
          else if (state.dragging === 'bottom') newState.bottom = Math.max(0, y - height);
          else if (state.dragging === 'left') newState.left = Math.max(0, -x);
          else if (state.dragging === 'right') newState.right = Math.max(0, x - width);
          return newState;
        } else {
          const threshold = 10 / context.transform.scale;
          if (Math.abs(y - (-state.top)) < threshold) context.canvas.style.cursor = 'ns-resize';
          else if (Math.abs(y - (height + state.bottom)) < threshold) context.canvas.style.cursor = 'ns-resize';
          else if (Math.abs(x - (-state.left)) < threshold) context.canvas.style.cursor = 'ew-resize';
          else if (Math.abs(x - (width + state.right)) < threshold) context.canvas.style.cursor = 'ew-resize';
          else context.canvas.style.cursor = 'default';
        }
        return state;
      }
      case 'mouseup': {
        context.canvas.style.cursor = 'default';
        return { ...state, dragging: null };
      }
      case 'mouseleave': {
        context.canvas.style.cursor = 'default';
        return { ...state, dragging: null };
      }
      default: return state;
    }
  }

  render(state: ExpandToolState, context: ToolContext) {
    const { ctx, transform, image } = context;
    if (!image) return;
    const { x, y, scale } = transform;
    const { width, height } = image;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = state.color;
    // Top
    if (state.top > 0) ctx.fillRect(-state.left, -state.top, width + state.left + state.right, state.top);
    // Bottom
    if (state.bottom > 0) ctx.fillRect(-state.left, height, width + state.left + state.right, state.bottom);
    // Left
    if (state.left > 0) ctx.fillRect(-state.left, 0, state.left, height);
    // Right
    if (state.right > 0) ctx.fillRect(width, 0, state.right, height);

    // Lines
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1 / scale;
    ctx.setLineDash([5 / scale, 5 / scale]);

    ctx.strokeRect(-state.left, -state.top, width + state.left + state.right, height + state.top + state.bottom);

    // Original image boundary
    ctx.strokeStyle = '#888';
    ctx.setLineDash([]);
    ctx.strokeRect(0, 0, width, height);

    ctx.restore();
  }

  renderPreview(state: ExpandToolState, context: ToolContext) {
    this.render(state, context);
  }
}

// 7. Concat Tool
export interface ConcatToolState {
  mode: 'horizontal' | 'vertical';
  otherImage: string | null;
  otherImageEl: HTMLImageElement | null;
  offset: number;
  color: string;
  dragging: 'main' | 'other' | null;
  dragStart: number;
  offsetStart: number;
}

export class ConcatTool extends Tool<ConcatToolState> {
  id = 'concat';
  name = 'Concat';
  icon = Columns;

  constructor(private getItems: () => string[]) {
    super();
  }

  get clip() { return false; }

  init(): ConcatToolState {
    return {
      mode: 'horizontal',
      otherImage: null,
      otherImageEl: null,
      offset: 0,
      color: '#ffffff',
      dragging: null,
      dragStart: 0,
      offsetStart: 0
    };
  }

  getData(state: ConcatToolState) {
    if (!state.otherImage) return null;
    return {
      image: state.otherImage,
      mode: state.mode,
      offset: Math.round(state.offset),
      color: state.color
    };
  }

  protected getLayout(image: HTMLImageElement, other: HTMLImageElement, state: ConcatToolState) {
    let mainRect = { x: 0, y: 0, w: image.width, h: image.height };
    let otherRect = { x: 0, y: 0, w: other.width, h: other.height };
    let smaller: 'main' | 'other' | null = null;
    let maxOffset = 0;

    if (state.mode === 'horizontal') {
      mainRect.x = 0;
      otherRect.x = image.width;

      if (image.height < other.height) {
        smaller = 'main';
        maxOffset = other.height - image.height;
        mainRect.y = state.offset;
      } else if (other.height < image.height) {
        smaller = 'other';
        maxOffset = image.height - other.height;
        otherRect.y = state.offset;
      }
    } else {
      mainRect.y = 0;
      otherRect.y = image.height;

      if (image.width < other.width) {
        smaller = 'main';
        maxOffset = other.width - image.width;
        mainRect.x = state.offset;
      } else if (other.width < image.width) {
        smaller = 'other';
        maxOffset = image.width - other.width;
        otherRect.x = state.offset;
      }
    }

    return { mainRect, otherRect, smaller, maxOffset };
  }

  renderOptions({ state, update }: { state: ConcatToolState, update: (val: Partial<ConcatToolState>) => void }) {
    const items = this.getItems();

    useEffect(() => {
      if (state.otherImage && (!state.otherImageEl || state.otherImageEl.src !== convertFileSrc(state.otherImage))) {
        const img = new Image();
        img.src = convertFileSrc(state.otherImage);
        img.onload = () => update({ otherImageEl: img });
      }
    }, [state.otherImage]);

    return (
      <div className="mt-6 space-y-4">
        <div>
          <Label className="mb-2 block text-sm font-medium text-muted-foreground">Fill Color</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={state.color}
              onChange={(e) => update({ color: e.target.value })}
              className="w-12 h-8 p-1 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">{state.color}</span>
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-sm font-medium text-muted-foreground">Mode</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`flex items-center justify-center p-2 rounded border text-sm ${state.mode === 'horizontal' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
              onClick={() => update({ mode: 'horizontal' })}
            >Horizontal</button>
            <button
              className={`flex items-center justify-center p-2 rounded border text-sm ${state.mode === 'vertical' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
              onClick={() => update({ mode: 'vertical' })}
            >Vertical</button>
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-sm font-medium text-muted-foreground">Second Image</Label>
          <Select value={state.otherImage || ''} onValueChange={(val) => update({ otherImage: val, offset: 0 })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select image..." />
            </SelectTrigger>
            <SelectContent>
              {items?.map((item) => {
                const name = item.split(/[\\/]/).pop();
                return (
                  <SelectItem key={item} value={item}>
                    <span className="truncate max-w-50 inline-block" title={name}>{name}</span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  reduce(state: ConcatToolState, event: ToolEvent<MouseEvent>, context: ToolContext): ConcatToolState {
    if (!context.image || !state.otherImageEl) return state;
    const { image } = context;
    const { mainRect, otherRect, smaller, maxOffset } = this.getLayout(image, state.otherImageEl, state);

    switch (event.type) {
      case 'mousedown': {
        const { x, y } = event.imagePoint;
        const hitMain = x >= mainRect.x && x < mainRect.x + mainRect.w && y >= mainRect.y && y < mainRect.y + mainRect.h;
        const hitOther = x >= otherRect.x && x < otherRect.x + otherRect.w && y >= otherRect.y && y < otherRect.y + otherRect.h;

        let dragging: any = null;
        if (hitMain && smaller === 'main') dragging = 'main';
        else if (hitOther && smaller === 'other') dragging = 'other';
        else return state;

        if (dragging) context.canvas.style.cursor = 'grabbing';

        return {
          ...state,
          dragging,
          dragStart: state.mode === 'horizontal' ? y : x,
          offsetStart: state.offset
        };
      }
      case 'mousemove': {
        if (!state.dragging) {
          // Hover logic
          const { x, y } = event.imagePoint;
          const hitMain = x >= mainRect.x && x < mainRect.x + mainRect.w && y >= mainRect.y && y < mainRect.y + mainRect.h;
          const hitOther = x >= otherRect.x && x < otherRect.x + otherRect.w && y >= otherRect.y && y < otherRect.y + otherRect.h;

          if ((hitMain && smaller === 'main') || (hitOther && smaller === 'other')) {
            context.canvas.style.cursor = 'grab';
          } else {
            context.canvas.style.cursor = 'default';
          }
          return state;
        }

        context.canvas.style.cursor = 'grabbing';
        const current = state.mode === 'horizontal' ? event.imagePoint.y : event.imagePoint.x;
        const delta = current - state.dragStart;
        return {
          ...state,
          offset: Math.max(0, Math.min(state.offsetStart + delta, maxOffset))
        };
      }
      case 'mouseup': {
        context.canvas.style.cursor = 'default';
        return { ...state, dragging: null };
      }
      case 'mouseleave': {
        context.canvas.style.cursor = 'default';
        return { ...state, dragging: null };
      }
      default: return state;
    }
  }

  render(state: ConcatToolState, context: ToolContext) {
    const { ctx, transform, image } = context;
    if (!image || !state.otherImageEl) return;
    const { x, y, scale } = transform;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const { mainRect, otherRect, smaller } = this.getLayout(image, state.otherImageEl, state);

    if (image.width > 0 && image.height > 0) {
      if (state.mode === 'horizontal') {
        const totalWidth = image.width + state.otherImageEl.width;
        const totalHeight = Math.max(image.height, state.otherImageEl.height);
        ctx.fillStyle = state.color;
        ctx.fillRect(0, 0, totalWidth, totalHeight);
      } else {
        const totalWidth = Math.max(image.width, state.otherImageEl.width);
        const totalHeight = image.height + state.otherImageEl.height;
        ctx.fillStyle = state.color;
        ctx.fillRect(0, 0, totalWidth, totalHeight);
      }
    }

    ctx.drawImage(image, mainRect.x, mainRect.y);
    ctx.drawImage(state.otherImageEl, otherRect.x, otherRect.y);

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2 / scale;

    if (smaller === 'main') {
      ctx.strokeRect(mainRect.x, mainRect.y, mainRect.w, mainRect.h);
    } else {
      ctx.strokeRect(otherRect.x, otherRect.y, otherRect.w, otherRect.h);
    }

    ctx.restore();
  }

  renderPreview(state: ConcatToolState, context: ToolContext) {
    this.render(state, context);
  }
}
