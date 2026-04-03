import { Button } from "../ui/button";
import { Expand, ListCollapse } from "lucide-react";

interface ExpandAllButtonProps {
  readonly isAllExpanded: boolean;
  readonly onToggleExpandAll: () => void;
}

function ExpandAllButton({ isAllExpanded, onToggleExpandAll }: ExpandAllButtonProps) {
    const toggleAllExpanded = (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpandAll();
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