import { useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Blend } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { BatchOperationContext, BatchOperationDefinition } from "./types";
import { batchOperation } from "@/client/apiClient";

interface RemoveTransparencyOptionsProps {
  onConfirm: (options: RemoveTransparencyPayload) => void;
  onCancel: () => void;
  context: BatchOperationContext;
}

export interface RemoveTransparencyPayload {
  color: string;
}

function RemoveTransparencyOptions({ onConfirm, onCancel, context }: RemoveTransparencyOptionsProps) {
  const [color, setColor] = useState('#ffffff');
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

    // Use image dimensions but limit preview size
    const maxWidth = 400;
    const maxHeight = 300;
    
    let canvasWidth = image.width;
    let canvasHeight = image.height;
    
    // Scale down if needed for preview
    const scale = Math.min(1, maxWidth / canvasWidth, maxHeight / canvasHeight);
    canvasWidth *= scale;
    canvasHeight *= scale;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Fill background
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw image
    // ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
    // Draw scaled image
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

  }, [color, image]);

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>Background Color</Label>
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
                placeholder="#ffffff"
                className="flex-1"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This color will fill the transparent areas.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center border rounded-md bg-secondary/20 p-4 min-h-50">
          {image ? (
            <div className="checkerboard-bg p-1 shadow-sm inline-block">
                <canvas ref={canvasRef} className="block max-w-full max-h-75 object-contain" />
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">Select an image to see preview</div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onConfirm({ color })}>Execute</Button>
      </div>
    </div>
  );
}

export const RemoveTransparencyOperation: BatchOperationDefinition<RemoveTransparencyPayload> = {
  id: 'remove_transparency',
  label: 'Remove transparency',
  icon: Blend,
  optionsComponent: RemoveTransparencyOptions,
  execute: async (context, options) => {
    await batchOperation({
      id: 'remove_transparency',
      color: options.color,
    });
    context.toast.success('Batch operation completed');
  }
};
