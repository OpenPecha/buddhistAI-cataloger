import { forwardRef, useImperativeHandle, useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import type { TextSegment } from './types';
import { TitleField, type TitleFieldRef } from './sidebarFields/TitleField';
import { AuthorField, type AuthorFieldRef } from './sidebarFields/AuthorField';
import { AISuggestionsBox } from './AISuggestionsBox';
import { useAISuggestions } from '@/hooks/useAISuggestions';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import { toast } from 'sonner';
import Comments from './comment/Comment';
import { Loader2, RotateCcw, Save, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface AnnotationSidebarProps {
  activeSegment: TextSegment | undefined;
  documentId?: string;
  segments?: TextSegment[];
  onSegmentClick?: (segmentId: string) => void;
}

export interface Title {
  name: string,
  bdrc_id: string
}

export interface Author {
  name: string,
  bdrc_id: string
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
  isDirty: () => boolean;
  save: () => Promise<void>;
  resetDirtyState: () => void;
}

export const AnnotationSidebar = forwardRef<AnnotationSidebarRef, AnnotationSidebarProps>(({
  activeSegment,
  documentId,
  segments = [],
  onSegmentClick,
}, ref) => {
  const { document } = useOutlinerDocument();
  const { updateSegment: updateSegmentMutation, updateSegmentLoading, isRefetching } = useOutlinerDocument();
  const activeSegmentId = activeSegment?.id || null;
  const title = activeSegment?.title || '';
  const author = activeSegment?.author || '';


  // Form data that resets when segment changes
  const [formData, setFormData] = useState<FormDataType>({ title: { name: title, bdrc_id: '' }, author: { name: author, bdrc_id: '' } });
  // Track pending changes per segment
  const pendingChangesRef = useRef<Map<string, FormDataType>>(new Map());
  
  // Track if form has been modified (dirty state)
  const [isDirtyState, setIsDirtyState] = useState(false);
  const originalFormDataRef = useRef<FormDataType>({ title: { name: '', bdrc_id: '' }, author: { name: '', bdrc_id: '' } });

  // Refs for field components
  const titleFieldRef = useRef<TitleFieldRef>(null);
  const authorFieldRef = useRef<AuthorFieldRef>(null);

  // Reset formData when segment changes
  useEffect(() => {
    if (activeSegment) {
      const initialFormData = { title: { name: title, bdrc_id: '' }, author: { name: author, bdrc_id: '' } };
      setFormData(initialFormData);
      originalFormDataRef.current = initialFormData;
      setIsDirtyState(false);
    }
  }, [activeSegment, title, author]);

  // Check if form data differs from original
  const checkDirtyState = useCallback((newFormData: FormDataType) => {
    const titleChanged = newFormData.title.name !== originalFormDataRef.current.title.name ||
                         newFormData.title.bdrc_id !== originalFormDataRef.current.title.bdrc_id;
    const authorChanged = newFormData.author.name !== originalFormDataRef.current.author.name ||
                          newFormData.author.bdrc_id !== originalFormDataRef.current.author.bdrc_id;
    setIsDirtyState(titleChanged || authorChanged);
  }, []);

  // Handle title update
  const handleTitleUpdate = useCallback((value: string) => {
    setFormData(prev => {
      const updatedTitle: Title = { ...prev.title, name: value };
      const updated = { ...prev, title: updatedTitle };
      if (activeSegmentId) {
        const current = pendingChangesRef.current.get(activeSegmentId) || prev;
        pendingChangesRef.current.set(activeSegmentId, { ...current, title: updatedTitle });
      }
      checkDirtyState(updated);
      return updated;
    });
  }, [activeSegmentId, checkDirtyState]);

  // Handle author update
  const handleAuthorUpdate = useCallback((value: string) => {
    setFormData(prev => {
      const updatedAuthor: Author = { ...prev.author, name: value };
      const updated = { ...prev, author: updatedAuthor };
      if (activeSegmentId) {
        const current = pendingChangesRef.current.get(activeSegmentId) || prev;
        pendingChangesRef.current.set(activeSegmentId, { ...current, author: updatedAuthor });
      }
      checkDirtyState(updated);
      return updated;
    });
  }, [activeSegmentId, checkDirtyState]);


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
    onShowTitleDropdown: () => { },
    onShowAuthorDropdown: () => { },
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
      // Reset dirty state after successful save
      setIsDirtyState(false);
      originalFormDataRef.current = { ...formData };
    } catch (error) {
      console.error('Failed to save annotations:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save annotations');
    }
  }, [activeSegment, activeSegmentId, formData, updateSegmentMutation]);

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
    isDirty: () => isDirtyState,
    save: async () => {
      await onSave();
    },
    resetDirtyState: () => {
      setIsDirtyState(false);
      if (activeSegment) {
        originalFormDataRef.current = { ...formData };
      }
    },
  }), [isDirtyState, onSave, activeSegment, formData]);

  function onUpdate(field: 'title' | 'author', value: Title | Author) {
    if (field === 'title') {
      setFormData(prev => {
        const updated = { ...prev, title: value as Title };
        checkDirtyState(updated);
        return updated;
      });
    } else if (field === 'author') {
      setFormData(prev => {
        const updated = { ...prev, author: value as Author };
        checkDirtyState(updated);
        return updated;
      });
    }
  }
  function resetForm() {
    setFormData({ title: { name: '', bdrc_id: '' }, author: { name: '', bdrc_id: '' } });
    setIsDirtyState(false);
  }
  async function onReset() {
    resetForm();
    if (activeSegmentId) {
      const newPayload = {
        title: '',
        author: '',
        title_bdrc_id: '',
        author_bdrc_id: '',
        status: 'unchecked'
      }
      await updateSegmentMutation(activeSegmentId, newPayload);
    }
  }
  async function onUnknown() {
    if (activeSegmentId) {
      const newPayload = {
        title: '',
        author: '',
        title_bdrc_id: '',
        author_bdrc_id: '',
        status: 'checked'
      }
      await updateSegmentMutation(activeSegmentId, newPayload);
    }
  }


  const handleTocClick = useCallback((segmentId: string) => {
    onSegmentClick?.(segmentId);
    globalThis.document.getElementById(segmentId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [onSegmentClick]);

  const metadataContent = activeSegment ? (
    <div className="p-6 overflow-y-auto flex-1">
      <div className="flex flex-col flex-1 h-full space-y-6">
        <div>
          <div className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
            <div className="font-medium mb-1">Text:</div>
            <div className="text-gray-800">{activeSegment.text.slice(0, 100)}...</div>
          </div>
        </div>
        <div className="relative flex flex-col gap-4">
          {(updateSegmentLoading || isRefetching) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white bg-opacity-60">
              <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
            </div>
          )}
          {
            activeSegment.status !== 'checked'  && (
              <>
                <AISuggestionsBox
                  suggestions={aiSuggestions.aiSuggestions}
                  loading={aiSuggestions.aiLoading}
                  onDetect={aiSuggestions.onAIDetect}
                  onStop={aiSuggestions.onAIStop}
                />
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
              </>
            )
          }
        </div>


        <div className="flex gap-2 bg-white">
          {
            activeSegment.status !== 'checked' ?
              <>
                <Button
                  type="button"
                  className='flex-1'
                  onClick={onSave}
                  variant="default"
                  disabled={!activeSegmentId || (formData.title.name.trim() === '' && formData.author.name.trim() === '')}
                >
                  <Save />Save
                </Button>
                <Button
                  type="button"
                  onClick={onUnknown}
                  variant="outline"
                  disabled={!activeSegmentId}
                >
                  <X /> N/A
                </Button>
              </>
              :
              <Button
                type="button"
                onClick={onReset}
                variant="outline"
                disabled={!activeSegmentId}
                className='w-full'
              >
                <RotateCcw /> Reset
              </Button>

          }
        </div>
        <hr />

        <Comments segmentId={activeSegmentId || ''} />
      </div>
    </div>
  ) : (
    <div className="text-center text-gray-500 py-12">
      <p>No segment selected</p>
      <p className="text-sm mt-2">Click on a segment in the workspace to annotate it</p>
    </div>
  );

  return (
    <div className="w-96 bg-white border-r border-gray-200 flex flex-col font-monlam-2">
      <Tabs defaultValue="metadata" className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="w-full shrink-0 border-b border-gray-200 rounded-none">
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="text">Text</TabsTrigger>
        </TabsList>

        <TabsContent value="metadata" className="flex-1 overflow-hidden">
          {metadataContent}
        </TabsContent>

        <TabsContent value="text" className="flex-1 overflow-auto">
          <div className="p-4 space-y-1">
            {segments.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <p className="text-sm">No segments available</p>
              </div>
            ) : (
              segments.map((seg, index) => {
                const isActive = seg.id === activeSegmentId;
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => handleTocClick(seg.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-md transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 border border-blue-300'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 text-xs font-medium mt-0.5 w-6 h-6 rounded-full flex items-center justify-center ${
                        seg.status === 'checked'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm leading-snug font-monlam ${
                          isActive ? 'text-blue-900' : 'text-gray-700'
                        } ${seg.status === 'checked' ? 'opacity-50' : ''}`}>
                          {seg.text.length > 80
                            ? seg.text.slice(0, 80) + '...'
                            : seg.text}
                        </p>
                        {(seg.title || seg.author) && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {seg.title && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs">
                                {seg.title}
                              </span>
                            )}
                            {seg.author && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-xs">
                                {seg.author}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

AnnotationSidebar.displayName = 'AnnotationSidebar';
