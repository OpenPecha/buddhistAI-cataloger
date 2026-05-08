import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EllipsisVertical, Undo } from "lucide-react";
import { useTranslation } from "react-i18next";
import ExpandAllButton from "../ExpandAllButton";
import { useActions } from "../contexts";

function WorkSpaceHeaderMenu() {
    const { t } = useTranslation();
    const {onResetSegments,isAllSegmentsExpanded, toggleExpandAllSegments} = useActions();
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <EllipsisVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onResetSegments && (
            <DropdownMenuItem
              onClick={onResetSegments}
              className="text-red-600 hover:bg-red-50"
            >
              <Undo />
              {t('outliner.workspace.resetAllSegments')}
            </DropdownMenuItem>
          )}
        
          <ExpandAllButton isAllExpanded={isAllSegmentsExpanded} onToggleExpandAll={toggleExpandAllSegments}/>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  
  
export default WorkSpaceHeaderMenu;  