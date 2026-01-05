import TopBar, { Operation } from '@/components/topbar'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import ToolPanel from './components/tool-panel'
import { useEffect, useMemo, useState } from 'react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './components/ui/empty';
import { Image } from 'lucide-react';
import { Button } from './components/ui/button';
import FilesPanel from './components/files-panel';
import CaptionPanel from './components/caption-panel';
import ImagePanel from './components/image-panel';
import { useAppState } from './lib/hooks';
import { convertFileSrc } from '@tauri-apps/api/core';
import { closeFolder, save } from './client/apiClient';
import { BrushTool, RectangleTool, ViewTool, SplitTool, TrimTool, ExpandTool } from '@/lib/tools';

import './App.css'
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';

function App() {
  const { appState, select, refresh } = useAppState();
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

  // Tools State
  const tools = useMemo(() => [
    new ViewTool(),
    new BrushTool(),
    new RectangleTool(),
    new SplitTool(),
    new TrimTool(),
    new ExpandTool()
  ], []);
  const [activeToolId, setActiveToolId] = useState<string>(tools[0].id);
  const activeTool = tools.find(t => t.id === activeToolId)!;

  const handleToolChange = (toolId: string) => {
    tools.forEach(t => t.reset());
    setActiveToolId(toolId);
  };

  const handleReset = () => {
    activeTool.reset();
  };

  const handleSave = async () => {
    const data = {
      tool: {
        id: activeTool.id,
        ...activeTool.getData()
      },
      current: selectedItem!.image,
      caption: tempCaption,
      captionPrefix: tempPrefix,
    };
    
    let nextSelected;
    try {
      nextSelected = await save(data);
      toast.success('Saved');
    }
    catch (e) {
      if (e instanceof Error) {
        toast.error('Failed: ' + e.message);
      }
    }
    if (nextSelected) {
      setSelected(nextSelected);
    }
    await refresh();
    activeTool.reset();
    setTimestamp(new Date().getTime());

    console.log('Serialized Data:', JSON.stringify(data, null, 2));
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
    }
  }

  return (
    <div className='w-full h-full flex flex-col'>
      <Toaster />
      <TopBar onMenuClicked={handleMenu} />
      <ResizablePanelGroup direction='horizontal'>
        <ResizablePanel defaultSize={20}>
          <ToolPanel
            tools={tools}
            activeToolId={activeToolId}
            onToolChange={handleToolChange}
            onReset={handleReset}
            onSave={handleSave}
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
          />

        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  )
}

export default App
