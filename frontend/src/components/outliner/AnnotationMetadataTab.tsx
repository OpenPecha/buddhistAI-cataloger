import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { TitleField } from './sidebarFields/TitleField';
import { AuthorField } from './sidebarFields/AuthorField';
import { AISuggestionsBox } from './AISuggestionsBox';
import { RotateCcw, Save, X } from 'lucide-react';
import { useAnnotationMetadata } from './contexts/AnnotationMetadataContext';

export type { AISuggestionsControls } from './contexts/AnnotationMetadataContext';

/**
 * Metadata tab for the annotation sidebar. Reads segment, form, AI controls, and actions from
 * `AnnotationMetadataProvider` (no long prop lists).
 */
export function AnnotationMetadataTab() {
  const { t } = useTranslation();
  const {
    activeSegment,
    documentId,
    isMetadataTabSelected,
    aiSuggestionsControls,
    formData,
    activeSegmentId,
    onSave,
    onNotApplicable,
    onResetAnnotations,
  } = useAnnotationMetadata();

  const isTextSegment = activeSegment.label === 'TEXT';

  const wasMetadataTabSelectedRef = useRef(false);
  const prevDocumentIdRef = useRef(documentId);
  const onAIDetectRef = useRef(aiSuggestionsControls.onAIDetect);
  onAIDetectRef.current = aiSuggestionsControls.onAIDetect;
  const documentIdRef = useRef(documentId);
  documentIdRef.current = documentId;
  const snapshotRef = useRef({ activeSegment, formData });
  snapshotRef.current = { activeSegment, formData };

  useEffect(() => {
    if (documentId !== prevDocumentIdRef.current) {
      wasMetadataTabSelectedRef.current = false;
      prevDocumentIdRef.current = documentId;
    }
  }, [documentId]);

  // Auto title/author detection only when the user selects the Metadata tab (not while on Outlines),
  // and only if both fields are still empty. Deferred so bubble-menu fills and segment form reset run first.
  //
  // Only set `wasMetadataTabSelectedRef` after confirming `justEntered`; reset it in cleanup so React Strict
  // Mode's double effect run does not leave the ref true with a cleared timeout (which would skip AI entirely).
  useEffect(() => {
    if (!isMetadataTabSelected) {
      wasMetadataTabSelectedRef.current = false;
      return;
    }

    const justEnteredMetadataTab = !wasMetadataTabSelectedRef.current;
    if (!justEnteredMetadataTab) {
      return;
    }

    wasMetadataTabSelectedRef.current = true;

    const timeoutId = globalThis.setTimeout(() => {
      const { activeSegment: seg, formData: fd } = snapshotRef.current;
      if (!documentIdRef.current) return;
      if (seg.label !== 'TEXT' || seg.status === 'checked') return;
      if (!seg.text?.trim()) return;
      const titleEmpty = !seg.title?.trim() && !fd.title?.name?.trim();
      const authorEmpty = !seg.author?.trim() && !fd.author?.name?.trim();
      if (!titleEmpty || !authorEmpty) return;
      void onAIDetectRef.current();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeoutId);
      wasMetadataTabSelectedRef.current = false;
    };
  }, [isMetadataTabSelected, documentId]);

  return (
    <div className="px-2 py-3 flex flex-col flex-1 min-h-0 h-full">
      <div className="overflow-y-auto h-min space-y-6">
        <div className="relative">
          <div className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-md ">
            <div className="font-medium mb-1">{t('outliner.annotation.textPrefix')}</div>
            <div className="text-gray-800">{activeSegment.text.slice(0, 100)}...</div>
          </div>
          {activeSegment.status !== 'checked' && isTextSegment && (
            <AISuggestionsBox
              loading={aiSuggestionsControls.aiLoading}
              onDetect={() => void aiSuggestionsControls.onAIDetect()}
              onStop={aiSuggestionsControls.onAIStop}
            />
          )}
        </div>

        {isTextSegment ? (
          <div className="relative flex flex-col gap-4">
            <TitleField disabled={aiSuggestionsControls.aiLoading}/>
            <AuthorField disabled={aiSuggestionsControls.aiLoading}/>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 flex gap-2 bg-white pt-3 mt-2 border-t border-gray-100">
        {activeSegment.status !== 'checked' ? (
          <>
            {isTextSegment ? (
              <Button
                type="button"
                className="flex-1"
                onClick={() => void onSave()}
                variant="default"
                disabled={
                  !activeSegmentId ||
                  (formData.title.name.trim() === '' && formData.author.name.trim() === '')
                }
              >
                <Save />
                {t('outliner.annotation.save')}
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => void onNotApplicable()}
              variant="outline"
              className="flex-1"
              disabled={!activeSegmentId}
            >
              <X /> {t('outliner.annotation.notApplicable')}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={() => void onResetAnnotations()}
            variant="outline"
            disabled={!activeSegmentId}
            className="w-full"
          >
            <RotateCcw /> {t('outliner.annotation.reset')}
          </Button>
        )}
      </div>

      <hr className="shrink-0 mt-3 border-gray-200" />
    </div>
  );
}
