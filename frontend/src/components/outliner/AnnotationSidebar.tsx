import { forwardRef, useImperativeHandle, useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import type { TextSegment } from './types';
import { TitleField, type TitleFieldRef } from './sidebarFields/TitleField';
import { AuthorField, type AuthorFieldRef } from './sidebarFields/AuthorField';
import { AISuggestionsBox } from './AISuggestionsBox';
import { useAISuggestions } from '@/hooks/useAISuggestions';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import { useComment } from '@/hooks/useComment';
import { useUser } from '@/hooks/useUser';
import CommentView from './comment/CommentView';
import { toast } from 'sonner';
import Comments from './comment/Comment';

interface AnnotationSidebarProps {
  activeSegment: TextSegment | undefined;
  documentId?: string;
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
  documentId,
}, ref) => {
  const {document} = useOutlinerDocument();
  const { updateSegment: updateSegmentMutation, createCommentMutation } = useOutlinerDocument();
  const { user } = useUser();
  const activeSegmentId = activeSegment?.id || null;
  const title = activeSegment?.title || '';
  const author = activeSegment?.author || '';
  
  // Fetch comments separately using useComment hook
  const { comments, isLoading: isLoadingComments } = useComment(activeSegmentId, {
    enabled: !!activeSegmentId,
  });
  
  // Form data that resets when segment changes
  const [formData, setFormData] = useState<FormDataType>({ title: {name: title, bdrc_id: ''}, author: {name: author, bdrc_id: ''}});
  // Comment input state
  const [commentContent, setCommentContent] = useState('');
  // Track pending changes per segment
  const pendingChangesRef = useRef<Map<string, FormDataType>>(new Map());
  
  // Refs for field components
  const titleFieldRef = useRef<TitleFieldRef>(null);
  const authorFieldRef = useRef<AuthorFieldRef>(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    setTitleValueWithoutUpdate: (value: string) => {
      titleFieldRef.current?.setValueWithoutUpdate(value);
    },
    setAuthorValueWithoutUpdate: (value: string) => {
      authorFieldRef.current?.setValueWithoutUpdate(value);
    },
    getPendingChanges: () => {
      const changes: PendingChanges[] = [];
      pendingChangesRef.current.forEach((data, segmentId) => {
        changes.push({
          segmentId,
          title: data.title,
          author: data.author,
        });
      });
      return changes;
    },
  }), []);

  // Reset formData when segment changes
  useEffect(() => {
    if (activeSegment) {
      setFormData({ title: {name: title, bdrc_id: ''}, author: {name: author, bdrc_id: ''}});
      setCommentContent(''); // Reset comment input when segment changes
    }
  }, [activeSegment, title, author]);

  // Handle title update
  const handleTitleUpdate = useCallback((value: string) => {
    setFormData(prev => {
      const updatedTitle: Title = { ...prev.title, name: value };
      const updated = { ...prev, title: updatedTitle };
      if (activeSegmentId) {
        const current = pendingChangesRef.current.get(activeSegmentId) || prev;
        pendingChangesRef.current.set(activeSegmentId, { ...current, title: updatedTitle });
      }
      return updated;
    });
  }, [activeSegmentId]);

  // Handle author update
  const handleAuthorUpdate = useCallback((value: string) => {
    setFormData(prev => {
      const updatedAuthor: Author = { ...prev.author, name: value };
      const updated = { ...prev, author: updatedAuthor };
      if (activeSegmentId) {
        const current = pendingChangesRef.current.get(activeSegmentId) || prev;
        pendingChangesRef.current.set(activeSegmentId, { ...current, author: updatedAuthor });
      }
      return updated;
    });
  }, [activeSegmentId]);


  // Wrapper for AI suggestions to update formData
  const handleAIUpdate = useCallback(async (
    _segmentId: string,
    field: 'title' | 'author' | 'title_bdrc_id' | 'author_bdrc_id',
    value: string
  ) => {
    if (field === 'title' || field === 'title_bdrc_id') {
      setFormData(prev => {
        const updatedTitle: Title = {
          name: field === 'title' ? value : prev.title?.name || '',
          bdrc_id: field === 'title_bdrc_id' ? value : prev.title?.bdrc_id || ''
        };
        return { ...prev, title: updatedTitle };
      });
    } else if (field === 'author' || field === 'author_bdrc_id') {
      setFormData(prev => {
        const updatedAuthor: Author = {
          name: field === 'author' ? value : prev.author?.name || '',
          bdrc_id: field === 'author_bdrc_id' ? value : prev.author?.bdrc_id || ''
        };
        return { ...prev, author: updatedAuthor };
      });
    }
  }, []);

  // AI suggestions hook
  const aiSuggestions = useAISuggestions({
    activeSegment,
    activeSegmentId,
    documentId,
    onUpdate: handleAIUpdate,
    onTitleChange: handleTitleUpdate,
    onAuthorChange: handleAuthorUpdate,
    onShowTitleDropdown: () => {},
    onShowAuthorDropdown: () => {},
  });
  const onSave = useCallback(async () => {
    // Validate that we have an active segment
    if (!activeSegment || !activeSegmentId) {
      toast.error('No segment selected');
      return;
    }

    // Validate form data
    const titleName = formData.title?.name?.trim() || '';
    const authorName = formData.author?.name?.trim() || '';
    
    if (!titleName && !authorName) {
      toast.error('Please provide at least a title or author');
      return;
    }

    // Prepare update payload
    const updatePayload: {
      title?: string;
      author?: string;
      title_bdrc_id?: string;
      author_bdrc_id?: string;
      status?: string;
    } = {};

    if (titleName) {
      updatePayload.title = titleName;
      if (formData.title?.bdrc_id) {
        updatePayload.title_bdrc_id = formData.title.bdrc_id;
      }
    }

    if (authorName) {
      updatePayload.author = authorName;
      if (formData.author?.bdrc_id) {
        updatePayload.author_bdrc_id = formData.author.bdrc_id;
      }
    }
    updatePayload.status = 'checked';
    // Make API call to update segment using mutation
    try {
      await updateSegmentMutation(activeSegmentId, updatePayload);
      toast.success('Annotations saved successfully');
      // Clear pending changes for this segment
      if (pendingChangesRef.current.has(activeSegmentId)) {
        pendingChangesRef.current.delete(activeSegmentId);
      }
    } catch (error) {
      console.error('Failed to save annotations:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save annotations');
    }
  }, [activeSegment, activeSegmentId, formData, updateSegmentMutation]);
 
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
  setFormData({ title: {name: '', bdrc_id: ''}, author: {name: '', bdrc_id: ''}});
 }
 async function onReset(){
    resetForm();
    if(activeSegmentId){
      const newPayload={
        title: '',
        author: '',
        title_bdrc_id: '',
        author_bdrc_id: '',
        status: 'unchecked'
      }
      await updateSegmentMutation(activeSegmentId, newPayload);
    }
  }



  const text_title = document?.filename ? document.filename.replace(/\.[^/.]+$/, '') : '';
  return (
    <div className="w-96 bg-white border-r border-gray-200 flex flex-col font-monlam-2">
      <div className="p-6 overflow-y-auto flex-1">
        {activeSegment ? (
          <div className="flex flex-col flex-1 h-full space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{text_title}</h2>
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
            />
            <hr/>
            <div className='bg-neutral-200 p-3 rounded-md'>
              
            <Comments segmentId={activeSegmentId || ''} />
              </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            <p>No segment selected</p>
            <p className="text-sm mt-2">Click on a segment in the workspace to annotate it</p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex gap-2 p-6 border-t border-gray-200 bg-white">
        <Button
          type="button"
          className='flex-1'
          onClick={onSave}
          variant="default"
          disabled={!activeSegmentId || formData.title.name.trim() === '' || formData.author.name.trim() === ''}
        >
          Save
        </Button>
        <Button
          type="button"
          onClick={onReset}
          variant="outline"
          disabled={!activeSegmentId}
        >
          Reset
        </Button>
      </div>
    </div>
  );
});

AnnotationSidebar.displayName = 'AnnotationSidebar';
