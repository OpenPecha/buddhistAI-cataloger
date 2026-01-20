import { useImperativeHandle, forwardRef, useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Emitter from '@/events';
import type { TextSegment } from './types';
import { TitleField, type TitleFieldRef } from './sidebarFields/TitleField';
import { AuthorField, type AuthorFieldRef } from './sidebarFields/AuthorField';
import { AISuggestionsBox } from './AISuggestionsBox';
import { useAISuggestions } from '@/hooks/useAISuggestions';

interface AnnotationSidebarProps {
  activeSegment: TextSegment | undefined;
  textContent: string;
  segments: TextSegment[];
  documentId?: string;
  onUpdate: (segmentId: string, field: 'title' | 'author' | 'title_bdrc_id' | 'author_bdrc_id', value: string) => Promise<void>;
}

export interface Title{
  name:string,
  bdrc_id:string
}

export interface Author{
  name:string,
  bdrc_id:string
}

interface PendingChanges {
  segmentId: string;
  title?: Title;
  author?: Author;
}

export interface FormDataType {
  title: Title;
  author: Author;
}

export interface AnnotationSidebarRef {
  setTitleValueWithoutUpdate: (value: string) => void;
  setAuthorValueWithoutUpdate: (value: string) => void;
  getPendingChanges: () => PendingChanges[];
}

export const AnnotationSidebar = forwardRef<AnnotationSidebarRef, AnnotationSidebarProps>(({
  activeSegment,
  textContent,
  segments,
  documentId,
}, ref) => {
  const activeSegmentId = activeSegment?.id || null;

  const [title, setTitle] = useState<Title>({name: '', bdrc_id: ''});
  const [author, setAuthor] = useState<Author>({name: '', bdrc_id: ''});
  // Form data that resets when segment changes
  const [formData, setFormData] = useState<FormDataType>({ title: title, author: author });
  
  // Track pending changes per segment
  const pendingChangesRef = useRef<Map<string, FormDataType>>(new Map());
  
  // Refs for field components
  const titleFieldRef = useRef<TitleFieldRef>(null);
  const authorFieldRef = useRef<AuthorFieldRef>(null);

  // Reset formData when segment changes
  useEffect(() => {
    if (activeSegment) {
      setTitle({name: activeSegment.title || '', bdrc_id: activeSegment.title_bdrc_id || ''});
      setAuthor({name: activeSegment.author || '', bdrc_id: activeSegment.author_bdrc_id || ''});
    }
  }, [activeSegmentId, activeSegment]);

  // Handle title update
  const handleTitleUpdate = useCallback((value: string) => {
    setFormData(prev => {
      const updated = { ...prev, title: value };
      if (activeSegmentId) {
        const current = pendingChangesRef.current.get(activeSegmentId) || prev;
        pendingChangesRef.current.set(activeSegmentId, { ...current, title: value });
      }
      return updated;
    });
  }, [activeSegmentId]);

  // Handle author update
  const handleAuthorUpdate = useCallback((value: string) => {
    setFormData(prev => {
      const updated = { ...prev, author: value };
      if (activeSegmentId) {
        const current = pendingChangesRef.current.get(activeSegmentId) || prev;
        pendingChangesRef.current.set(activeSegmentId, { ...current, author: value });
      }
      return updated;
    });
  }, [activeSegmentId]);


  // AI suggestions hook
  const aiSuggestions = useAISuggestions({
    activeSegment,
    activeSegmentId,
    documentId,
    onUpdate,
    onTitleChange: handleTitleUpdate,
    onAuthorChange: handleAuthorUpdate,
    onShowTitleDropdown: () => {},
    onShowAuthorDropdown: () => {},
  });
  function onSave(){
    console.log(title)
    console.log(author)
  }
 
  function onUpdate( field: 'title' | 'author', value: Title | Author){
    if(field === 'title'){
    setFormData(prev => {
      const updated = { ...prev, title: value };
      return updated;
    });
  }else if(field === 'author'){
    setFormData(prev => {
      const updated = { ...prev, author: value };
      return updated;
    });
  }
  }
  function resetForm(){
    setTitle({name: '', bdrc_id: ''});
    setAuthor({name: '', bdrc_id: ''});
  }

const isDisabled = 
  (!formData.title?.name|| !formData.title?.bdrc_id || formData.author?.name|| !formData.author?.bdrc_id);
console.log(isDisabled)
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
              ref={titleFieldRef}
              segment={activeSegment}
              activeSegmentId={activeSegmentId}
              formData={formData}
              onUpdate={onUpdate}
              resetForm={resetForm}
            />

            <AuthorField
              ref={authorFieldRef}
              segment={activeSegment}
              formData={formData}
              onUpdate={onUpdate}
              resetForm={resetForm}
            />

            <AISuggestionsBox
              suggestions={aiSuggestions.aiSuggestions}
              loading={aiSuggestions.aiLoading}
              onDetect={aiSuggestions.onAIDetect}
              onStop={aiSuggestions.onAIStop}
              onUseSuggestion={aiSuggestions.onAISuggestionUse}
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
          disabled={isDisabled}
          className="w-full"
          variant="default"
        >
          Save Annotations
        </Button>
      </div>
    </div>
  );
});

AnnotationSidebar.displayName = 'AnnotationSidebar';
