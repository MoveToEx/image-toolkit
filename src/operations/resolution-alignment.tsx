import { useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, LayoutTemplate, Scan } from 'lucide-react';
import { BatchOperationContext, BatchOperationDefinition } from "./types";
import { batchOperation } from '@/client/apiClient';
import { cn } from '@/lib/utils';

interface ResolutionAlignmentOptionsProps {
  onConfirm: (options: ResolutionAlignmentPayload) => void;
  onCancel: () => void;
  context: BatchOperationContext;
}

export interface ResolutionAlignmentPayload {
  width: number;
  height: number;
  position: AlignmentPosition;
  color: string;
}

export type AlignmentPosition = 
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

function ResolutionAlignmentOptions({ onConfirm, onCancel, context }: ResolutionAlignmentOptionsProps) {
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [position, setPosition] = useState<AlignmentPosition>('center');
  const [color, setColor] = useState('#000000');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (context.selectedItem) {
      const img = new Image();
      img.src = convertFileSrc(context.selectedItem.image);
      img.onload = () => setImage(img);
    }
  }, [context.selectedItem]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas display size (aspect ratio of target resolution)
    // We'll limit the max display size to say 300x300 but keep aspect ratio
    // Actually the canvas internal resolution should match the target (scaled down for performance if huge?)
    // Or just use a small internal resolution for preview.
    // Let's use 500x500 max internal for preview, but keep aspect ratio of width/height keys.
    
    const previewScale = Math.min(1, 400 / width, 400 / height);
    const canvasWidth = width * previewScale;
    const canvasHeight = height * previewScale;
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Fill background
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Calculate image position
    // We need to scale the image so it fits WITHIN the target resolution, maintaining aspect ratio.
    // Wait, the requirement says "scales and fills". 
    // Usually "resolution alignment" with "color used to fill empty space" means:
    // Scale the image to FIT inside the box, then pad with color.
    
    const scale = Math.min(width / image.width, height / image.height);
    const scaledImgWidth = image.width * scale;
    const scaledImgHeight = image.height * scale;
    
    // Now position it
    let x = 0;
    let y = 0;

    // Horizontal
    if (position.includes('left')) {
      x = 0;
    } else if (position.includes('right')) {
      x = width - scaledImgWidth;
    } else { // center
      x = (width - scaledImgWidth) / 2;
    }

    // Vertical
    if (position.includes('top')) {
      y = 0;
    } else if (position.includes('bottom')) {
      y = height - scaledImgHeight;
    } else { // center
      y = (height - scaledImgHeight) / 2;
    }

    // Draw
    // We need to scale x, y, w, h by previewScale
    ctx.drawImage(
      image, 
      x * previewScale, 
      y * previewScale, 
      scaledImgWidth * previewScale, 
      scaledImgHeight * previewScale
    );

  }, [width, height, position, color, image]);

  const GridButton = ({ pos, icon: Icon, iconClass = '' }: { pos: AlignmentPosition, icon?: any, iconClass?: string }) => (
    <Button
      variant={position === pos ? "default" : "outline"}
      size="icon"
      className="w-8 h-8"
      onClick={() => setPosition(pos)}
    >
      {Icon ? <Icon className={cn(iconClass, "w-4", "h-4")} /> : <div className="w-2 h-2 bg-current rounded-full" />}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>Target Resolution</Label>
            <div className="flex gap-2 items-center">
              <div className="space-y-1">
                <Input 
                  type="number" 
                  value={width} 
                  onChange={e => setWidth(Number(e.target.value))} 
                  placeholder="Width"
                />
              </div>
              <span className="text-muted-foreground">x</span>
              <div className="space-y-1">
                <Input 
                  type="number" 
                  value={height} 
                  onChange={e => setHeight(Number(e.target.value))} 
                  placeholder="Height"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fill Color</Label>
            <div className="flex gap-2">
              <Input 
                type="color" 
                className="w-12 p-1 h-10" 
                value={color}
                onChange={e => setColor(e.target.value)}
              />
              <Input 
                type="text" 
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Positioning</Label>
            <div className="grid grid-cols-3 gap-1 w-fit">
              <GridButton pos="top-left" icon={ChevronLeft} iconClass='rotate-45' />
              <GridButton pos="top-center" icon={ChevronUp} />
              <GridButton pos="top-right" icon={ChevronUp} iconClass='rotate-45' />
              
              <GridButton pos="center-left" icon={ChevronLeft} />
              <GridButton pos="center" icon={Scan} />
              <GridButton pos="center-right" icon={ChevronRight} />
              
              <GridButton pos="bottom-left" icon={ChevronDown} iconClass='rotate-45'/>
              <GridButton pos="bottom-center" icon={ChevronDown} />
              <GridButton pos="bottom-right" icon={ChevronRight} iconClass='rotate-45' />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center border rounded-md bg-secondary/20 p-4 min-h-75">
          {image ? (
            <div className="checkerboard-bg">
                <canvas ref={canvasRef} className="border shadow-sm max-w-full max-h-75 object-contain" />
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">Select an image to see preview</div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onConfirm({ width, height, position, color })}>Execute</Button>
      </div>
    </div>
  );
}

export const ResolutionAlignmentOperation: BatchOperationDefinition = {
  id: 'resolution_alignment',
  label: 'Align Resolution',
  icon: LayoutTemplate,
  optionsComponent: ResolutionAlignmentOptions,
  execute: async (context, options) => {
    await batchOperation({
      id: 'align_resolution',
      color: options.color,
      height: options.height,
      position: options.position,
      width: options.width
    });
    context.toast.success('Saved');
  }
};
