import React from 'react';
import { Button } from '@/components/ui/button';
import type { TextSegment } from './types';
import { TitleField } from './TitleField';
import { AuthorField } from './AuthorField';
import { AISuggestionsBox } from './AISuggestionsBox';

interface AnnotationSidebarProps {
  activeSegment: TextSegment | undefined;
  textContent: string;
  segments: TextSegment[];
  onSave: () => void;
  // Title field props
  titleValue: string;
  titleResults: Array<{ workId?: string; instanceId?: string; title?: string }>;
  titleLoading: boolean;
  showTitleDropdown: boolean;
  titleInputRef: React.RefObject<HTMLInputElement | null>;
  onTitleChange: (value: string) => void;
  onTitleFocus: () => void;
  onTitleSelect: (title: { workId?: string; instanceId?: string; title?: string }) => void;
  onTitleBdrcIdClear: () => void;
  // Author field props
  authorValue: string;
  authorResults: Array<{ bdrc_id?: string; name?: string }>;
  authorLoading: boolean;
  showAuthorDropdown: boolean;
  authorInputRef: React.RefObject<HTMLInputElement | null>;
  onAuthorChange: (value: string) => void;
  onAuthorFocus: () => void;
  onAuthorSelect: (author: { bdrc_id?: string; name?: string }) => void;
  onAuthorBdrcIdClear: () => void;
  // AI suggestions props
  aiSuggestions: { title: string | null; suggested_title: string | null; author: string | null; suggested_author: string | null } | null;
  aiLoading: boolean;
  onAIDetect: () => void;
  onAIStop: () => void;
  onAISuggestionUse: (field: 'title' | 'author', value: string) => void;
}

export const AnnotationSidebar: React.FC<AnnotationSidebarProps> = ({
  activeSegment,
  textContent,
  segments,
  onSave,
  titleValue,
  titleResults,
  titleLoading,
  showTitleDropdown,
  titleInputRef,
  onTitleChange,
  onTitleFocus,
  onTitleSelect,
  onTitleBdrcIdClear,
  authorValue,
  authorResults,
  authorLoading,
  showAuthorDropdown,
  authorInputRef,
  onAuthorChange,
  onAuthorFocus,
  onAuthorSelect,
  onAuthorBdrcIdClear,
  aiSuggestions,
  aiLoading,
  onAIDetect,
  onAIStop,
  onAISuggestionUse,
}) => {
  return (
    <div className="w-96 bg-white border-r border-gray-200 flex flex-col font-monlam-2">
      <div className="p-6 overflow-y-auto flex-1">
        {activeSegment ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Boundary Detection</h2>
              <div className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="font-medium mb-1">Text:</div>
                <div className="text-gray-800">{activeSegment.text.slice(0, 100)}...</div>
              </div>
            </div>

            <TitleField
              segment={activeSegment}
              value={titleValue}
              results={titleResults}
              loading={titleLoading}
              showDropdown={showTitleDropdown}
              inputRef={titleInputRef}
              onChange={onTitleChange}
              onFocus={onTitleFocus}
              onSelect={onTitleSelect}
              onBdrcIdClear={onTitleBdrcIdClear}
            />

            <AuthorField
              segment={activeSegment}
              value={authorValue}
              results={authorResults}
              loading={authorLoading}
              showDropdown={showAuthorDropdown}
              inputRef={authorInputRef}
              onChange={onAuthorChange}
              onFocus={onAuthorFocus}
              onSelect={onAuthorSelect}
              onBdrcIdClear={onAuthorBdrcIdClear}
            />

            <AISuggestionsBox
              suggestions={aiSuggestions}
              loading={aiLoading}
              onDetect={onAIDetect}
              onStop={onAIStop}
              onUseSuggestion={onAISuggestionUse}
            />
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            <p>No segment selected</p>
            <p className="text-sm mt-2">Click on a segment in the workspace to annotate it</p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="p-6 border-t border-gray-200 bg-white">
        <Button
          type="button"
          onClick={onSave}
          disabled={!textContent || segments.length === 0}
          className="w-full"
          variant="default"
        >
          Save Annotations
        </Button>
      </div>
    </div>
  );
};
