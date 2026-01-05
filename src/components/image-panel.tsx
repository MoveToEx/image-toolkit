import { useEffect, useRef } from 'react';
import { Tool, ToolEvent, ViewTransform } from '@/lib/tools';

interface ImagePanelProps {
    src: string | null;
    activeTool: Tool;
}

export default function ImagePanel({ src, activeTool }: ImagePanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    
    // State for view transform (zoom/pan)
    // We use a ref for the render loop to avoid re-renders, 
    // but we could sync to state if we needed UI updates.
    const transformRef = useRef<ViewTransform>({ x: 0, y: 0, scale: 1 });
    
    // Keep track of active tool for the render loop
    const activeToolRef = useRef(activeTool);
    useEffect(() => {
        activeToolRef.current = activeTool;
    }, [activeTool]);

    // Load image
    useEffect(() => {
        if (!src) {
            imageRef.current = null;
            return;
        }
        const img = new Image();
        img.src = src;
        img.onload = () => {
            imageRef.current = img;
            // Center image
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                const scale = Math.min(width / img.width, height / img.height) * 0.9;
                const x = (width - img.width * scale) / 2;
                const y = (height - img.height * scale) / 2;
                transformRef.current = { x, y, scale };
            }
        };
    }, [src]);

    // Resize observer
    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                canvas.width = width;
                canvas.height = height;
                // Request render? The loop handles it.
            }
        });

        resizeObserver.observe(container);
        
        // Prevent default wheel behavior (scrolling)
        const preventDefault = (e: WheelEvent) => e.preventDefault();
        canvas.addEventListener('wheel', preventDefault, { passive: false });

        return () => {
            resizeObserver.disconnect();
            canvas.removeEventListener('wheel', preventDefault);
        };
    }, []);

    // Render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            const transform = transformRef.current;
            const tool = activeToolRef.current;

            // Clear
            ctx.fillStyle = '#c3c3c3';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw Image
            if (imageRef.current) {
                ctx.save();
                ctx.translate(transform.x, transform.y);
                ctx.scale(transform.scale, transform.scale);
                ctx.drawImage(imageRef.current, 0, 0);
                ctx.restore();

                // Clip for tool rendering
                ctx.save();
                if (tool.clip) {
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

            // Draw Tool Overlay
            tool.render({
                ctx,
                transform,
                image: imageRef.current,
                canvas
            });

            if (imageRef.current) {
                ctx.restore();
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    // Event Handling
    const isPanning = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const getToolEvent = <T extends React.MouseEvent | React.WheelEvent>(e: T): ToolEvent<T> => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const t = transformRef.current;
        
        return {
            originalEvent: e,
            viewPoint: { x, y },
            imagePoint: {
                x: (x - t.x) / t.scale,
                y: (y - t.y) / t.scale
            }
        };
    };

    const handleWheel = (e: React.WheelEvent) => {
        // Prevent default scrolling behavior if possible (though React synthetic events might be too late, 
        // usually we need ref and addEventListener for non-passive wheel)
        // But for now let's try.
        
        const t = transformRef.current;
        const rect = canvasRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
             // Maybe let tool handle it?
        }

        // Zoom
        const zoomIntensity = 0.001;
        const delta = -e.deltaY * zoomIntensity;
        const newScale = Math.max(0.1, Math.min(50, t.scale * (1 + delta)));
        
        // Adjust position to zoom towards mouse
        const scaleRatio = newScale / t.scale;
        const newX = mouseX - (mouseX - t.x) * scaleRatio;
        const newY = mouseY - (mouseY - t.y) * scaleRatio;

        transformRef.current = { x: newX, y: newY, scale: newScale };
        
        activeToolRef.current.onWheel?.(getToolEvent(e), {
            ctx: canvasRef.current!.getContext('2d')!,
            transform: transformRef.current,
            image: imageRef.current,
            canvas: canvasRef.current!
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt+Left
            isPanning.current = true;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        } else {
            activeToolRef.current.onMouseDown?.(getToolEvent(e), {
                ctx: canvasRef.current!.getContext('2d')!,
                transform: transformRef.current,
                image: imageRef.current,
                canvas: canvasRef.current!
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning.current) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            transformRef.current.x += dx;
            transformRef.current.y += dy;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        } else {
            activeToolRef.current.onMouseMove?.(getToolEvent(e), {
                ctx: canvasRef.current!.getContext('2d')!,
                transform: transformRef.current,
                image: imageRef.current,
                canvas: canvasRef.current!
            });
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (isPanning.current) {
            isPanning.current = false;
        } else {
            activeToolRef.current.onMouseUp?.(getToolEvent(e), {
                ctx: canvasRef.current!.getContext('2d')!,
                transform: transformRef.current,
                image: imageRef.current,
                canvas: canvasRef.current!
            });
        }
    };

    return (
        <div ref={containerRef} className="w-full h-full overflow-hidden bg-neutral-900 relative">
            <canvas
                ref={canvasRef}
                className="block touch-none"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={e => e.preventDefault()}
            />
        </div>
    );
}