import { useEffect, useRef, useCallback } from 'react';
import { Tool, ToolEvent, ViewTransform, ToolContext } from '@/lib/tools';
import { convertFileSrc } from '@tauri-apps/api/core';

interface ImagePanelProps<S, O> {
  src: string | null;
  activeTool: Tool<S, O>;
  toolState: S;
  onToolStateChange: (state: S) => void;
}

export default function ImagePanel<S, O>({ src, activeTool, toolState, onToolStateChange }: ImagePanelProps<S, O>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // View Transform State (Local View State)
  const transformRef = useRef<ViewTransform>({ x: 0, y: 0, scale: 1 });

  // Refs for Tool State access in closures/render loop
  const activeToolRef = useRef(activeTool);
  const toolStateRef = useRef(toolState);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    toolStateRef.current = toolState;
  }, [toolState]);

  // Load Image
  useEffect(() => {
    if (!src) {
      imageRef.current = null;
      return;
    }
    const img = new Image();
    // Simple check to see if conversion is needed (if it's a file path)
    const url = (src.includes('://') || src.startsWith('data:')) ? src : convertFileSrc(src);

    img.onload = () => {
      imageRef.current = img;
      // Center image logic
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (img.width > 0 && img.height > 0) {
          const scale = Math.min(width / img.width, height / img.height) * 0.9;
          const x = (width - img.width * scale) / 2;
          const y = (height - img.height * scale) / 2;
          transformRef.current = { x, y, scale };
        }
      }
    };

    img.src = url;
  }, [src]);

  // Draw Function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const transform = transformRef.current;
    const tool = activeToolRef.current;
    const tState = toolStateRef.current;

    // Clear
    ctx.fillStyle = '#c3c3c3'; // Dark bg matches theme usually
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const toolContext: ToolContext = {
      ctx,
      transform,
      image: imageRef.current,
      canvas
    };

    // Draw Image
    if (imageRef.current) {
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // Draw image placeholder pattern or just image?
      // Basic image draw
      ctx.drawImage(imageRef.current, 0, 0);

      ctx.restore();

      // Clip for tool rendering? (Some tools might draw outside?)
      // The base class has `clip` getter
      if (tool.clip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          transform.x,
          transform.y,
          imageRef.current.width * transform.scale,
          imageRef.current.height * transform.scale
        );
        ctx.clip();
      }
    }

    // Render Tool
    // We pass the current tool state
    tool.render(tState, toolContext);

    if (imageRef.current && tool.clip) {
      ctx.restore();
    }
  }, []); // Logic relies on refs, so deps can be empty or technically refs never change

  // Resize Observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        // Trigger synchronous redraw to prevent blinking
        render();
      }
    });

    resizeObserver.observe(container);

    const preventDefault = (e: WheelEvent) => e.preventDefault();
    canvas.addEventListener('wheel', preventDefault, { passive: false });

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener('wheel', preventDefault);
    };
  }, [render]);

  // Render Loop
  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
      render();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [render]);

  // Interaction Handlers
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const getEventData = (e: React.PointerEvent | React.WheelEvent): { imagePoint: { x: number, y: number }, viewPoint: { x: number, y: number } } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const t = transformRef.current;
    return {
      viewPoint: { x, y },
      imagePoint: {
        x: (x - t.x) / t.scale,
        y: (y - t.y) / t.scale
      }
    };
  };

  const dispatchToolEvent = (e: React.PointerEvent | React.WheelEvent, type: ToolEvent['type']) => {
    if (!canvasRef.current || !activeToolRef.current) return;

    const { imagePoint, viewPoint } = getEventData(e);
    // Construct the ToolEvent with the specific type.
    // We cast originalEvent to any because ToolEvent defines it as MouseEvent | WheelEvent 
    // but we are now using PointerEvent which is compatible/superior.
    const event: ToolEvent = {
      type,
      originalEvent: e as any,
      imagePoint,
      viewPoint
    };

    const ctx = canvasRef.current.getContext('2d')!;
    const context: ToolContext = {
      ctx,
      transform: transformRef.current,
      image: imageRef.current,
      canvas: canvasRef.current
    };

    const newState = activeToolRef.current.reduce(toolStateRef.current, event, context);
    if (newState !== toolStateRef.current) {
      onToolStateChange(newState);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Capture pointer to ensure we get events outside canvas
    if (canvasRef.current) {
      canvasRef.current.setPointerCapture(e.pointerId);
    }

    // Pan Condition: Middle Mouse OR (Left Mouse AND (Alt Key OR Tool is View))
    const isViewTool = activeToolRef.current.id === 'view';
    if (e.button === 1 || (e.button === 0 && (e.altKey || isViewTool))) {
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
      return;
    }

    // Otherwise Dispatch
    dispatchToolEvent(e, 'mousedown');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      transformRef.current = {
        ...transformRef.current,
        x: transformRef.current.x + dx,
        y: transformRef.current.y + dy
      };
      return;
    }

    dispatchToolEvent(e, 'mousemove');
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (canvasRef.current) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }

    if (isPanning.current) {
      isPanning.current = false;
      // Revert cursor? 
      // We don't strictly set 'default' because the tool might want to set its own cursor in the next move/reduce
      // But for panning exit, default is safe-ish. 
      // Ideally we trigger a mousemove or let the tool loop handle it, 
      // but tools only update cursor on event.
      if (canvasRef.current) canvasRef.current.style.cursor = 'default';
      return;
    }
    dispatchToolEvent(e, 'mouseup');
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    // With pointer capture, this mainly happens if capture is lost or legitimate exit without down
    if (isPanning.current) {
      isPanning.current = false;
      if (canvasRef.current) canvasRef.current.style.cursor = 'default';
    }
    dispatchToolEvent(e, 'mouseleave');
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Simple Zoom Logic - always active
    const t = transformRef.current;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomIntensity = 0.001;
    const delta = -e.deltaY * zoomIntensity;
    const newScale = Math.max(0.1, Math.min(50, t.scale * (1 + delta)));

    const scaleRatio = newScale / t.scale;
    const newX = mouseX - (mouseX - t.x) * scaleRatio;
    const newY = mouseY - (mouseY - t.y) * scaleRatio;

    transformRef.current = { x: newX, y: newY, scale: newScale };

    // Optional: Dispatch wheel to tool if tool wants to react (e.g. brush size)
    // dispatchToolEvent(e, 'wheel'); 
  };

  return (
    <div ref={containerRef} className="flex-1 w-full h-full relative overflow-hidden bg-neutral-900">
      <canvas
        ref={canvasRef}
        className="block cursor-default touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
