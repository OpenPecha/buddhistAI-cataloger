import React from 'react';
import { X } from 'lucide-react';
import { type BdrcSearchResult } from '../hooks/uesBDRC';

interface SelectedTextDisplayProps {
  selectedBdrcResult: BdrcSearchResult | null;
  textId: string | null;
  textTitle?: string | null;
  onReset: () => void;
}

export function SelectedTextDisplay({
  selectedBdrcResult,
  textId,
  textTitle,
  onReset,
}: SelectedTextDisplayProps) {
  // Show if we have either BDRC result or textId (for local text selections)
  if (!textId) {
    return null;
  }
  // Determine display title
  const displayTitle = selectedBdrcResult 
    ? (selectedBdrcResult.title || 'Untitled')
    : (textTitle || 'Untitled');

  return (
    <div className="rounded-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Selected Text
          </h3>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-900">
              {displayTitle}
            </p>
            {selectedBdrcResult?.workId && (
              <p className="text-xs text-gray-500">
                BDRC ID: {selectedBdrcResult.workId}
              </p>
            )}
            
          </div>
        </div>
        <button
          onClick={onReset}
          className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          title="Reset selection"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

