import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SelectionMenu from './SelectionMenu';
import FormattedTextDisplay from '../FormattedTextDisplay';
import { BibliographyAnnotationsList } from '../BibliographyAnnotationsList';
import { annotationsField, annotationPlugin, annotationTheme, addAnnotationEffect, pasteTransformExtension } from '@/editor/textAnnotations';
import { useTranslation } from 'react-i18next';
import { useBibliography } from '@/context/BibliographyContext';
import { useTokenizer } from '@/hooks/useTokenizer';
import { TypeAnimation } from 'react-type-animation';
interface TextEditorViewProps {
  content: string;
  filename?: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  onTextSelect?: (text: string, type: 'title' | 'alt_title' | 'colophon' | 'incipit' | 'alt_incipit' | 'person') => void;
  isCreatingNewText?: boolean;
  hasIncipit?: boolean;
  hasTitle?: boolean;
  allowedTypes?: ("title" | "alt_title" | "colophon" | "incipit" | "alt_incipit" | "person")[];
  validationError?: string | null;
  segmentValidation?: {
    invalidSegments: Array<{ index: number; length: number }>;
    invalidCount: number;
  };
}

// Effect for highlighting a line (defined outside component to avoid recreation)
const highlightLineEffect = StateEffect.define<number | null>();

// Field for line highlighting (defined outside component)
const highlightLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    value = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(highlightLineEffect)) {
        const lineNumber = effect.value;
        if (lineNumber === null) {
          value = Decoration.none;
        } else {
          const line = tr.state.doc.line(lineNumber);
          const lineDeco = Decoration.line({
            class: 'cm-highlight-line',
          });
          value = Decoration.set([lineDeco.range(line.from)]);
        }
      }
    }
    return value;
  },
  provide: f => EditorView.decorations.from(f),
});

// Add CSS for highlight (defined outside component)
const highlightTheme = EditorView.theme({
  '.cm-highlight-line': {
    backgroundColor: '#fef3c7',
    transition: 'background-color 0.3s ease',
  },
});

