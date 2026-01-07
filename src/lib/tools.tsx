import { MouseEvent, WheelEvent, ReactNode } from 'react';
import { Brush, Square, MousePointer2, LucideIcon, SquareSplitHorizontal, SquareSplitVertical, LayoutGrid, Crop, Maximize, Columns } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  originalEvent: E;
  imagePoint: Point;
  viewPoint: Point;
}

export interface ToolVariant {
  id: string;
  name: string;
  icon: LucideIcon;
}

export abstract class Tool {
  abstract id: string;
  abstract name: string;
  abstract icon: LucideIcon;

  variants?: ToolVariant[];
  setVariant?(variantId: string): void;

  onMouseDown(_event: ToolEvent<MouseEvent>, _context: ToolContext): void { }
  onMouseMove(_event: ToolEvent<MouseEvent>, _context: ToolContext): void { }
  onMouseUp(_event: ToolEvent<MouseEvent>, _context: ToolContext): void { }
  onMouseLeave(_event: ToolEvent<MouseEvent>, _context: ToolContext): void { }
  onWheel(_event: ToolEvent<WheelEvent>, _context: ToolContext): void { }

  abstract render(context: ToolContext): void;

  get clip(): boolean { return true; }

  reset(): void { }
  getData(): any { return null; }
  renderOptions(_props: { onChange: () => void }): ReactNode { return null; }
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
export class ViewTool extends Tool {
  id = 'view';
  name = 'View';
  icon = MousePointer2;

  render() {
    // Nothing to render
  }
}

// 2. Drawing Tools (Brush & Rectangle)
export class BrushTool extends Tool {
  id = 'brush';
  name = 'Brush';
  icon = Brush;

  shapes: BrushStroke[] = [];
  color: string = '#ff0000';
  private currentShape: BrushStroke | null = null;
  private isDrawing = false;

  reset() {
    this.shapes = [];
  }

  getData() {
    return { drawing: this.shapes };
  }

  renderOptions({ onChange }: { onChange: () => void }) {
    return (
      <div className="mt-6">
        <Label className="mb-2 block text-sm font-medium text-muted-foreground">Color</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={this.color}
            onChange={(e) => {
              this.color = e.target.value;
              onChange();
            }}
            className="w-12 h-8 p-1 cursor-pointer"
          />
          <span className="text-xs text-muted-foreground">{this.color}</span>
        </div>
      </div>
    );
  }

  onMouseDown(event: ToolEvent<MouseEvent>) {
    if (event.originalEvent.button !== 0) return;
    this.isDrawing = true;
    this.currentShape = {
      color: this.color,
      width: 5,
      points: [event.imagePoint]
    };
  }

  onMouseMove(event: ToolEvent<MouseEvent>) {
    if (!this.isDrawing || !this.currentShape) return;
    this.currentShape.points.push(event.imagePoint);
  }

  onMouseUp() {
    if (this.isDrawing && this.currentShape) {
      this.shapes.push(this.currentShape);
      this.currentShape = null;
      this.isDrawing = false;
    }
  }

  render(context: ToolContext) {
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

    this.shapes.forEach(drawShape);
    if (this.currentShape) {
      drawShape(this.currentShape);
    }

    ctx.restore();
  }
}

export class RectangleTool extends Tool {
  id = 'rect';
  name = 'Rectangle';
  icon = Square;

  shapes: RectShape[] = [];
  color: string = '#ff0000';
  private currentShape: RectShape | null = null;
  private isDrawing = false;

  reset() {
    this.shapes = [];
  }

  getData() {
    return { drawing: this.shapes };
  }

  renderOptions({ onChange }: { onChange: () => void }) {
    return (
      <div className="mt-6">
        <Label className="mb-2 block text-sm font-medium text-muted-foreground">Color</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={this.color}
            onChange={(e) => {
              this.color = e.target.value;
              onChange();
            }}
            className="w-12 h-8 p-1 cursor-pointer"
          />
          <span className="text-xs text-muted-foreground">{this.color}</span>
        </div>
      </div>
    );
  }

  onMouseDown(event: ToolEvent<MouseEvent>) {
    if (event.originalEvent.button !== 0) return;
    this.isDrawing = true;
    this.currentShape = {
      color: this.color,
      start: event.imagePoint,
      end: event.imagePoint
    };
  }

