import { Tool } from '@/lib/tools';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Save, RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from './ui/spinner';

interface ToolPanelProps {
  tools: Tool<any, any>[];
  activeToolId: string;
  onToolChange: (toolId: string, options?: any) => void;
  toolState: any;
  onToolStateChange: (newState: any) => void;
  onReset?: () => void;
  onSave?: () => void;
  running: boolean;
}

export default function ToolPanel({
  tools,
  activeToolId,
  onToolChange,
  toolState,
  onToolStateChange,
  onReset,
  onSave,
  running
}: ToolPanelProps) {
  const activeTool = tools.find(t => t.id === activeToolId);

  return (
    <div className="flex flex-col h-full bg-background border-r">
      {/* Tools Section */}
      <ScrollArea className="flex-1 p-4">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Tools</h3>
        <div className="grid grid-cols-3 gap-2 p-2">
          {tools.map(tool => {
            const Icon = tool.icon;
            const isActive = activeToolId === tool.id;

            if (tool.variants) {
              return (
                <DropdownMenu key={tool.id}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size='icon'
                      variant={isActive ? "default" : "outline"}
                      className={cn(
                        isActive && "border-primary"
                      )}
                    >
                      <Icon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start">
                    {tool.variants.map(variant => (
                      <DropdownMenuItem
                        key={variant.id}
                        onClick={() => {
                          onToolChange(tool.id, variant.id);
                        }}
                      >
                        <variant.icon className="mr-2 h-4 w-4" />
                        <span>{variant.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <Button
                    size='icon'
                    variant={isActive ? "default" : "outline"}
                    className={cn(
                      isActive && "border-primary"
                    )}
                    onClick={() => onToolChange(tool.id)}
                  >
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <span>{tool.name}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Tool Options */}
        {activeTool && activeTool.renderOptions({
          state: toolState,
          update: (partial: any) => onToolStateChange({ ...toolState, ...partial })
        })}
      </ScrollArea>

      <div className="p-4 flex gap-2">
        <Button className='flex-1' onClick={onSave} disabled={running}>
          {running && <Spinner className="mr-2 h-4 w-4" />}
          {running || <Save className="mr-2 h-4 w-4" />}
          Apply
        </Button>
        <Button variant="outline" size="icon" onClick={onReset} title="Reset">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
