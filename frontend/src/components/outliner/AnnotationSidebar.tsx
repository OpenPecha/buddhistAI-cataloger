import { forwardRef, useImperativeHandle, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { TextSegment } from './types';
import { segmentLabelDisplay } from './segment-label';
import { FilterSegments, type LabelFilterValue, type CompletionFilterValue } from './FilterSegments';
import { TitleField } from './sidebarFields/TitleField';
import { AuthorField } from './sidebarFields/AuthorField';
import BDRCField from './sidebarFields/BDRCField';
import { AISuggestionsBox } from './AISuggestionsBox';
import { useAISuggestions, type PersistAIAnnotationsArgs } from '@/hooks/useAISuggestions';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import type { SegmentUpdateRequest } from '@/api/outliner';
import { toast } from 'sonner';
import { RotateCcw, Save, User, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';


interface AnnotationSidebarProps {
  activeSegment: TextSegment | undefined;
  listRef: React.RefObject<List>;
  documentId?: string;
  segments?: TextSegment[];
  onSegmentClick?: (segmentId: string) => void;
}

export interface Title {
  name: string,
  bdrc_id: string
}

export interface Author {
  id: string,
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

export type DocTextSpan = { start: number; end: number };

export interface AnnotationSidebarRef {
  setTitleValueWithoutUpdate: (value: string, docSpan?: DocTextSpan | null) => void;
  setAuthorValueWithoutUpdate: (value: string, docSpan?: DocTextSpan | null) => void;
  getPendingChanges: () => PendingChanges[];
  isDirty: () => boolean;
  save: () => Promise<void>;
  resetDirtyState: () => void;
}

export const AnnotationSidebar = forwardRef<AnnotationSidebarRef, AnnotationSidebarProps>(({
  activeSegment,
  listRef,
  documentId,
  segments = [],
  onSegmentClick,
}, ref) => {
  const { updateSegment: updateSegmentMutation, document } = useOutlinerDocument();
  const activeSegmentId = activeSegment?.id || null;
  const fullDocumentContent = document?.content ?? '';
  const titleSourceSpanRef = useRef<DocTextSpan | null>(null);
  const authorSourceSpanRef = useRef<DocTextSpan | null>(null);
  /** Last title/author strings applied by AI detect (for updated_* on save). Cleared when segment id changes or bubble selects text. */
  const aiBaselineTitleRef = useRef<string | null>(null);
  const aiBaselineAuthorRef = useRef<string | null>(null);
  const loadedSegmentIdRef = useRef<string | null>(null);
  const title = activeSegment?.title || '';
  const author = activeSegment?.author || '';


  // Form data that resets when segment changes
  const [formData, setFormData] = useState<FormDataType>({ title: { name: title, bdrc_id: '' }, author: { name: author, bdrc_id: '' } });
  // Track pending changes per segment
  const pendingChangesRef = useRef<Map<string, FormDataType>>(new Map());
  
  // Track if form has been modified (dirty state)
  const [isDirtyState, setIsDirtyState] = useState(false);
  const originalFormDataRef = useRef<FormDataType>({ title: { name: '', bdrc_id: '' }, author: { name: '', bdrc_id: '' } });

  // Local state for "title supplied by annotator" checkbox; only persisted on save
  const [suppliedTitleChecked, setSuppliedTitleChecked] = useState(false);

  // Reset formData and is_supplied_title checkbox when segment changes
  useEffect(() => {
    if (activeSegment) {
      if (loadedSegmentIdRef.current !== activeSegment.id) {
        loadedSegmentIdRef.current = activeSegment.id;
        aiBaselineTitleRef.current = null;
        aiBaselineAuthorRef.current = null;
      }
      const initialFormData = {
        title: { name: title, bdrc_id: activeSegment.title_bdrc_id || '' },
        author: { name: author, bdrc_id: activeSegment.author_bdrc_id || '' },
      };
      setFormData(initialFormData);
      originalFormDataRef.current = initialFormData;
      setIsDirtyState(false);
      setSuppliedTitleChecked(activeSegment.is_supplied_title ?? false);
      titleSourceSpanRef.current =
        activeSegment.title_span_start != null && activeSegment.title_span_end != null
          ? { start: activeSegment.title_span_start, end: activeSegment.title_span_end }
          : null;
      authorSourceSpanRef.current =
        activeSegment.author_span_start != null && activeSegment.author_span_end != null
          ? { start: activeSegment.author_span_start, end: activeSegment.author_span_end }
          : null;
    }
  }, [activeSegment, title, author]);

  const persistAIAnnotations = useCallback(
    async ({
      titleValue,
      authorValue,
      titleSpan,
      authorSpan,
    }: PersistAIAnnotationsArgs) => {
      if (!activeSegmentId) return;

      const patch: SegmentUpdateRequest = {};
      if (titleValue) {
        titleSourceSpanRef.current = titleSpan;
        aiBaselineTitleRef.current = titleValue;
        patch.title = titleValue;
        patch.title_span_start = titleSpan?.start ?? null;
        patch.title_span_end = titleSpan?.end ?? null;
        patch.updated_title = null;
      }
      if (authorValue) {
        authorSourceSpanRef.current = authorSpan;
        aiBaselineAuthorRef.current = authorValue;
        patch.author = authorValue;
        patch.author_span_start = authorSpan?.start ?? null;
        patch.author_span_end = authorSpan?.end ?? null;
        patch.updated_author = null;
      }
      if (Object.keys(patch).length === 0) return;
      await updateSegmentMutation(activeSegmentId, patch);
    },
    [activeSegmentId, updateSegmentMutation]
  );

  const handleSuppliedTitleChange = useCallback((checked: boolean) => {
    if (checked) {
      titleSourceSpanRef.current = null;
      aiBaselineTitleRef.current = null;
    }
    setSuppliedTitleChecked(checked);
  }, []);

 



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
    persistAIAnnotations,
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

    const updatePayload: SegmentUpdateRequest = { status: 'checked' };

    if (titleName || titleName==='') {
      updatePayload.title = titleName;
      if (formData.title?.bdrc_id) {
        updatePayload.title_bdrc_id = formData.title.bdrc_id;
      }
      updatePayload.is_supplied_title = suppliedTitleChecked;
      const tspan = titleSourceSpanRef.current;
      const aiTitleBase = aiBaselineTitleRef.current?.trim() ?? null;
      if (tspan) {
        updatePayload.title_span_start = tspan.start;
        updatePayload.title_span_end = tspan.end;
      } else {
        updatePayload.title_span_start = null;
        updatePayload.title_span_end = null;
      }
      if (aiTitleBase !== null) {
        updatePayload.updated_title = titleName.trim() !== aiTitleBase ? titleName : null;
      } else if (tspan) {
        const sourceSlice = fullDocumentContent.slice(tspan.start, tspan.end);
        updatePayload.updated_title = titleName !== sourceSlice ? titleName : null;
      } else {
        const inSegment = activeSegment.text.includes(titleName.trim());
        updatePayload.updated_title = !inSegment ? titleName : null;
      }
    }

    if (authorName || authorName==='') {
      updatePayload.author = authorName;
      if (formData.author?.bdrc_id) {
        updatePayload.author_bdrc_id = formData.author.bdrc_id;
      }
      const aspan = authorSourceSpanRef.current;
      const aiAuthorBase = aiBaselineAuthorRef.current?.trim() ?? null;
      if (aspan) {
        updatePayload.author_span_start = aspan.start;
        updatePayload.author_span_end = aspan.end;
      } else {
        updatePayload.author_span_start = null;
        updatePayload.author_span_end = null;
      }
      if (aiAuthorBase !== null) {
        updatePayload.updated_author = authorName.trim() !== aiAuthorBase ? authorName : null;
      } else if (aspan) {
        const sourceSlice = fullDocumentContent.slice(aspan.start, aspan.end);
        updatePayload.updated_author = authorName !== sourceSlice ? authorName : null;
      } else {
        const inSegment = activeSegment.text.includes(authorName.trim());
        updatePayload.updated_author = !inSegment ? authorName : null;
      }
    }
    // Make API call to update segment using mutation
    try {
      await updateSegmentMutation(activeSegmentId, updatePayload);
      if (titleName) {
        aiBaselineTitleRef.current = titleName.trim();
      }
      if (authorName) {
        aiBaselineAuthorRef.current = authorName.trim();
      }
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
  }, [
    activeSegment,
    activeSegmentId,
    formData,
    suppliedTitleChecked,
    updateSegmentMutation,
    fullDocumentContent,
  ]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    setTitleValueWithoutUpdate: (value: string, docSpan?: DocTextSpan | null) => {
      if (docSpan !== undefined) {
        titleSourceSpanRef.current = docSpan;
        if (docSpan != null) {
          aiBaselineTitleRef.current = null;
        }
      }
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
    },
    setAuthorValueWithoutUpdate: (value: string, docSpan?: DocTextSpan | null) => {
      if (docSpan !== undefined) {
        authorSourceSpanRef.current = docSpan;
        if (docSpan != null) {
          aiBaselineAuthorRef.current = null;
        }
      }
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
  }), [isDirtyState, onSave, activeSegment, formData, activeSegmentId, checkDirtyState]);

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
    aiBaselineTitleRef.current = null;
    aiBaselineAuthorRef.current = null;
    if (activeSegmentId) {
      const newPayload: SegmentUpdateRequest = {
        title: '',
        author: '',
        title_bdrc_id: '',
        author_bdrc_id: '',
        title_span_start: null,
        title_span_end: null,
        updated_title: null,
        author_span_start: null,
        author_span_end: null,
        updated_author: null,
        status: 'unchecked',
      };
      await updateSegmentMutation(activeSegmentId, newPayload);
    }
  }
  async function onUnknown() {
    aiBaselineTitleRef.current = null;
    aiBaselineAuthorRef.current = null;
    if (activeSegmentId) {
      const newPayload: SegmentUpdateRequest = {
        title: '',
        author: '',
        title_bdrc_id: '',
        author_bdrc_id: '',
        title_span_start: null,
        title_span_end: null,
        updated_title: null,
        author_span_start: null,
        author_span_end: null,
        updated_author: null,
        status: 'checked',
      };
      await updateSegmentMutation(activeSegmentId, newPayload);
    }
  }


  const handleToClick = useCallback((segmentId: string) => {
    onSegmentClick?.(segmentId);
    const index = segments.findIndex((segment) => segment.id === segmentId);
    const list = listRef.current;
    list?.scrollToRow({
      align: "start", // optional
      behavior: "auto", // optional
      index: index
    });
  }, [onSegmentClick]);

  const hasLabelledSegment = Boolean(activeSegment?.label);
  const isMetadataDisabled = !activeSegment || !hasLabelledSegment;
  const showBdrcMatch = activeSegment?.label === 'TEXT';

  const metadataContent = activeSegment ? (
    <div className="px-2 py-3 flex flex-col flex-1 min-h-0 h-full">
      <div className="overflow-y-auto h-min space-y-6">
        <div className="relative">
          <div className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-md ">
            <div className="font-medium mb-1">Text:</div>
            <div className="text-gray-800">{activeSegment.text.slice(0, 100)}...</div>
          </div>
          {
            activeSegment.status !== 'checked' && (
              <AISuggestionsBox
                suggestions={aiSuggestions.aiSuggestions}
                loading={aiSuggestions.aiLoading}
                onDetect={aiSuggestions.onAIDetect}
                onStop={aiSuggestions.onAIStop}
              />
            )}
        </div>
       
        {
         activeSegment.label!=='TOC' &&
          <div className="relative flex flex-col gap-4">
          
          <TitleField
            formData={formData}
            onUpdate={onUpdate}
            suppliedTitleChecked={suppliedTitleChecked}
            onSuppliedTitleChange={handleSuppliedTitleChange}
            disabled={activeSegment.status === 'checked'}
          />
          <AuthorField
            segment={activeSegment}
            formData={formData}
            onUpdate={onUpdate}
            resetForm={resetForm}
            disabled={activeSegment.status === 'checked'}
          />

      
        </div>
        }

      </div>

      <div className="shrink-0 flex gap-2 bg-white pt-3 mt-2 border-t border-gray-100">
        {activeSegment.status !== 'checked' ? (
          <>
            {activeSegment.label!=='TOC' &&<Button
              type="button"
              className="flex-1"
              onClick={onSave}
              variant="default"
              disabled={
                !activeSegmentId ||
                (formData.title.name.trim() === '' && formData.author.name.trim() === '') 
              }
            >
              <Save />Save
            </Button>}
            <Button
              type="button"
              onClick={onUnknown}
              variant="outline"
              className='flex-1'
              disabled={!activeSegmentId}
            >
              <X /> N/A
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={onReset}
            variant="outline"
            disabled={!activeSegmentId}
            className="w-full"
          >
            <RotateCcw /> Reset
          </Button>
        )}
      </div>
      
      <hr className="shrink-0 mt-3 border-gray-200" />

      {/* <Comments segmentId={activeSegmentId || ''} /> */}
    </div>
  ) : (
    <div className="text-center text-gray-500 py-12">
      <p>No segment selected</p>
      <p className="text-sm mt-2">Click on a segment in the workspace to annotate it</p>
    </div>
  );

  const [activeTab, setActiveTab] = useState('outlines');
  const [labelFilter, setLabelFilter] = useState<LabelFilterValue[]>([]);
  const [completionFilter, setCompletionFilter] = useState<CompletionFilterValue>('all');

  const filteredSegments = useMemo(() => {
    let list = segments;
    if (labelFilter.length > 0) {
      const set = new Set(labelFilter);
      list = list.filter((seg) =>
        seg.label ? set.has(seg.label) : set.has('none')
      );
    }
    if (completionFilter === 'completed') {
      list = list.filter((seg) => seg.status === 'checked');
    } else if (completionFilter === 'not_completed') {
      list = list.filter((seg) => seg.status !== 'checked');
    }
    return list;
  }, [segments, labelFilter, completionFilter]);

  useEffect(() => {
    if (isMetadataDisabled && activeTab === 'metadata') {
      setActiveTab('outlines');
    }
  }, [isMetadataDisabled, activeTab]);

  return (
    <div className="h-full min-h-0 w-full bg-white flex flex-col font-monlam-2 border-r-2 border-gray-200">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="w-full shrink-0 border-b border-gray-200 rounded-none">
          <TabsTrigger value="outlines">Outlines</TabsTrigger>
          <span
            title={isMetadataDisabled ? 'Only available for labelled segments' : undefined}
            className={`flex-1 flex ${isMetadataDisabled ? 'inline-flex ' : undefined}`}
          >
            <TabsTrigger value="metadata" disabled={isMetadataDisabled}>
              Metadata
            </TabsTrigger>
          </span>
        </TabsList>

      

        <TabsContent value="outlines" className="flex-1 overflow-auto">
          <div className="space-y-1">
            <FilterSegments
              value={labelFilter}
              onChange={setLabelFilter}
              completionFilter={completionFilter}
              onCompletionFilterChange={setCompletionFilter}
            />
            <div className=" px-2 py-2">

            {filteredSegments.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <p className="text-sm">
                  {segments.length === 0 ? 'No segments available' : 'No segments match the selected filters'}
                </p>
              </div>
            ) : (
              filteredSegments.map((seg, index) => {
                const isActive = seg.id === activeSegmentId;
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => handleToClick(seg.id)}
                    className={` w-full text-left px-3 py-2.5 rounded-md transition-colors cursor-pointer ${
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
                          { seg.title? seg.title : seg.text.length > 80
                            ? seg.text.slice(0, 80) + '...'
                            : seg.text}
                        </p>
                        {(seg.label || seg.title || seg.author) && (
                          <div className="flex flex-wrap gap-2 mt-2 items-center justify-between">
                            
                            {seg.author ? (
                              <span
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-violet-50 border border-violet-200 text-violet-900 text-xs font-semibold"
                                title="Author"
                              >
                               <User/> <span> {seg.author}</span>
                              </span>
                            ):<div/>}
                            {seg.label && (
                              <span
                                className=" inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs"
                                title="Label"
                              >
                                {segmentLabelDisplay(seg.label)}
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

          </div>
        </TabsContent>
        <TabsContent value="metadata" className="flex flex-1 flex-col min-h-0 overflow-hidden">
          {metadataContent}
        </TabsContent>
      </Tabs>
    </div>
  );
});

AnnotationSidebar.displayName = 'AnnotationSidebar';
