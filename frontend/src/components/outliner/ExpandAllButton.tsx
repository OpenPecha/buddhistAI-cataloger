import { Button } from "../ui/button";
import { Expand, ListCollapse } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ExpandAllButtonProps {
  readonly isAllExpanded: boolean;
  readonly onToggleExpandAll: () => void;
}

function ExpandAllButton({ isAllExpanded, onToggleExpandAll }: ExpandAllButtonProps) {
    const { t } = useTranslation();
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
        {isAllExpanded ? t('outliner.expand.collapseAll') : t('outliner.expand.expandAll')}
      </Button>
    );
  }

export default ExpandAllButton;