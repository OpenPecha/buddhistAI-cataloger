
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {  MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";


function PublishOptions({handlePublishToWebuddhist}: {handlePublishToWebuddhist: () => void}) {
    return (
      <div>
        <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline"><MenuIcon/> <span className="hidden sm:block">Publish</span></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuGroup>
        <DropdownMenuItem className="cursor-pointer hover:bg-gray-100 transition-colors duration-200" onClick={handlePublishToWebuddhist}>
        Webuddhist
      </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
        
      </div>
    );
  }

  export default PublishOptions;