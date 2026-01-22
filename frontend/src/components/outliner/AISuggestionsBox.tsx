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

      {/* AI Suggestions Box */}
      {suggestions && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Suggestions
          </div>
          <div className="space-y-3">
            {/* Title Suggestion */}
            {(suggestions.suggested_title || suggestions.title) && (
              <div>
                <div className="text-xs text-blue-600 font-medium mb-1">Title:</div>
                <div className="text-sm text-blue-900 mb-2">
                  {suggestions.title || suggestions.suggested_title}
                </div>
             
              </div>
            )}
            {/* Author Suggestion */}
            {(suggestions.suggested_author || suggestions.author) && (
              <div>
                <div className="text-xs text-blue-600 font-medium mb-1">Author:</div>
                <div className="text-sm text-blue-900 mb-2">
                  {suggestions.author || suggestions.suggested_author}
                </div>
              
              </div>
            )}
            {/* Show message if no suggestions */}
            {!suggestions.suggested_title &&
              !suggestions.title &&
              !suggestions.suggested_author &&
              !suggestions.author && (
                <div className="text-sm text-blue-700 italic">
                  No suggestions available for this segment.
                </div>
              )}
          </div>
        </div>
      )}
    </>
  );
};
