import { CircleX, Folder, Layers, Parentheses, RefreshCcw, SquareSlash } from "lucide-react";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarSub, MenubarSubContent, MenubarSubTrigger, MenubarTrigger } from "./ui/menubar";

type FileOperation = 'open_folder' | 'close' | 'refresh';

export type Operation = `file:${FileOperation}`

export default function TopBar({
  onMenuClicked,
}: {
  onMenuClicked: (e: Operation) => void,
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
                <MenubarItem>
                  <SquareSlash /> Escape brackets
                </MenubarItem>
                <MenubarItem>
                  <Parentheses /> Unescape brackets
                </MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  )
}