import TopBar, { Operation } from '@/components/topbar'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import ToolPanel from './components/tool-panel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './components/ui/empty';
import { Image } from 'lucide-react';
import { Button } from './components/ui/button';
import FilesPanel from './components/files-panel';
import CaptionPanel from './components/caption-panel';
import ImagePanel from './components/image-panel';
import { useAppState } from './lib/hooks';
import { closeFolder, save, deleteItem, onDrag } from './client/apiClient';

import { convertFileSrc } from '@tauri-apps/api/core';
import { listen, TauriEvent } from '@tauri-apps/api/event';

import './App.css'
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { BrushTool, RectangleTool, ViewTool, SplitTool, TrimTool, ExpandTool, ConcatTool } from '@/lib/tools';
import { BATCH_OPERATIONS, BatchOperationDefinition } from '@/operations';
import { Dialog, DialogContent } from './components/ui/dialog';

async function inspected<T>(func: () => Promise<T>, successMessage: string | ((val: T) => string) | null = null) {
  let result;
  try {
    result = await func();
    if (successMessage === null) { }
    else if (typeof successMessage == 'string') {
      toast.success(successMessage);
    }
    else if (typeof successMessage == 'function') {
      toast.success(successMessage(result));
    }
  } catch (e) {
    if (e instanceof Error) {
      toast.error('Failed: ' + e.message);
    } else {
      toast.error('Failed: ' + String(e));
    }
  }
  return result;
}

function App() {
  const { appState, select, refresh, loading } = useAppState();
  const [selected, setSelected] = useState<string | null>(null);
  const selectedItem = useMemo(
    () => appState.items?.find(it => it.image === selected),
    [appState, selected]
  );

  // Temporary State
  const [tempCaption, setTempCaption] = useState<string>('');
  const [tempPrefix, setTempPrefix] = useState<string>('');

  // used only for refreshing image
  const [timestamp, setTimestamp] = useState(() => new Date().getTime());

  const [running, setRunning] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<BatchOperationDefinition | null>(null);

  useEffect(() => {
    if (selectedItem) {
      setTempCaption(selectedItem.captionStr);
    }
  }, [selectedItem]);

  useEffect(() => {
    if (appState.captionPrefix !== undefined) {
      setTempPrefix(appState.captionPrefix);
    }
  }, [appState.captionPrefix]);

  const itemsRef = useRef(appState.items);
  useEffect(() => {
    itemsRef.current = appState.items;
  }, [appState.items]);

  // Tools State
  const tools = useMemo(() => [
    new ViewTool(),
    new BrushTool(),
    new RectangleTool(),
    new SplitTool(),
    new TrimTool(),
    new ExpandTool(),
    new ConcatTool(() => itemsRef.current?.map(i => i.image) ?? [])
  ], []);
  const [activeToolId, setActiveToolId] = useState<string>(tools[0].id);
  const activeTool = tools.find(t => t.id === activeToolId)!;

  useEffect(() => {
    const promise = listen<{ paths: string[] }>(TauriEvent.DRAG_DROP, async event => {
      await inspected(() => onDrag(event.payload.paths));
      await refresh();
    });

    return () => {
      promise.then(f => f());
    }
  }, []);

  const handleToolChange = (toolId: string) => {
    tools.forEach(t => t.reset());
    setActiveToolId(toolId);
  };

  const handleReset = () => {
    activeTool.reset();
  };

  const handleSave = async () => {
    setRunning(true);

    const data = {
      tool: {
        id: activeTool.id,
        ...activeTool.getData()
      },
      current: selectedItem!.image,
      caption: tempCaption,
      captionPrefix: tempPrefix,
    };

    let nextSelected = await inspected(async () => {
      return await save(data);
    }, 'Saved');

    setRunning(false);

    if (nextSelected) {
      setSelected(nextSelected);
    }
    await refresh();
    activeTool.reset();
    setTimestamp(new Date().getTime());

    console.log('Serialized Data:', JSON.stringify(data, null, 2));
  };

  const handleDelete = async (item: string) => {
    setRunning(true);
    await inspected(async () => {
      await deleteItem(item);
      if (selected === item) {
        setSelected(null);
      }
      await refresh();
    }, 'Deleted');
    setRunning(false);
  };

  const runOperation = async (op: BatchOperationDefinition, options?: any) => {
    setRunning(true);
    setPendingOperation(null);
    await inspected(async () => {
      await op.execute({
        appState,
        selectedItem,
        toast
      }, options);
    });
    setRunning(false);
    await refresh();
    setTimestamp(() => new Date().getTime());
  };

  const handleMenu = async (op: Operation) => {
    if (op === 'file:open_folder') {
      await select();
    } else if (op === 'file:refresh') {
      await refresh();
      setTimestamp(new Date().getTime());
    } else if (op === 'file:close') {
      await closeFolder();
      await refresh();
      setTimestamp(new Date().getTime());
    } else if (op.startsWith('batch:')) {
      const opId = op.split(':')[1];
      const operation = BATCH_OPERATIONS.find(o => o.id === opId);
      if (operation) {
        if (operation.optionsComponent) {
          setPendingOperation(operation);
        } else {
          await runOperation(operation);
        }
      }
    }
  }

  return (
    <div className='w-full h-full flex flex-col'>
      <Toaster />
      <TopBar onMenuClicked={handleMenu} batchOperations={BATCH_OPERATIONS} />
      <Dialog open={!!pendingOperation} onOpenChange={(open) => !open && setPendingOperation(null)}>
        <DialogContent>
          {pendingOperation && pendingOperation.optionsComponent && (
            <pendingOperation.optionsComponent
              context={{
                appState,
                selectedItem,
                toast
              }}
              onConfirm={(opts) => runOperation(pendingOperation, opts)}
              onCancel={() => setPendingOperation(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <ResizablePanelGroup direction='horizontal'>
        <ResizablePanel defaultSize={20}>
          <ToolPanel
            tools={tools}
            activeToolId={activeToolId}
            onToolChange={handleToolChange}
            onReset={handleReset}
            onSave={handleSave}
            running={running || loading}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={60}>

          <ResizablePanelGroup direction='vertical'>
            <ResizablePanel defaultSize={80}>
              {!appState.folder && (
                <Empty className='w-full h-full'>
                  <EmptyHeader>
                    <EmptyMedia variant='icon'>
                      <Image />
                    </EmptyMedia>
                    <EmptyTitle>
                      No folders open
                    </EmptyTitle>
                    <EmptyDescription>
                      Open a dataset folder to get started
                    </EmptyDescription>
                  </EmptyHeader>

                  <EmptyContent>
                    <Button onClick={() => select()}>
                      Select folder
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
              {appState.folder && selectedItem && (
                <ImagePanel
                  src={convertFileSrc(selectedItem.image) + `?_=${timestamp}`}
                  activeTool={activeTool}
                />
              )}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={20}>
              {selectedItem && (
                <CaptionPanel
                  caption={tempCaption}
                  onCaptionChange={setTempCaption}
                  prefix={tempPrefix}
                  onPrefixChange={setTempPrefix}
                />
              )}
            </ResizablePanel>
          </ResizablePanelGroup>

        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={20}>

          <FilesPanel
            items={appState.items?.map(val => val.image) ?? []}
            onSelect={val => {
              handleReset();
              setSelected(val);
            }}
            selected={selected}
            onDelete={handleDelete}
          />

        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  )
}

export default App
