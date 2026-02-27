import Emitter from "@/events";
import { Button } from "../ui/button";
import { Expand, ListCollapse } from "lucide-react";

interface ExpandAllButtonProps {
  readonly isAllExpanded: boolean;
  readonly setIsAllExpanded: (v: boolean) => void;
}

function ExpandAllButton({ isAllExpanded, setIsAllExpanded }: ExpandAllButtonProps) {
    const toggleAllExpanded = (e: React.MouseEvent) => {
      e.stopPropagation();;
      setIsAllExpanded(!isAllExpanded);
      Emitter.emit('segments:expand', isAllExpanded);
    };

    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full flex justify-start"
        onClick={toggleAllExpanded}
      >
        {isAllExpanded ? <ListCollapse/> : <Expand/>}
        {isAllExpanded ? 'Collapse All' : 'Expand All'}
      </Button>
    );
  }

export default ExpandAllButton;