  onMouseMove(event: ToolEvent<MouseEvent>) {
    if (!this.isDrawing || !this.currentShape) return;
    this.currentShape.end = event.imagePoint;
  }

  onMouseUp() {
    if (this.isDrawing && this.currentShape) {
      this.shapes.push(this.currentShape);
      this.currentShape = null;
      this.isDrawing = false;
    }
  }

  render(context: ToolContext) {
    const { ctx, transform } = context;
    const { x, y, scale } = transform;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const drawShape = (shape: RectShape) => {
      ctx.beginPath();
      if (shape === this.currentShape) {
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

    this.shapes.forEach(drawShape);
    if (this.currentShape) {
      drawShape(this.currentShape);
    }

    ctx.restore();
  }
}

// 3. Split Tools
export class SplitTool extends Tool {
  id = 'split';
  name = 'Split';
  icon = SquareSplitVertical;

  variants: ToolVariant[] = [
    { id: 'cross', name: 'Cross Split', icon: LayoutGrid },
    { id: 'horizontal', name: 'Horizontal Split', icon: SquareSplitHorizontal },
    { id: 'vertical', name: 'Vertical Split', icon: SquareSplitVertical }
  ];

  protected hoverPoint: Point | null = null;
  splitPoint: Point | null = null;

  reset() {
    this.splitPoint = null;
  }

  getData() {
    if (this.splitPoint) {
      return {
        mode: this._mode,
        point: this.splitPoint
      };
    }
    return null;
  }

  private _mode: 'cross' | 'horizontal' | 'vertical' = 'cross';

  get mode() { return this._mode; }

  onMouseDown(event: ToolEvent<MouseEvent>) {
    if (event.originalEvent.button === 0) {
      this.updateSplitPoint(event.imagePoint);
    }
    else if (event.originalEvent.button === 2) {
      this.reset();
    }
  }

  onMouseMove(event: ToolEvent<MouseEvent>, context: ToolContext) {
    const { image } = context;
    if (image) {
      const { x, y } = event.imagePoint;
      if (x >= 0 && x <= image.width && y >= 0 && y <= image.height) {
        this.hoverPoint = event.imagePoint;
        return;
      }
    }
    this.hoverPoint = null;
  }

  onMouseLeave() {
    this.hoverPoint = null;
  }

  protected drawLine(ctx: CanvasRenderingContext2D, p: Point, type: 'horizontal' | 'vertical' | 'cross', _scale: number, image: HTMLImageElement) {
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

  render(context: ToolContext) {
    const { ctx, transform, image } = context;
    if (!image) return;
    const { x, y, scale } = transform;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Invert pixels
    ctx.globalCompositeOperation = 'difference';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1 / scale; // 1 screen pixel width

    if (this.splitPoint) {
      this.drawSplit(ctx, this.splitPoint, scale, image);
    } else if (this.hoverPoint) {
      this.drawSplit(ctx, this.hoverPoint, scale, image);
    }

    ctx.restore();
  }

  setVariant(variantId: string) {
    if (['cross', 'horizontal', 'vertical'].includes(variantId)) {
      this._mode = variantId as 'cross' | 'horizontal' | 'vertical';
      const variant = this.variants.find(v => v.id === variantId);
      if (variant) {
        this.icon = variant.icon;
        this.name = variant.name;
      }
    }
  }

  updateSplitPoint(p: Point) {
    if (this._mode === 'cross') {
      this.splitPoint = p;
    } else if (this._mode === 'horizontal') {
      if (this.splitPoint) {
        this.splitPoint = { x: this.splitPoint.x, y: p.y };
      } else {
        this.splitPoint = p;
      }
    } else if (this._mode === 'vertical') {
      if (this.splitPoint) {
        this.splitPoint = { x: p.x, y: this.splitPoint.y };
      } else {
        this.splitPoint = p;
      }
    }
  }

  drawSplit(ctx: CanvasRenderingContext2D, p: Point, scale: number, image: HTMLImageElement) {
    this.drawLine(ctx, p, this._mode, scale, image);
  }
}

export class TrimTool extends Tool {
  id = 'trim';
  name = 'Trim';
  icon = Crop;

  top = 0;
  bottom = 0;
  left = 0;
  right = 0;

  private dragging: 'top' | 'bottom' | 'left' | 'right' | null = null;

  reset() {
    this.top = 0;
    this.bottom = 0;
    this.left = 0;
    this.right = 0;
  }

  getData() {
    return {
      top: Math.round(this.top),
      bottom: Math.round(this.bottom),
      left: Math.round(this.left),
      right: Math.round(this.right)
    };
  }

  onMouseDown(event: ToolEvent<MouseEvent>, context: ToolContext) {
    if (!context.image) return;
    const { x, y } = event.imagePoint;
    const { width, height } = context.image;
    const threshold = 10 / context.transform.scale; // 10 screen pixels tolerance

    // Check proximity to lines
    // Top line: y = this.top
    if (Math.abs(y - this.top) < threshold) {
      this.dragging = 'top';
    }
    // Bottom line: y = height - this.bottom
    else if (Math.abs(y - (height - this.bottom)) < threshold) {
      this.dragging = 'bottom';
    }
    // Left line: x = this.left
    else if (Math.abs(x - this.left) < threshold) {
      this.dragging = 'left';
    }
    // Right line: x = width - this.right
    else if (Math.abs(x - (width - this.right)) < threshold) {
      this.dragging = 'right';
    }
  }

  onMouseMove(event: ToolEvent<MouseEvent>, context: ToolContext) {
    if (!context.image) return;
    const { width, height } = context.image;
    const { x, y } = event.imagePoint;

    if (this.dragging) {
      if (this.dragging === 'top') {
        this.top = Math.max(0, Math.min(y, height - this.bottom - 10));
      } else if (this.dragging === 'bottom') {
        this.bottom = Math.max(0, Math.min(height - y, height - this.top - 10));
      } else if (this.dragging === 'left') {
        this.left = Math.max(0, Math.min(x, width - this.right - 10));
      } else if (this.dragging === 'right') {
        this.right = Math.max(0, Math.min(width - x, width - this.left - 10));
      }
      return;
    }

    // Update cursor
    const threshold = 10 / context.transform.scale;
    const canvas = context.canvas;

    if (Math.abs(y - this.top) < threshold || Math.abs(y - (height - this.bottom)) < threshold) {
      canvas.style.cursor = 'ns-resize';
    } else if (Math.abs(x - this.left) < threshold || Math.abs(x - (width - this.right)) < threshold) {
      canvas.style.cursor = 'ew-resize';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  onMouseUp() {
    this.dragging = null;
  }

  onMouseLeave() {
    this.dragging = null;
  }

  render(context: ToolContext) {
    const { ctx, transform, image } = context;
    if (!image) return;
    const { x, y, scale } = transform;
    const { width, height } = image;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Draw semi-transparent overlay on trimmed areas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';

    // Top area
    if (this.top > 0) ctx.fillRect(0, 0, width, this.top);
    // Bottom area
    if (this.bottom > 0) ctx.fillRect(0, height - this.bottom, width, this.bottom);
    // Left area (between top and bottom)
    if (this.left > 0) ctx.fillRect(0, this.top, this.left, height - this.top - this.bottom);
    // Right area (between top and bottom)
    if (this.right > 0) ctx.fillRect(width - this.right, this.top, this.right, height - this.top - this.bottom);

    // Draw lines
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 / scale;
    ctx.setLineDash([5 / scale, 5 / scale]);

    // Top line
    ctx.beginPath();
    ctx.moveTo(0, this.top);
    ctx.lineTo(width, this.top);
    ctx.stroke();

    // Bottom line
    ctx.beginPath();
    ctx.moveTo(0, height - this.bottom);
    ctx.lineTo(width, height - this.bottom);
    ctx.stroke();

    // Left line
    ctx.beginPath();
    ctx.moveTo(this.left, 0);
    ctx.lineTo(this.left, height);
    ctx.stroke();

    // Right line
    ctx.beginPath();
    ctx.moveTo(width - this.right, 0);
    ctx.lineTo(width - this.right, height);
    ctx.stroke();

    ctx.restore();
  }
}

export class ExpandTool extends Tool {
  id = 'expand';
  name = 'Expand';
  icon = Maximize;

  get clip() { return false; }

  top = 0;
  bottom = 0;
  left = 0;
  right = 0;
  color = '#ffffff';

  private dragging: 'top' | 'bottom' | 'left' | 'right' | null = null;

  reset() {
    this.top = 0;
    this.bottom = 0;
    this.left = 0;
    this.right = 0;
  }

  getData() {
    return {
      top: Math.round(this.top),
      bottom: Math.round(this.bottom),
      left: Math.round(this.left),
      right: Math.round(this.right),
      color: this.color
    };
  }

  renderOptions({ onChange }: { onChange: () => void }) {
    return (
      <div className="mt-6 space-y-4">
        <div>
          <Label className="mb-2 block text-sm font-medium text-muted-foreground">Fill Color</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={this.color}
              onChange={(e) => {
                this.color = e.target.value;
                onChange();
              }}
              className="w-12 h-8 p-1 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">{this.color}</span>
          </div>
        </div>
      </div>
    );
  }

  onMouseDown(event: ToolEvent<MouseEvent>, context: ToolContext) {
    if (!context.image) return;
    const { x, y } = event.imagePoint;
    const { width, height } = context.image;
    const threshold = 10 / context.transform.scale;

    // Check proximity to expanded boundaries
    // Top: y = -this.top
    if (Math.abs(y - (-this.top)) < threshold) {
      this.dragging = 'top';
    }
    // Bottom: y = height + this.bottom
    else if (Math.abs(y - (height + this.bottom)) < threshold) {
      this.dragging = 'bottom';
    }
    // Left: x = -this.left
    else if (Math.abs(x - (-this.left)) < threshold) {
      this.dragging = 'left';
    }
    // Right: x = width + this.right
    else if (Math.abs(x - (width + this.right)) < threshold) {
      this.dragging = 'right';
    }
  }

  onMouseMove(event: ToolEvent<MouseEvent>, context: ToolContext) {
    if (!context.image) return;
    const { width, height } = context.image;
    const { x, y } = event.imagePoint;

    if (this.dragging) {
      if (this.dragging === 'top') {
        // Dragging up (negative y) increases top
        this.top = Math.max(0, -y);
      } else if (this.dragging === 'bottom') {
        // Dragging down (y > height) increases bottom
        this.bottom = Math.max(0, y - height);
      } else if (this.dragging === 'left') {
        // Dragging left (negative x) increases left
        this.left = Math.max(0, -x);
      } else if (this.dragging === 'right') {
        // Dragging right (x > width) increases right
        this.right = Math.max(0, x - width);
      }
      return;
    }

    // Update cursor
    const threshold = 10 / context.transform.scale;
    const canvas = context.canvas;

    if (Math.abs(y - (-this.top)) < threshold || Math.abs(y - (height + this.bottom)) < threshold) {
      canvas.style.cursor = 'ns-resize';
    } else if (Math.abs(x - (-this.left)) < threshold || Math.abs(x - (width + this.right)) < threshold) {
      canvas.style.cursor = 'ew-resize';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  onMouseUp() {
    this.dragging = null;
  }

  onMouseLeave() {
    this.dragging = null;
  }

  render(context: ToolContext) {
    const { ctx, transform, image } = context;
    if (!image) return;
    const { x, y, scale } = transform;
    const { width, height } = image;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Draw expanded areas
    ctx.fillStyle = this.color;

    // Top
    if (this.top > 0) ctx.fillRect(-this.left, -this.top, width + this.left + this.right, this.top);
    // Bottom
    if (this.bottom > 0) ctx.fillRect(-this.left, height, width + this.left + this.right, this.bottom);
    // Left
    if (this.left > 0) ctx.fillRect(-this.left, 0, this.left, height);
    // Right
    if (this.right > 0) ctx.fillRect(width, 0, this.right, height);

    // Draw boundary lines
    ctx.strokeStyle = '#000'; // Use black for contrast against potentially white fill
    ctx.lineWidth = 1 / scale;
    ctx.setLineDash([5 / scale, 5 / scale]);

    // Top line
    ctx.beginPath();
    ctx.moveTo(-this.left, -this.top);
    ctx.lineTo(width + this.right, -this.top);
    ctx.stroke();

    // Bottom line
    ctx.beginPath();
    ctx.moveTo(-this.left, height + this.bottom);
    ctx.lineTo(width + this.right, height + this.bottom);
    ctx.stroke();

    // Left line
    ctx.beginPath();
    ctx.moveTo(-this.left, -this.top);
    ctx.lineTo(-this.left, height + this.bottom);
    ctx.stroke();

    // Right line
    ctx.beginPath();
    ctx.moveTo(width + this.right, -this.top);
    ctx.lineTo(width + this.right, height + this.bottom);
    ctx.stroke();

    // Draw original image boundary for reference
    ctx.strokeStyle = '#888';
    ctx.setLineDash([]);
    ctx.strokeRect(0, 0, width, height);

    ctx.restore();
  }
}

export class ConcatTool extends Tool {
  id = 'concat';
  name = 'Concat';
  icon = Columns;

  mode: 'horizontal' | 'vertical' = 'horizontal';
  otherImage: string | null = null;
  offset = 0;
  color = '#ffffff';
  private otherImageEl: HTMLImageElement | null = null;
  private dragging: 'main' | 'other' | null = null;
  private dragStart = 0;
  private offsetStart = 0;

  constructor(private getItems: () => string[]) {
    super();
  }

  get clip() { return false; }

  reset() {
    this.mode = 'horizontal';
    this.otherImage = null;
    this.otherImageEl = null;
    this.offset = 0;
    this.color = '#ffffff';
    this.dragging = null;
  }

  getData() {
    if (!this.otherImage) return null;
    return {
      image: this.otherImage,
      mode: this.mode,
      offset: Math.round(this.offset),
      color: this.color
    };
  }

  // Helper to determine layout and smaller image
  private getLayout(image: HTMLImageElement, other: HTMLImageElement) {
    let mainRect = { x: 0, y: 0, w: image.width, h: image.height };
    let otherRect = { x: 0, y: 0, w: other.width, h: other.height };
    let smaller: 'main' | 'other' | null = null;
    let maxOffset = 0;

    if (this.mode === 'horizontal') {
      // Horizontal concatenation
      // Align vertically (y-axis)
      otherRect.x = image.width;

      if (image.height < other.height) {
        smaller = 'main';
        maxOffset = other.height - image.height;
        mainRect.y = this.offset;
      } else if (other.height < image.height) {
        smaller = 'other';
        maxOffset = image.height - other.height;
        otherRect.y = this.offset;
      }
    } else {
      // Vertical concatenation
      // Align horizontally (x-axis)
      otherRect.y = image.height;

      if (image.width < other.width) {
        smaller = 'main';
        maxOffset = other.width - image.width;
        mainRect.x = this.offset;
      } else if (other.width < image.width) {
        smaller = 'other';
        maxOffset = image.width - other.width;
        otherRect.x = this.offset;
      }
    }

    return { mainRect, otherRect, smaller, maxOffset };
  }

  onMouseDown(event: ToolEvent<MouseEvent>, context: ToolContext) {
    if (!context.image || !this.otherImageEl) return;
    const { image } = context;
    const { mainRect, otherRect, smaller } = this.getLayout(image, this.otherImageEl);
    const { x, y } = event.imagePoint;

    // Check hit
    const hitMain = x >= mainRect.x && x < mainRect.x + mainRect.w && y >= mainRect.y && y < mainRect.y + mainRect.h;
    const hitOther = x >= otherRect.x && x < otherRect.x + otherRect.w && y >= otherRect.y && y < otherRect.y + otherRect.h;

    if (hitMain && smaller === 'main') {
      this.dragging = 'main';
    } else if (hitOther && smaller === 'other') {
      this.dragging = 'other';
    } else {
      return;
    }

    if (this.mode === 'horizontal') {
      this.dragStart = y;
    } else {
      this.dragStart = x;
    }
    this.offsetStart = this.offset;
  }

  onMouseMove(event: ToolEvent<MouseEvent>, context: ToolContext) {
    if (!context.image || !this.otherImageEl) return;

    // Cursor update
    const { smaller, maxOffset } = this.getLayout(context.image, this.otherImageEl);
    if (!this.dragging) {
      const { mainRect, otherRect } = this.getLayout(context.image, this.otherImageEl);
      const { x, y } = event.imagePoint;
      const hitMain = x >= mainRect.x && x < mainRect.x + mainRect.w && y >= mainRect.y && y < mainRect.y + mainRect.h;
      const hitOther = x >= otherRect.x && x < otherRect.x + otherRect.w && y >= otherRect.y && y < otherRect.y + otherRect.h;

      if ((hitMain && smaller === 'main') || (hitOther && smaller === 'other')) {
        context.canvas.style.cursor = 'grab';
      } else {
        context.canvas.style.cursor = 'default';
      }
      return;
    }

    context.canvas.style.cursor = 'grabbing';

    let current = 0;
    if (this.mode === 'horizontal') {
      current = event.imagePoint.y;
    } else {
      current = event.imagePoint.x;
    }

    const delta = current - this.dragStart;
    this.offset = Math.max(0, Math.min(this.offsetStart + delta, maxOffset));
  }

  onMouseUp() {
    this.dragging = null;
  }

  onMouseLeave() {
    this.dragging = null;
  }

  loadOtherImage(src: string, onLoad: () => void) {
    if (!src) return;
    const img = new Image();
    img.src = convertFileSrc(src);
    img.onload = () => {
      this.otherImageEl = img;
      onLoad();
    };
  }

  renderOptions({ onChange }: { onChange: () => void }) {
    const handleModeChange = (val: string) => {
      this.mode = val as 'horizontal' | 'vertical';
      onChange();
    };

    const handleImageChange = (val: string) => {
      this.otherImage = val;
      this.offset = 0; // Reset offset when image changes
      this.loadOtherImage(val, onChange);
    };

    const items = this.getItems();

    return (
      <div className="mt-6 space-y-4">
        <div>
          <Label className="mb-2 block text-sm font-medium text-muted-foreground">Fill Color</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={this.color}
              onChange={(e) => {
                this.color = e.target.value;
                onChange();
              }}
              className="w-12 h-8 p-1 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">{this.color}</span>
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-sm font-medium text-muted-foreground">Mode</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`flex items-center justify-center p-2 rounded border text-sm ${this.mode === 'horizontal' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
              onClick={() => handleModeChange('horizontal')}
            >
              Horizontal
            </button>
            <button
              className={`flex items-center justify-center p-2 rounded border text-sm ${this.mode === 'vertical' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
              onClick={() => handleModeChange('vertical')}
            >
              Vertical
            </button>
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-sm font-medium text-muted-foreground">Second Image</Label>
          <Select value={this.otherImage || ''} onValueChange={handleImageChange}>
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

  render(context: ToolContext) {
    const { ctx, transform, image } = context;
    if (!image || !this.otherImageEl) return;
    const { x, y, scale } = transform;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const { mainRect, otherRect, smaller } = this.getLayout(image, this.otherImageEl);

    if (image.width > 0 && image.height > 0) {
      if (this.mode === 'horizontal') {
        const totalWidth = image.width + this.otherImageEl.width;
        const totalHeight = Math.max(image.height, this.otherImageEl.height);
        ctx.fillStyle = this.color;
        ctx.fillRect(0, 0, totalWidth, totalHeight);
      } else {
        const totalWidth = Math.max(image.width, this.otherImageEl.width);
        const totalHeight = image.height + this.otherImageEl.height;
        ctx.fillStyle = this.color;
        ctx.fillRect(0, 0, totalWidth, totalHeight);
      }
    }

    ctx.drawImage(image, mainRect.x, mainRect.y);
    ctx.drawImage(this.otherImageEl, otherRect.x, otherRect.y);

    // Draw outline for smaller image to indicate it's interactive
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2 / scale;

    if (smaller === 'main') {
      ctx.strokeRect(mainRect.x, mainRect.y, mainRect.w, mainRect.h);
    } else {
      ctx.strokeRect(otherRect.x, otherRect.y, otherRect.w, otherRect.h);
    }

    // Draw total boundary
    if (this.mode === 'horizontal') {
      const totalWidth = image.width + this.otherImageEl.width;
      const totalHeight = Math.max(image.height, this.otherImageEl.height);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1 / scale;
      ctx.strokeRect(0, 0, totalWidth, totalHeight);
    } else {
      const totalWidth = Math.max(image.width, this.otherImageEl.width);
      const totalHeight = image.height + this.otherImageEl.height;
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1 / scale;
      ctx.strokeRect(0, 0, totalWidth, totalHeight);
    }

    ctx.restore();
  }
}