const TextEditorView = ({ content, onChange, editable = false, onTextSelect, isCreatingNewText = true, hasIncipit = false, hasTitle = false, allowedTypes, validationError, segmentValidation }: TextEditorViewProps) => {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [textStart, setTextStart] = useState(0);
  const [textEnd, setTextEnd] = useState(0);
  const [activeTab, setActiveTab] = useState<'content' | 'preview' | 'bibliography'>('content');
  const [currentErrorIndex, setCurrentErrorIndex] = useState<number>(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const { clearAnnotations, addAnnotation } = useBibliography();
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const tokenizeMutation = useTokenizer()
  
  // Track editorView when CodeMirror initializes
  useEffect(() => {
    const checkView = () => {
      if (cmRef.current?.view) {
        setEditorView(cmRef.current.view);
        return true; // Found, stop checking
      }
      return false;
    };
    
    // Check immediately
    if (checkView()) {
      return; // Already found, no need for interval
    }
    
    // Also check periodically in case CodeMirror initializes later
    const interval = setInterval(() => {
      if (checkView()) {
        clearInterval(interval); // Stop once found
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, []);

  // Track previous annotations to detect changes
  const prevAnnotationsRef = useRef<string>('');

  // Sync annotations from CodeMirror state to BibliographyContext for API access
  useEffect(() => {
    const view = editorView || cmRef.current?.view;
    if (!view) return;

    let timeoutId: number | null = null;

    const syncAnnotations = () => {
      try {
        const cmAnnotations = view.state.field(annotationsField);
        
        // Create a serialized version to compare
        const annotationsKey = JSON.stringify(
          cmAnnotations.map(ann => ({
            start: ann.span.start,
            end: ann.span.end,
            type: ann.type,
            text: ann.text,
          }))
        );
        
        // Only sync if annotations actually changed
        if (annotationsKey === prevAnnotationsRef.current) {
          return; // No changes, skip sync
        }
        
        prevAnnotationsRef.current = annotationsKey;
        
        // Clear context and re-add all annotations from CodeMirror
        // This ensures context stays in sync with CodeMirror state
        clearAnnotations();
        for (const ann of cmAnnotations) {
          // Add annotation to context (it will generate a new ID, but that's okay for API purposes)
          addAnnotation({
            span: ann.span,
            type: ann.type,
            text: ann.text,
          });
        }
      } catch (e) {
        console.warn('Failed to sync annotations from CodeMirror to context:', e);
      }
    };

    // Debounced sync - only sync when changes occur, with debounce to batch rapid changes
    const debouncedSync = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = globalThis.setTimeout(syncAnnotations, 500);
    };

    // Use CodeMirror's update listener - poll less frequently when editor is active
    const interval = setInterval(() => {
      debouncedSync();
    }, 1000); // Check every second instead of every 500ms

    // Sync immediately
    syncAnnotations();

    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorView]);

  // Get annotations count from CodeMirror state for display (memoized)
  const annotationsCount = useMemo(() => {
    const view = editorView || cmRef.current?.view;
    if (!view) return 0;
    try {
      return view.state.field(annotationsField).length;
    } catch {
      return 0;
    }
  }, [editorView]); // Recalculate when editorView changes
  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    // Only show selection menu when in the content (CodeMirror) tab
    if (activeTab !== 'content') {
      return;
    }

    // Get selection from CodeMirror view instead of DOM
    const view = cmRef.current?.view;
    if (!view) {
      return;
    }

    const selection = view.state.selection.main;
    const selectedText = view.state.sliceDoc(selection.from, selection.to).trim();
    
    if (selectedText && selectedText.length > 0) {
      // Use CodeMirror's selection range directly
      setTextStart(selection.from);
      setTextEnd(selection.to);
      
      // Calculate position relative to the editor container
      if (editorRef.current) {
        const rect = editorRef.current.getBoundingClientRect();
        const menuWidth = 180; // Increased for better layout
        const menuHeight = 160; // Increased for descriptions
        
        // Calculate initial position
        let x = event.clientX - rect.left + 10;
        let y = event.clientY - rect.top + 20;
        
        // Adjust horizontal position if menu would overflow
        if (x + menuWidth > rect.width) {
          // Show on left side of cursor
          x = event.clientX - rect.left - menuWidth - 10;
        }
        
        // Ensure menu doesn't go off left edge
        if (x < 0) {
          x = 10;
        }
        
        // Adjust vertical position if menu would overflow
        if (y + menuHeight > rect.height) {
          y = event.clientY - rect.top - menuHeight - 10;
        }
        
        // Ensure menu doesn't go off top edge
        if (y < 0) {
          y = 10;
        }
        
        setSelectedText(selectedText);
        setMenuPosition({ x, y });
        setShowMenu(true);
      }
    }
  }, [activeTab]);

  const handleMenuSelect = useCallback((type: 'title' | 'alt_title' | 'colophon' | 'incipit' | 'alt_incipit' | 'person') => {
    const view = cmRef.current?.view;
    if (!view) {
      setShowMenu(false);
      return;
    }

    // Add annotation directly to CodeMirror state using the stored range
    if (selectedText && textStart !== undefined && textEnd !== undefined) {
      view.dispatch({
        effects: addAnnotationEffect.of({
          span: {
            start: textStart,
            end: textEnd,
          },
          type: type,
          text: selectedText,
        })
      });
    }

    // Call optional callback for form updates
    if (selectedText && onTextSelect) {
      onTextSelect(selectedText, type);
    }
    
    setShowMenu(false);
    setSelectedText('');
  }, [selectedText, textStart, textEnd, onTextSelect]);
  
  const handleCloseMenu = useCallback(() => {
    setShowMenu(false);
  }, []);


  // Get sorted array of invalid segment indices for navigation
  const invalidIndices = useMemo(() => {
    if (!segmentValidation?.invalidSegments) return [];
    return segmentValidation.invalidSegments.map(seg => seg.index).sort((a, b) => a - b);
  }, [segmentValidation]);

  // Reset current error index when invalid segments change
  useEffect(() => {
    if (invalidIndices.length > 0 && currentErrorIndex >= invalidIndices.length) {
      setCurrentErrorIndex(0);
    }
  }, [invalidIndices.length, currentErrorIndex]);

  // Map segment index to line number in content (accounting for empty lines)
  const getLineNumberFromSegmentIndex = useCallback((segmentIndex: number): number => {
    if (!content) return 0;
    
    // Process content the same way as calculateAnnotations
    const lines = content.split('\n');
    
    // Remove trailing empty lines
    const linesWithoutTrailingEmpty = [...lines];
    while (linesWithoutTrailingEmpty.length > 0 && linesWithoutTrailingEmpty[linesWithoutTrailingEmpty.length - 1].length === 0) {
      linesWithoutTrailingEmpty.pop();
    }
    
    // Find which original line corresponds to the segment index
    let nonEmptyLineCount = 0;
    for (let i = 0; i < linesWithoutTrailingEmpty.length; i++) {
      if (linesWithoutTrailingEmpty[i].length > 0) {
        if (nonEmptyLineCount === segmentIndex) {
          return i + 1; // Return 1-based line number for CodeMirror
        }
        nonEmptyLineCount++;
      }
    }
    
    return 1; // Fallback to first line
  }, [content]);

  // Scroll to error segment in content editor
  const scrollToErrorSegmentInContent = useCallback((index: number) => {
    if (invalidIndices.length === 0) return;
    
    const segmentIndex = invalidIndices[index];
    const view = cmRef.current?.view;
    if (!view || !content) return;
    
    // Get line number from segment index
    const lineNumber = getLineNumberFromSegmentIndex(segmentIndex);
    
    // Get the line from the document
    const line = view.state.doc.line(lineNumber);
    if (!line) return;
    
    // Scroll to center the line
    const lineCenter = (line.from + line.to) / 2;
    view.dispatch({
      effects: EditorView.scrollIntoView(lineCenter, {
        y: 'center',
      }),
    });
    
    // Highlight the line temporarily
    view.dispatch({
      effects: highlightLineEffect.of(lineNumber),
    });
    
    // Clear highlight after 3 seconds
    setTimeout(() => {
      const currentView = cmRef.current?.view;
      if (currentView) {
        currentView.dispatch({
          effects: highlightLineEffect.of(null),
        });
      }
    }, 3000);
  }, [invalidIndices, content, getLineNumberFromSegmentIndex]);


  // Navigate to next error - scrolls directly in content tab
  const handleNextError = useCallback(() => {
    if (invalidIndices.length === 0) return;
    
    const nextIndex = (currentErrorIndex + 1) % invalidIndices.length;
    setCurrentErrorIndex(nextIndex);
    
    // Switch to content tab and scroll to the error
    if (activeTab !== 'content') {
      setActiveTab('content');
      // Wait for tab switch before scrolling
      setTimeout(() => {
        scrollToErrorSegmentInContent(nextIndex);
      }, 150);
    } else {
      scrollToErrorSegmentInContent(nextIndex);
    }
  }, [invalidIndices, currentErrorIndex, activeTab, scrollToErrorSegmentInContent]);

  // Navigate to previous error - scrolls directly in content tab
  const handlePreviousError = useCallback(() => {
    if (invalidIndices.length === 0) return;
    
    const prevIndex = (currentErrorIndex - 1 + invalidIndices.length) % invalidIndices.length;
    setCurrentErrorIndex(prevIndex);
    
    // Switch to content tab and scroll to the error
    if (activeTab !== 'content') {
      setActiveTab('content');
      // Wait for tab switch before scrolling
      setTimeout(() => {
        scrollToErrorSegmentInContent(prevIndex);
      }, 150);
    } else {
      scrollToErrorSegmentInContent(prevIndex);
    }
  }, [invalidIndices, currentErrorIndex, activeTab, scrollToErrorSegmentInContent]);

  // Handle clicking on invalid segment in preview - switches to content tab
  const handleInvalidSegmentClick = useCallback((segmentIndex: number) => {
    // Find the index in invalidIndices array
    const errorIndex = invalidIndices.indexOf(segmentIndex);
    if (errorIndex !== -1) {
      setCurrentErrorIndex(errorIndex);
      // Switch to content tab and scroll to the error
      setActiveTab('content');
      setTimeout(() => {
        scrollToErrorSegmentInContent(errorIndex);
      }, 150);
    }
  }, [invalidIndices, scrollToErrorSegmentInContent]);

  const handleTokenize = useCallback(() => {
    const view = cmRef.current?.view;
    if (!view) return;
    const text = view.state.doc.sliceString(0, view.state.doc.length);
    tokenizeMutation.mutate(
      { text: text, type: 'sentence' },
      {
        onSuccess: (tokenizedText) => {
          onChange?.(tokenizedText.join('\n'));
        },
        onError: (error) => {
          console.error('Tokenization error:', error);
        }
      }
    );
  }, [tokenizeMutation, onChange]);



  return (
    <div className="h-full flex flex-col">
      {/* Selection Menu */}
      {showMenu && (
        <SelectionMenu
          position={menuPosition}
          selectedText={selectedText}
          textStart={textStart}
          textEnd={textEnd}
          onSelect={handleMenuSelect}
          onClose={handleCloseMenu}
          isCreatingNewText={isCreatingNewText}
          hasIncipit={hasIncipit}
          hasTitle={hasTitle}
          allowedTypes={allowedTypes}
        />
      )}
      
      {/* Header */}
      <div className="bg-gray-100 border-b border-gray-300">
       

        {/* Tabs */}
        <div className="flex items-center px-4 flex-wrap gap-2 ">
          <div className="flex items-center">
            <button
              onClick={() => setActiveTab('content')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'content'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('editor.content')}
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === 'preview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('editor.preview')}
              {segmentValidation && segmentValidation.invalidCount > 0 && (
                <span className="absolute top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {segmentValidation.invalidCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('bibliography')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === 'bibliography'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('editor.bibliography')}
              {annotationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {annotationsCount}
                </span>
              )}
            </button>
          </div>
          
          {/* Previous/Next Navigation for Invalid Segments */}
          {segmentValidation && segmentValidation.invalidCount > 0 && invalidIndices.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousError}
                className="h-7 px-3 text-xs"
              >
                {t('common.previous')}
              </Button>
              <span className="text-xs text-gray-700 font-medium">
                {currentErrorIndex + 1} / {invalidIndices.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextError}
                className="h-7 px-3 text-xs"
              >
                {t('common.next')}
              </Button>
              <Button variant="default" size="sm" onClick={handleTokenize} 
              disabled={tokenizeMutation.isPending}
              className="h-7 px-3 text-xs">
                {tokenizeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'fix it'}
              </Button>
            </div>
          )}
          
          {/* Validation Error Message - Inline with tabs */}
          {validationError && (
            <div className="flex items-center gap-2 text-red-600 ml-auto py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-medium">{validationError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Content Area - Conditional Rendering */}
      <div className="flex-1 overflow-hidden" ref={editorRef} onMouseUp={handleMouseUp}>
        {/* Keep CodeMirror mounted but hidden when not on content tab to preserve state */}
        {tokenizeMutation.isPending && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <TypingLoading/>
        </div>}
        <div style={{ display: activeTab === 'content' ? 'block' : 'none', height: '100%' }}>
          <CodeMirror
            ref={cmRef}
            // onKeyDown={(e)=>{
            //   if(e.key !== 'Enter' ) {
            //     alert("you cannot change the content of the text");
            //     e.preventDefault();
            //   }
            // }}
            value={content}
            height="100%"
            extensions={useMemo(() => [
              markdown(),
              EditorView.lineWrapping,
              annotationsField,
              annotationPlugin,
              annotationTheme,
              highlightLineField,
              highlightTheme,
              pasteTransformExtension
            ], [])}
            editable={editable && !tokenizeMutation.isPending}
            onChange={onChange}
            basicSetup={useMemo(() => ({
              lineNumbers: true,
              highlightActiveLineGutter: editable,
              highlightActiveLine: editable,
              foldGutter: true,
            }), [editable])}
            theme="light"

            className=" h-[80vh] text-base pt-2"
          />
        </div>
        
        {activeTab === 'preview' && (
          /* Preview - Formatted Text Display */
          <div ref={previewContainerRef} className="h-full overflow-y-auto">
            <FormattedTextDisplay 
              content={content} 
              invalidSegments={segmentValidation?.invalidSegments}
              invalidCount={segmentValidation?.invalidCount}
              onInvalidSegmentClick={handleInvalidSegmentClick}
            />
          </div>
        )}
        
        {activeTab === 'bibliography' && (
          /* Bibliography - Annotations List */
          <div className="h-full overflow-y-auto p-6 bg-gray-50  ">
            <BibliographyAnnotationsList 
              className="bg-white rounded-lg shadow-sm" 
              editorView={editorView || cmRef.current?.view || null}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(TextEditorView);


function TypingLoading() {
  return (
    <div className="flex items-center justify-center p-8 flex-col w-full gap-4 bg-black  shadow-sm">
        <img src="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzBiM3Z2YnB4bmYwZXB4ZHB0Mmo0ZnF2Ym1uZmd4OGlkZWU4dndtZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/wrmVCNbpOyqgJ9zQTn/giphy.gif" alt="cleaning" className="w-[20vh]" />
      <div className="flex items-center gap-3 text-white">
        
        <TypeAnimation
          sequence={[
            // Same substring at the start will only be typed out once, initially
            'AI is scanning the text',
            1000, // wait 1s before replacing "Mice" with "Hamsters"
            'AI is analyzing the text',
            3000,
            'AI is cleaning up the text',
            2000,
            'AI is fixing the text',
            8000
          ]}
          wrapper="span"
          speed={150}
          style={{ 
            fontSize: '1.5rem', 
            fontWeight: '600',
            color: 'white',
            fontFamily:"poppins"
          }}
          repeat={Infinity}
        />
      </div>
    </div>
  );
}