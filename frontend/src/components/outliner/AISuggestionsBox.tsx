import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Square } from 'lucide-react';
import type { AISuggestions } from './types';

interface AISuggestionsBoxProps {
  suggestions: AISuggestions | null;
  loading: boolean;
  onDetect: () => void;
  onStop: () => void;
}

export const AISuggestionsBox: React.FC<AISuggestionsBoxProps> = ({
  suggestions,
  loading,
  onDetect,
  onStop,
}) => {
  const { t } = useTranslation();

  const button_classname: string = "h-auto m-2 p-0 hover:bg-transparent hover:text-primary float-right absolute right-0 top-2 cursor-pointer";

  return (
    <>
       
        {loading ?(
          <Button
            type="button"
            variant="ghost"
            onClick={onStop}
            className={button_classname+" animate-spin"}
            title={t('outliner.aiDetect.stop')}
          >
               <Sparkles className="w-4 h-4" />
          </Button>
        ): <Button
        type="button"
        variant="ghost"
        onClick={onDetect}
        disabled={loading}
        title={t('outliner.aiDetect.detectTitleAuthor')}
        className={button_classname}
      >
      
      <Sparkles className="w-4 h-4" />
      </Button>}

      
    </>
  );
};
