import React from 'react';
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


  const button_classname: string = "h-auto p-0 hover:bg-transparent hover:text-primary float-right absolute right-0 top-0 cursor-pointer";

  return (
    <>
       
        {loading ?(
          <Button
            type="button"
            variant="ghost"
            onClick={onStop}
            className={button_classname}
            title="Stop AI suggestion"
          >
            <Square className="w-4 h-4" />
          </Button>
        ): <Button
        type="button"
        variant="ghost"
        onClick={onDetect}
        disabled={loading}
        title="Detect Title & Author"
        className={button_classname}
      >
      
            <Sparkles className="w-4 h-4" />
      </Button>}

      
    </>
  );
};
