import { CircleX, Folder, Layers, RefreshCcw } from "lucide-react";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarSub, MenubarSubContent, MenubarSubTrigger, MenubarTrigger } from "./ui/menubar";
import { BatchOperationDefinition } from "@/operations";

type FileOperation = 'open_folder' | 'close' | 'refresh';

export type Operation = `file:${FileOperation}` | `batch:${string}`

export default function TopBar({
  onMenuClicked,
  batchOperations = []
}: {
  onMenuClicked: (e: Operation) => void,
  batchOperations?: BatchOperationDefinition[]
}) {
  return (
    <div className='w-full'>
      <Menubar className='px-4'>
        <MenubarMenu>
          <MenubarTrigger>
            File
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => onMenuClicked('file:open_folder')}>
              <Folder /> Open folder
            </MenubarItem>
            <MenubarItem onClick={() => onMenuClicked('file:refresh')}>
              <RefreshCcw /> Refresh
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => onMenuClicked('file:close')}>
              <CircleX /> Close
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>
            Edit
          </MenubarTrigger>
          <MenubarContent>
            <MenubarSub>
              <MenubarSubTrigger>
                <Layers color='#737373' size={14} className='mr-2' /> Batch operation
              </MenubarSubTrigger>
              <MenubarSubContent>
                {batchOperations.map(op => (
                  <MenubarItem key={op.id} onClick={() => onMenuClicked(`batch:${op.id}`)}>
                    {op.icon && <op.icon />} {op.label}
                  </MenubarItem>
                ))}
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  )
}