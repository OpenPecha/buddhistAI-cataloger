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
  return (
    <>
      {/* AI Auto-detect Button */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onDetect}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Auto-detect Title & Author
            </>
          )}
        </Button>
        {loading && (
          <Button
            type="button"
            variant="outline"
            onClick={onStop}
            className="px-3 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
            title="Stop AI suggestion"
          >
            <Square className="w-4 h-4" />
          </Button>
        )}
      </div>

      
    </>
  );
};
