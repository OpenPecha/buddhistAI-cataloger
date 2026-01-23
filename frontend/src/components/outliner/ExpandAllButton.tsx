import Emitter from "@/events";
import { Button } from "../ui/button";
import { useState } from "react";
import { Expand, ListCollapse } from "lucide-react";

function  ExpandAllButton() {

    const [isAllExpanded, setIsAllExpanded] = useState(false);
    
    const onExpandAll = (expand: boolean) => {
      Emitter.emit('segments:expand', expand);
    };
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full flex justify-start"
        onClick={(e) => {
          e.stopPropagation();
          setIsAllExpanded(!isAllExpanded);
          onExpandAll(isAllExpanded);
        }}
      >
        {isAllExpanded ?  <ListCollapse/>:<Expand/> }
        {isAllExpanded ? 'Collapse All' : 'Expand All'}
      </Button>
    );
  }
  
  export default ExpandAllButton;