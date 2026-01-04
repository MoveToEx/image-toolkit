import { MouseEvent, WheelEvent, ReactNode } from 'react';
import { Brush, Square, MousePointer2, LucideIcon, SquareSplitHorizontal, SquareSplitVertical, LayoutGrid } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  onMouseDown(event: ToolEvent<MouseEvent>, context: ToolContext): void { }
  onMouseMove(event: ToolEvent<MouseEvent>, context: ToolContext): void { }
  onMouseUp(event: ToolEvent<MouseEvent>, context: ToolContext): void { }
  onMouseLeave(event: ToolEvent<MouseEvent>, context: ToolContext): void { }
  onWheel(event: ToolEvent<WheelEvent>, context: ToolContext): void { }

  abstract render(context: ToolContext): void;

  reset(): void { }
  getData(): any { return null; }
  renderOptions(props: { onChange: () => void }): ReactNode { return null; }
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

  render(context: ToolContext) {
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

  onMouseDown(event: ToolEvent<MouseEvent>, context: ToolContext) {
    if (event.originalEvent.button !== 0) return;
    this.isDrawing = true;
    this.currentShape = {
      color: this.color,
      width: 5,
      points: [event.imagePoint]
    };
  }

  onMouseMove(event: ToolEvent<MouseEvent>, context: ToolContext) {
    if (!this.isDrawing || !this.currentShape) return;
    this.currentShape.points.push(event.imagePoint);
  }

  onMouseUp(event: ToolEvent<MouseEvent>, context: ToolContext) {
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

  onMouseDown(event: ToolEvent<MouseEvent>, context: ToolContext) {
    if (event.originalEvent.button !== 0) return;
    this.isDrawing = true;
    this.currentShape = {
      color: this.color,
      start: event.imagePoint,
      end: event.imagePoint
    };
  }

  onMouseMove(event: ToolEvent<MouseEvent>, context: ToolContext) {
    if (!this.isDrawing || !this.currentShape) return;
    this.currentShape.end = event.imagePoint;
  }

  onMouseUp(event: ToolEvent<MouseEvent>, context: ToolContext) {
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

  onMouseDown(event: ToolEvent<MouseEvent>, context: ToolContext) {
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

  onMouseLeave(event: ToolEvent<MouseEvent>, context: ToolContext) {
    this.hoverPoint = null;
  }

  protected drawLine(ctx: CanvasRenderingContext2D, p: Point, type: 'horizontal' | 'vertical' | 'cross', scale: number, image: HTMLImageElement) {
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
