import React from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorSelection, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type { TextSelection, SelectionHandler, TextMapping, EditorType } from '../types';
import { useTextSelectionStore } from '../../../stores/textSelectionStore';
import { useEditorContext } from '../context';
import { cleanAnnotation } from '../../../api/text';
import { toast } from "sonner"

interface TextEditorProps {
  readonly ref: React.RefObject<ReactCodeMirrorRef | null> | null;
  readonly isEditable: boolean;
  readonly editorId: string;
  readonly editorType: EditorType;
  readonly onSelectionChange?: SelectionHandler;
  readonly mappings?: TextMapping[];
  readonly fontSize: number;
}

function TextEditor({
  ref,
  isEditable,
  editorId,
  editorType,
  onSelectionChange,
  mappings = [],
  fontSize
}: TextEditorProps) {
  // Editor context for scroll synchronization
  const { syncToClickedLine, syncLineSelection, syncTextSelection, isScrollSyncing, setOriginalSourceText, setOriginalTargetText, sourceEditorRef, targetEditorRef } = useEditorContext();
  
  // Combined ref callback to update both prop ref and context refs
  const combinedRef = React.useCallback((editorRef: ReactCodeMirrorRef | null) => {
    // Update the prop ref if provided
    if (ref) {
      (ref as React.MutableRefObject<ReactCodeMirrorRef | null>).current = editorRef;
    }
    // Update the context ref based on editor type
    const contextRef = editorType === 'source' ? sourceEditorRef : targetEditorRef;
    if (contextRef) {
      contextRef.current = editorRef;
    }
  }, [ref, editorType, sourceEditorRef, targetEditorRef]);
  
  // Zustand store
  const {
    sourceText, 
    isSourceLoaded,
    targetText, 
    isTargetLoaded,
    targetTextId,
    targetLoadType,
    setTargetTextFromFile,
    isLoadingAnnotations,
    annotationsApplied
  } = useTextSelectionStore();
  const currentText = editorType === 'source' ? sourceText : targetText;
  const isTextLoaded = editorType === 'source' ? isSourceLoaded : isTargetLoaded;
  
  // Track if this target editor was initially empty (to maintain editability)
  const [wasInitiallyEmptyTarget] = React.useState(() => 
    editorType === 'target' && targetTextId === 'empty-target'
  );
  
  // Determine if editor should be fully editable (allow text input, backspace, delete)
  // For target editor: when it was initially empty OR when it's loaded from file (user input)
  // For source editor: never fully editable (keep current behavior)
  const isFullyEditable = editorType === 'target' && 
    (wasInitiallyEmptyTarget || targetLoadType === 'file');
  
  // Determine if we should show placeholder text instead of actual content
  const shouldShowPlaceholder = isLoadingAnnotations || (isTextLoaded && !annotationsApplied);
  
 
  
  const [value, setValue] = React.useState(currentText ?? "");
  const originalTextRef = React.useRef<string>("");

  // Update value when store text changes or loading state changes
  React.useEffect(() => {
    let newDisplayText = currentText;
    if (shouldShowPlaceholder) {
      if (isLoadingAnnotations) {
        newDisplayText = 'Loading annotations...\n\nPlease wait while we process the text segmentation.';
      } else {
        newDisplayText = 'Preparing text...\n\nAnnotations are being applied to ensure proper alignment.';
      }
    }
    
    setValue(newDisplayText);
    
    // Store original text when it's first loaded (not placeholder)
    if (!shouldShowPlaceholder && newDisplayText && newDisplayText !== originalTextRef.current) {
      originalTextRef.current = newDisplayText;
      // Update the context with original text
      if (editorType === 'source') {
        setOriginalSourceText(newDisplayText);
      } else {
        setOriginalTargetText(newDisplayText);
      }
    }
    
    // Clear current selection when text changes
    if (onSelectionChange) {
      onSelectionChange.onSelectionClear(editorId);
    }
  }, [currentText, editorId, onSelectionChange, shouldShowPlaceholder, isLoadingAnnotations, editorType, setOriginalSourceText, setOriginalTargetText]);
  
  // Sync refs when editor mounts or when content loads
  React.useEffect(() => {
    if (ref?.current) {
      const contextRef = editorType === 'source' ? sourceEditorRef : targetEditorRef;
      if (contextRef) {
        contextRef.current = ref.current;
      }
    }
  }, [ref, editorType, sourceEditorRef, targetEditorRef, isSourceLoaded, isTargetLoaded, value]);
  
  const onChange = React.useCallback((val: string) => {
    
    // Don't allow editing when showing placeholder text
    if (shouldShowPlaceholder) {
      return;
    }
    
    // If fully editable (empty target), allow all changes
    if (isFullyEditable) {
      setValue(val);
      if (editorType === 'target' && (wasInitiallyEmptyTarget || targetLoadType === 'file')) {
        setTargetTextFromFile(val);
      }
      return;
    }
    
    // For non-fully-editable editors, validate that only newlines were added/removed
    const originalText = originalTextRef.current;
    
    // Remove all newlines and compare content
    const originalContent = originalText.replaceAll('\n', '');
    const newContent = val.replaceAll('\n', '');
    
    // If content (without newlines) changed, reject the change
    if (originalContent !== newContent) {
      // Revert to previous value
      return;
    }
    
    // Only newlines were added/removed - allow the change
    setValue(val);
  }, [shouldShowPlaceholder, isFullyEditable, editorType, wasInitiallyEmptyTarget, targetLoadType, setTargetTextFromFile]);

  // Handle text selection
  const handleSelectionChange = React.useCallback((selection: EditorSelection) => {
    // Don't allow selection when showing placeholder text
    if (shouldShowPlaceholder) {
      return;
    }
    
    if (onSelectionChange) {
      const range = selection.main;
      if (range.from === range.to) {
        onSelectionChange.onSelectionClear(editorId);
      } else {
        // For target editor, only allow selection if there's a source selection
        if (editorType === 'target' && !isSourceLoaded) {
          // Clear the selection and show a message
          return;
        }
        
        const selectedText = value.slice(range.from, range.to);
        const textSelection: TextSelection = {
          text: selectedText,
          start: range.from,
          end: range.to,
          editorId
        };
        
        onSelectionChange.onTextSelect(textSelection);
        
        // Sync scroll position in the other editor based on text selection
        if (!isScrollSyncing.current) {
          syncTextSelection(editorType, range.from, range.to);
        }
      }
    }
  }, [value, editorId, onSelectionChange, editorType, isSourceLoaded, shouldShowPlaceholder, syncTextSelection, isScrollSyncing]);

  // Handle cursor position changes for line synchronization
  const handleCursorChange = React.useCallback((view: EditorView) => {
    if (shouldShowPlaceholder || isScrollSyncing.current) {
      return;
    }
    try {
      const selection = view.state.selection.main;
      // Only sync if it's a cursor position (not a text selection)
      if (selection.from === selection.to) {
        const doc = view.state.doc;
        const line = doc.lineAt(selection.from);
        const lineNumber = line.number;
        
        // Trigger line selection synchronization
        syncLineSelection(editorType, lineNumber);
      }
    } catch (error) {
      console.error('Error handling cursor change:', error);
    }
  }, [editorType, syncLineSelection, shouldShowPlaceholder, isScrollSyncing]);

  // Handle key restrictions based on editor type and state
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    // If fully editable (empty target), allow all keys
    if (isFullyEditable) {
      return; // Allow all keyboard input
    }
    
    // Always allow Enter key when isEditable is true (for segmentation)
    if (isEditable && event.key === 'Enter') {
      return; // Allow Enter key - don't block it
    }
    
    // For non-fully-editable editors, block destructive keys
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // Block Ctrl/Cmd + X (cut) and Ctrl/Cmd + D (delete line)
    if ((event.ctrlKey || event.metaKey) && (event.key === 'x' || event.key === 'X' || event.key === 'd' || event.key === 'D')) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // When isEditable is true (selection/segmentation mode), only allow Enter and navigation keys
    if (isEditable) {
      // Allow navigation and modifier keys
      const allowedKeys = [
        'Enter', // Explicitly allow Enter
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'Home', 'End', 'PageUp', 'PageDown',
        'Tab', 'Escape',
        'Control', 'Meta', 'Alt', 'Shift'
      ];
      
      // Block text input keys but allow navigation and Enter
      if (!allowedKeys.includes(event.key)) {
        // Check if it's a single character (text input)
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    }
  }, [isEditable, isFullyEditable]);



  // Handle click synchronization
  const handleClick = React.useCallback((view: EditorView, event: MouseEvent) => {
    
    try {
      // Get the position where the user clicked
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos !== null) {
        // Trigger synchronization to the clicked line
        syncToClickedLine(pos, editorType);
      }
    } catch (error) {
      console.error('Error handling click:', error);
    }
  }, [editorType, syncToClickedLine]);

  const showSourceSelectionRequired = false;

  // State for sample text modal
  const [showSampleTextModal, setShowSampleTextModal] = React.useState(false);
  const [sampleText, setSampleText] = React.useState('');
  const [isLoadingCleanAnnotation, setIsLoadingCleanAnnotation] = React.useState(false);
  const [cleanAnnotationResult, setCleanAnnotationResult] = React.useState<unknown>(null);
  const [cleanAnnotationError, setCleanAnnotationError] = React.useState<string | null>(null);

  // Create extension to handle backspace for line merging or block deletion keys
  const blockDeletionExtension = React.useMemo(() => {
    // Command to merge current line with previous line when backspace is pressed at line start
    const mergeLineCommand = (view: EditorView): boolean => {
      const state = view.state;
      const selection = state.selection.main;
      const doc = state.doc;
      
      // Get the current line
      const currentLine = doc.lineAt(selection.from);
      
      // Check if cursor is at the start of the line (not the first line)
      if (selection.from === currentLine.from && currentLine.number > 1) {
        // Get the previous line
        const previousLine = doc.line(currentLine.number - 1);
        
        // Merge: previous line + current line (without the newline between them)
        const previousLineText = previousLine.text;
        const currentLineText = currentLine.text;
        // Determine if we need to add a space between the lines
        const needsSpace = previousLineText.trim() && currentLineText.trim();
        const spaceText = needsSpace ? '' : '';
        
        // Create the merged text - add a space if both lines have content
        const mergedText = previousLineText + spaceText + currentLineText;
        
        // Calculate the new cursor position (at the junction where lines were merged)
        // This is where the previous line ends, which is where the user's cursor was
        const newCursorPos = previousLine.from + previousLineText.length + spaceText.length;
        
        // Replace the two lines with the merged line
        const changes = {
          from: previousLine.from,
          to: currentLine.to,
          insert: mergedText
        };
        
        // Calculate the new text by applying the changes
        const currentText = doc.toString();
        const newText = currentText.slice(0, previousLine.from) + mergedText + currentText.slice(currentLine.to);
        
        // Apply the changes
        view.dispatch({
          changes,
          selection: EditorSelection.cursor(newCursorPos)
        });
        
        // Update the local value and store
        setValue(newText);
        
        // If this is a target editor that should be editable, update the store
        if (editorType === 'target' && (wasInitiallyEmptyTarget || targetLoadType === 'file')) {
          setTargetTextFromFile(newText);
        }
        
        return true; // Command handled
      }
      
      return false; // Let default behavior handle it
    };

    // If fully editable, allow line merging but use default behavior for other deletions
    if (isFullyEditable) {
      return Prec.highest(keymap.of([
        {
          key: 'Backspace',
          run: mergeLineCommand,
        },
      ]));
    }
    
    // For non-fully-editable editors, allow line merging but block other deletions
    return Prec.highest(keymap.of([
      {
        key: 'Backspace',
        run: (view) => {
          // Try to merge line first
          const merged = mergeLineCommand(view);
          if (merged) {
            return true; // Line was merged
          }
          // If not at line start, prevent default behavior
          return true;
        },
      },
      {
        key: 'Delete',
        run: () => true,
      },
      {
        key: 'Mod-x', // Ctrl+X or Cmd+X
        run: () => true,
      },
      {
        key: 'Mod-d', // Ctrl+D or Cmd+D
        run: () => true,
      },
    ]));
  }, [isFullyEditable, editorType, wasInitiallyEmptyTarget, targetLoadType, setTargetTextFromFile]);

  // Create scroll synchronization extension


  // Create click synchronization extension
  const clickSyncExtension = React.useMemo(() => {
    return EditorView.domEventHandlers({
      click: (event, view) => {
        handleClick(view, event);
        return false; // Don't prevent default click behavior
      }
    });
  }, [handleClick]);

  // Create line number click synchronization extension
  const lineNumberClickExtension = React.useMemo(() => {
    return EditorView.domEventHandlers({
      click: (event) => {
        // Check if the click was on a line number
        const target = event.target as HTMLElement;
        if (target?.classList.contains('cm-lineNumbers')) {
          // Get the line number from the clicked element
          const lineNumberText = target.textContent;
          if (lineNumberText) {
            const lineNumber = Number.parseInt(lineNumberText.trim(), 10);
            if (!Number.isNaN(lineNumber) && lineNumber > 0) {
              // Trigger line selection synchronization
              syncLineSelection(editorType, lineNumber);
            }
          }
        }
        return false; // Don't prevent default click behavior
      }
    });
  }, [editorType, syncLineSelection]);

  

  // Create extension to prevent text input except newlines
  const preventTextInputExtension = React.useMemo(() => {
    if (isFullyEditable) {
      return []; // Allow all input for fully editable editors
    }

    // Use transaction filter to prevent invalid changes
    return EditorView.updateListener.of((update) => {
      // Check if this is a user input event
      if (!update.transactions.some(tr => tr.isUserEvent('input'))) {
        return;
      }

      const originalText = originalTextRef.current;
      if (!originalText) return;

      // Get the new document content
      const newText = update.state.doc.toString();
      
      // Remove all newlines and compare content
      const originalContent = originalText.replaceAll('\n', '');
      const newContent = newText.replaceAll('\n', '');
      
      // If content (without newlines) changed, revert the change
      if (originalContent !== newContent) {
        // Use setTimeout to avoid dispatch during update
        toast.error("you cannot apply segment before a space text will get reset to original text")
        setTimeout(() => {
          update.view.dispatch({
            changes: {
              from: 0,
              to: update.view.state.doc.length,
              insert: originalText
            }
          });
        }, 0);
      }
    });
  }, [isFullyEditable]);

  function handleLoadSampleText() {
    setShowSampleTextModal(true);
    setSampleText('');
    setCleanAnnotationResult(null);
    setCleanAnnotationError(null);
  }

  async function handleSubmitSampleText() {
    if (!sampleText) {
      setCleanAnnotationError('Please enter sample text');
      return;
    }

    const content = value.replaceAll('\n', '');
    if (!content) {
      setCleanAnnotationError('No content available to clean');
      return;
    }

    setIsLoadingCleanAnnotation(true);
    setCleanAnnotationError(null);
    setCleanAnnotationResult(null);

    try {
      const response = await cleanAnnotation({
        text: content,
        sample_text: sampleText
      });
      setCleanAnnotationResult(response);
      
      // Extract cleaned text from response (check common field names)
      const extractCleanedText = (resp: unknown): string | null => {
        if (typeof resp === 'string') {
          return resp;
        }
        if (resp && typeof resp === 'object') {
          const obj = resp as Record<string, unknown>;
          return (obj.content as string) || (obj.text as string) || (obj.cleaned_text as string) || (obj.result as string) || null;
        }
        return null;
      };
      
      const cleanedText = extractCleanedText(response);
      
      if (cleanedText) {
        // Update the editor value with cleaned text
        setValue(cleanedText);
        originalTextRef.current = cleanedText;
        
        // Update context with new original text
        if (editorType === 'source') {
          setOriginalSourceText(cleanedText);
        } else {
          setOriginalTargetText(cleanedText);
        }
        
        // Update store if it's a target editor
        if (editorType === 'target' && (wasInitiallyEmptyTarget || targetLoadType === 'file')) {
          setTargetTextFromFile(cleanedText);
        }
      } else {
        setCleanAnnotationError('Response does not contain cleaned text content');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clean annotation';
      setCleanAnnotationError(errorMessage);
      console.error('Error cleaning annotation:', error);
    } finally {
      setIsLoadingCleanAnnotation(false);
    }
  }

  function handleCloseModal() {
    setShowSampleTextModal(false);
    setSampleText('');
    setCleanAnnotationResult(null);
    setCleanAnnotationError(null);
  }

  return (
    <div className="box-border relative w-full h-full group" 
    style={{ fontSize: `${fontSize}px` } as React.CSSProperties}
    >
        <button
      className='absolute top-2 right-2 z-10 font-poppins cursor-pointer  px-3 py-1 bg-blue-300 transition-all text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'
      onClick={() => handleLoadSampleText()}>Transfer segmentation</button>
        <CodeMirror 
          value={value}  
          height="100%"
          width="100%"
          className="font-['monlam'] h-[78vh]  "
          ref={combinedRef}
          onChange={onChange}  
          editable={isFullyEditable || isEditable}
          onKeyDown={handleKeyDown}
          onUpdate={(viewUpdate) => {
            if (viewUpdate.selectionSet) {
              handleSelectionChange(viewUpdate.state.selection);
            }
          }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightSelectionMatches: false,
          }}
          extensions={[
            // Enable line wrapping for text that exceeds container width
            EditorView.lineWrapping,
            // Block deletion keys at editor level
            blockDeletionExtension,
            // Prevent text input except newlines
            preventTextInputExtension,
            // Click synchronization
            clickSyncExtension,
            lineNumberClickExtension,
          ]}
        />
        
        {/* Overlay message for target editor when no source selection */}
        {showSourceSelectionRequired && (
          <div className="absolute inset-0 bg-gray-100 bg-opacity-75 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-orange-200 text-center max-w-sm">
              <div className="text-orange-600 text-2xl mb-2">⚠️</div>
              <div className="text-sm font-medium text-gray-800 mb-1">
                Source Selection Required
              </div>
              <div className="text-xs text-gray-600">
                Please select both text and instance in the source editor first before selecting target text for alignment.
              </div>
            </div>
          </div>
        )}

        {/* Sample Text Modal */}
        {showSampleTextModal && (
          <div onClick={handleCloseModal} className="absolute inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50">
            <div className=" bg-white rounded-lg z-50 shadow-xl border border-gray-200 w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            >
             

              {/* Modal Body */}
              <div className="px-6 py-4 flex-1 overflow-auto">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="sample-text" className="block text-sm font-medium text-gray-700 mb-2">
                      Sample Text *
                    </label>
                    <textarea
                      id="sample-text"
                      value={sampleText}
                      onChange={(e) => setSampleText(e.target.value)}
                      disabled={isLoadingCleanAnnotation}
                      placeholder="Enter or paste the sample text here..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-['monlam']"
                      rows={10}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Enter the sample text that will be used to clean the annotations.
                    </p>
                  </div>

                  {/* Error Message */}
                  {cleanAnnotationError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">{cleanAnnotationError}</p>
                    </div>
                  )}

                 
                </div>
              </div>

              {/* Modal Footer */}
               <div className='flex justify-end'>

                {cleanAnnotationResult === null && (
                  <button
                    onClick={handleSubmitSampleText}
                    disabled={isLoadingCleanAnnotation || !sampleText.trim()}
                    className="text-sm px-2 pt-2  mx-2 my-2 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isLoadingCleanAnnotation && (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isLoadingCleanAnnotation ? 'Processing...' : 'Clean Annotation'}
                  </button>
                )}
                </div>
            </div>
          </div>
        )}
      </div>
      
  

   
  );
}

export default TextEditor;
