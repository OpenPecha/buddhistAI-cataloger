import React, { useRef, useCallback, useMemo } from 'react';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import type { SentenceMapping } from './types';
import { EditorContext, type EditorContextValue, type ExternalAlignmentData } from './context';

export function EditorProvider({ children }: { readonly children: React.ReactNode }) {
  const sourceEditorRef = useRef<ReactCodeMirrorRef | null>(null);
  const targetEditorRef = useRef<ReactCodeMirrorRef | null>(null);
  const isScrollSyncing = useRef<boolean>(false);
  const [isScrollSyncEnabled, setScrollSyncEnabled] = React.useState<boolean>(true);
  const [externalAlignmentData, setExternalAlignmentData] = React.useState<ExternalAlignmentData | null>(null);
  const originalSourceTextRef = useRef<string>('');
  const originalTargetTextRef = useRef<string>('');

  // Utility function to load alignment data from API response
  const loadAlignmentData = useCallback((alignmentResponse: ExternalAlignmentData) => {
    setExternalAlignmentData(alignmentResponse);
  }, []);

  const getSourceContent = useCallback(() => {
    return sourceEditorRef.current?.view?.state.doc.toString();
  }, []);

  const getTargetContent = useCallback(() => {
    return targetEditorRef.current?.view?.state.doc.toString();
  }, []);

  // Set original text for validation
  const setOriginalSourceText = useCallback((text: string) => {
    originalSourceTextRef.current = text;
  }, []);

  const setOriginalTargetText = useCallback((text: string) => {
    originalTargetTextRef.current = text;
  }, []);

  // Validate that content only has newlines added/removed (not modified)
  const isContentValid = useCallback((): boolean => {
    const currentSource = getSourceContent() || '';
    const currentTarget = getTargetContent() || '';
    const originalSource = originalSourceTextRef.current;
    const originalTarget = originalTargetTextRef.current;

    // Helper function to check if only newlines were changed
    const validateNewlinesOnly = (original: string, current: string): boolean => {
      if (original === current) return true; // No changes
      
      // Split by newlines to compare line content
      const originalLines = original.split('\n');
      const currentLines = current.split('\n');
      
      // Remove all newlines and compare the content
      const originalContent = original.replaceAll('\n', '');
      const currentContent = current.replaceAll('\n', '');
      
      // If content (without newlines) changed, it's invalid
      if (originalContent !== currentContent) {
        return false;
      }
      
      // Content is the same, so only newlines were added/removed - valid
      return true;
    };

    const sourceValid = validateNewlinesOnly(originalSource, currentSource);
    const targetValid = validateNewlinesOnly(originalTarget, currentTarget);

    return sourceValid && targetValid;
  }, [getSourceContent, getTargetContent]);

  // Split text into sentences based on newlines, preserving empty lines for alignment
  const splitIntoSentences = useCallback((text: string): string[] => {
    if (!text) return [];
    
    // Split by single newline characters, preserving empty lines
    // This ensures that empty lines in the target text are preserved for proper alignment
    return text.split(/\n/);
  }, []);

  // Generate sentence-to-sentence mappings between source and target
  const generateSentenceMappings = useCallback((): SentenceMapping[] => {
    const sourceContent = getSourceContent();
    const targetContent = getTargetContent();
    if (!sourceContent || !targetContent) {
      return [];
    }

    const sourceSentences = splitIntoSentences(sourceContent);
    const targetSentences = splitIntoSentences(targetContent);
    const mappings: SentenceMapping[] = [];
    
    
    
    let sourcePos = 0;
    let targetPos = 0;
    let sourceIndex = 0; // Index in sourceNonEmpty array
    let targetIndex = 0; // Index in targetNonEmpty array
    

    // Handle mapping with empty target segments
    const maxLength = Math.max(sourceSentences.length, targetSentences.length);
    
    for (let i = 0; i < maxLength; i++) {
      const sourceSentence = sourceSentences[i];
      const targetSentence = targetSentences[i];
      const uniqueId = crypto.randomUUID();
      
      // If we have a source sentence
      if (sourceSentence !== undefined) {
        if (sourceSentence.trim().length > 0) {
          // Non-empty source sentence - calculate position in clean content
          const sourceStart = sourcePos;
          const sourceEnd = sourceStart + sourceSentence.length;
          
          // If we have a corresponding non-empty target sentence
          if (targetSentence !== undefined && targetSentence.trim().length > 0) {
            const targetStart = targetPos;
            const targetEnd = targetStart + targetSentence.length;
            
            mappings.push({
              source: { start: sourceStart, end: sourceEnd, index: uniqueId },
              target: { start: targetStart, end: targetEnd, alignment_index: [uniqueId] }
            });
            
            targetPos = targetEnd; // Next element starts where this one ends (exclusive end)
            targetIndex++;
          } else {
            // Empty or no target sentence
            mappings.push({
              source: { start: sourceStart, end: sourceEnd, index: uniqueId },
              target: { start: -1, end: -1, alignment_index: [uniqueId] } // -1 indicates empty line
            });
          }
          
          sourcePos = sourceEnd; // Next element starts where this one ends (exclusive end)
          sourceIndex++;
        } else {
          // Empty source sentence - map to empty
          mappings.push({
            source: { start: -1, end: -1, index: uniqueId },
            target: targetSentence !== undefined && targetSentence.trim().length > 0 
              ? { start: targetPos, end: targetPos + targetSentence.length, alignment_index: [uniqueId] }
              : { start: -1, end: -1, alignment_index: [uniqueId] }
          });
          
          if (targetSentence !== undefined && targetSentence.trim().length > 0) {
            targetPos += targetSentence.length;
            targetIndex++;
          }
        }
      } else if (targetSentence !== undefined && targetSentence.trim().length > 0) {
        // We have a target sentence but no corresponding source
        const targetStart = targetPos;
        const targetEnd = targetStart + targetSentence.length;
        
        mappings.push({
          source: { start: -1, end: -1, index: uniqueId },
          target: { start: targetStart, end: targetEnd, alignment_index: [uniqueId] }
        });
        
        targetPos = targetEnd;
        targetIndex++;
      }
    }
    
    return mappings;
  }, [getSourceContent, getTargetContent, splitIntoSentences]);

  // Scroll synchronization function
  const syncScrollToLine = useCallback((fromEditor: 'source' | 'target', lineNumber: number) => {
    if (!isScrollSyncEnabled || isScrollSyncing.current) return; // Check if sync is enabled and prevent infinite loop
    
    isScrollSyncing.current = true;
    
    try {
      const targetEditor = fromEditor === 'source' ? targetEditorRef.current : sourceEditorRef.current;
      
      if (targetEditor?.view) {
        const doc = targetEditor.view.state.doc;
        const totalLines = doc.lines;
        
        // Ensure line number is within bounds
        const clampedLineNumber = Math.max(1, Math.min(lineNumber, totalLines));
        
        // Get the position of the line
        const linePos = doc.line(clampedLineNumber).from;
        
        // Use scrollPosIntoView for smooth scrolling to the line
        const scrollEffect = EditorView.scrollIntoView(linePos, {
          y: 'center', // Align to top of viewport
          yMargin: 0
        });
        
        targetEditor.view.dispatch({
          effects: [scrollEffect]
        });
      }
    } catch (error) {
      console.error('Error syncing scroll:', error);
    } finally {
      // Reset the flag after a short delay to allow the scroll to complete
      setTimeout(() => {
        isScrollSyncing.current = false;
      }, 50);
    }
  }, [isScrollSyncEnabled]);

  // Click-based synchronization function with alignment support
  const syncToClickedLine = useCallback((clickPosition: number, fromEditor: 'source' | 'target') => {
    if (!isScrollSyncEnabled) return; // Only sync if enabled
    
    try {
      const sourceEditor = sourceEditorRef.current;
      const targetEditor = targetEditorRef.current;
      const clickedEditor = fromEditor === 'source' ? sourceEditor : targetEditor;
      const otherEditor = fromEditor === 'source' ? targetEditor : sourceEditor;
      
      if (!clickedEditor?.view || !otherEditor?.view) return;
      
      // Calculate the top offset of the clicked line relative to the scroll container
      const clickedCoords = clickedEditor.view.coordsAtPos(clickPosition);
      if (!clickedCoords) return;
      
      const clickedScrollRect = clickedEditor.view.scrollDOM.getBoundingClientRect();
      const clickedTopOffset = clickedCoords.top - clickedScrollRect.top;
      
      // Try to use external alignment data first, then internal mappings, then fallback to line-based sync
      let targetPosition: number | null = null;
      // Priority 1: Use external alignment data if available
      if (externalAlignmentData?.data) {
        const { alignment_annotation, target_annotation } = externalAlignmentData.data;
        
        if (fromEditor === 'source') {
          // Find source annotation containing click position
          const sourceAnnotation = alignment_annotation.find(ann => 
            clickPosition >= ann.span.start && clickPosition <= ann.span.end
          );
          
          if (sourceAnnotation && sourceAnnotation.alignment_index.length > 0) {
            // Find corresponding target annotation
            const targetIndex = sourceAnnotation.alignment_index[0];
            const targetAnnotation = target_annotation.find(ann => ann.index === targetIndex);
            
            if (targetAnnotation) {
              targetPosition = targetAnnotation.span.start;
            }
          }
        } else {
          // Find target annotation containing click position
          const targetAnnotation = target_annotation.find(ann => 
            clickPosition >= ann.span.start && clickPosition <= ann.span.end
          );
          
          if (targetAnnotation) {
            // Find corresponding source annotation
            const sourceAnnotation = alignment_annotation.find(ann => 
              ann.alignment_index.includes(targetAnnotation.index)
            );
            
            if (sourceAnnotation) {
              targetPosition = sourceAnnotation.span.start;
            }
          }
        }
        
        if (targetPosition !== null) {
          // Temporarily disable scroll sync to prevent feedback loop
          isScrollSyncing.current = true;
          
          // Capture targetPosition in a const for the setTimeout callback
          const finalTargetPosition = targetPosition;
          
          // First, ensure the target line is visible to get accurate coordinates
          const scrollEffect = EditorView.scrollIntoView(finalTargetPosition, {
            y: 'start',
            yMargin: 0
          });
          otherEditor.view.dispatch({
            effects: [scrollEffect]
          });
          
          // Wait for scroll to complete, then adjust to match exact offset
          setTimeout(() => {
            if (!otherEditor?.view) {
              isScrollSyncing.current = false;
              return;
            }
            const targetCoords = otherEditor.view.coordsAtPos(finalTargetPosition);
            if (targetCoords) {
              const otherScrollRect = otherEditor.view.scrollDOM.getBoundingClientRect();
              const currentTargetOffset = targetCoords.top - otherScrollRect.top;
              const offsetDifference = currentTargetOffset - clickedTopOffset;
              const newScrollTop = otherEditor.view.scrollDOM.scrollTop + offsetDifference;
              otherEditor.view.scrollDOM.scrollTop = Math.max(0, newScrollTop);
            }
            
            // Reset the sync flag after adjustment
            setTimeout(() => {
              isScrollSyncing.current = false;
            }, 50);
          }, 50);
          
          return; // Successfully used external alignment data
        }
      }
      
      // Priority 2: Use internal alignment mappings
      const alignmentMappings = generateSentenceMappings();
      if (alignmentMappings.length > 0) {
        // Find the alignment segment that contains the click position
        
        for (const mapping of alignmentMappings) {
          const sourceSpan = mapping.source;
          const targetSpan = mapping.target;
          
          if (fromEditor === 'source') {
            // Check if click is within source span
            if (clickPosition >= sourceSpan.start && clickPosition <= sourceSpan.end) {
              // Found matching source segment, get corresponding target position
              if (targetSpan.start >= 0 && targetSpan.end >= 0) {
                targetPosition = targetSpan.start;
              }
              break;
            }
          } else {
            // Check if click is within target span
            if (clickPosition >= targetSpan.start && clickPosition <= targetSpan.end) {
              // Found matching target segment, get corresponding source position
              if (sourceSpan.start >= 0 && sourceSpan.end >= 0) {
                targetPosition = sourceSpan.start;
              }
              break;
            }
          }
        }
        if (targetPosition !== null) {
          // Temporarily disable scroll sync to prevent feedback loop
          isScrollSyncing.current = true;
          
          // Capture targetPosition in a const for the setTimeout callback
          const finalTargetPosition = targetPosition;
          // First, ensure the target line is visible to get accurate coordinates
          const scrollEffect = EditorView.scrollIntoView(finalTargetPosition, {
            y: 'start',
            yMargin: 0
          });
          otherEditor.view.dispatch({
            effects: [scrollEffect]
          });
          
          // Wait for scroll to complete, then adjust to match exact offset
          setTimeout(() => {
            if (!otherEditor?.view) {
              isScrollSyncing.current = false;
              return;
            }
            const targetCoords = otherEditor.view.coordsAtPos(finalTargetPosition);
            if (targetCoords) {
              const otherScrollRect = otherEditor.view.scrollDOM.getBoundingClientRect();
              const currentTargetOffset = targetCoords.top - otherScrollRect.top;
              const offsetDifference = currentTargetOffset - clickedTopOffset;
              const newScrollTop = otherEditor.view.scrollDOM.scrollTop + offsetDifference;
              otherEditor.view.scrollDOM.scrollTop = Math.max(0, newScrollTop);
            }

            const activeEditor = fromEditor === 'source' ? sourceEditorRef.current : targetEditorRef.current;
            const alternateEditor = fromEditor === 'source' ? targetEditorRef.current : sourceEditorRef.current;
            const activeEditorElement= activeEditor?.editor;
            const alternateEditorElement= alternateEditor?.editor;

            const activeLine = activeEditorElement?.getElementsByClassName('cm-activeLineGutter')[0];
            const activeLineRect = activeLine?.getBoundingClientRect();
            const activeLineTop = activeLineRect?.top || 0;
      
            const activeLineNumber= activeLine?.textContent;
            if(parseInt(activeLineNumber || '0') > 0) {
            //  get the element which has content equal to the activeLine number from alternateEditorElement
            //apply a custom background color to the element
            const elements = alternateEditorElement?.querySelectorAll('.cm-gutterElement');
            const targetElement = Array.from(elements || []).find(el => el.textContent?.trim() === activeLineNumber?.trim());
            if(targetElement) {
              // Apply animated background color change
              (targetElement as HTMLElement).style.transition = 'background-color 0.3s ease';
              (targetElement as HTMLElement).style.fontWeight = 'bold';
              (targetElement as HTMLElement).style.fontSize = '1.8rem';
              (targetElement as HTMLElement).style.color = 'gray';
              setTimeout(() => {
                // Scroll the alternate editor to align the target element with the active line position
                const alternateScrollContainer = alternateEditor?.view?.scrollDOM;
                if (alternateScrollContainer && targetElement) {
                  const targetElementRect = targetElement.getBoundingClientRect();
                  const currentTargetTop = targetElementRect.top;
                  const scrollOffset = currentTargetTop - activeLineTop;
                  const newScrollTop = alternateScrollContainer.scrollTop + scrollOffset;
                  alternateScrollContainer.scrollTop = Math.max(0, newScrollTop);
                }
                (targetElement as HTMLElement).style.transition = '';
              }, 0);
              // Remove the background color after animation
             
            }
            }
          
            // Reset the sync flag after adjustment
            setTimeout(() => {
              isScrollSyncing.current = false;
            }, 50);
          }, 50);
          
          return; // Successfully used alignment mapping
        }
      }
      
   
    } catch (error) {
      console.error('Error syncing to clicked line:', error);
    }
  }, [isScrollSyncEnabled, generateSentenceMappings, externalAlignmentData]);

  // Line selection synchronization function - scrolls without creating visible selection
  const syncLineSelection = useCallback((fromEditor: 'source' | 'target', lineNumber: number) => {
    if (!isScrollSyncEnabled || isScrollSyncing.current) return; // Check if sync is enabled and prevent infinite loop
    
    isScrollSyncing.current = true;
    
    try {
      const targetEditor = fromEditor === 'source' ? targetEditorRef.current : sourceEditorRef.current;
      
      if (targetEditor?.view) {
        const doc = targetEditor.view.state.doc;
        const totalLines = doc.lines;
        
        // Ensure line number is within bounds
        const clampedLineNumber = Math.max(1, Math.min(lineNumber, totalLines));
        
        // Get the position of the line
        const line = doc.line(clampedLineNumber);
        const lineStart = line.from;
        
        // Scroll to the line without creating a selection
        const scrollEffect = EditorView.scrollIntoView(lineStart, {
          y: 'center', // Center the line in viewport
          yMargin: 50
        });
        
        // Dispatch only the scroll effect, no selection
        targetEditor.view.dispatch({
          effects: [scrollEffect]
        });
      }
    } catch (error) {
      console.error('Error syncing line selection:', error);
    } finally {
      // Reset the flag immediately for smoother sync
      requestAnimationFrame(() => {
        isScrollSyncing.current = false;
      });
    }
  }, [isScrollSyncEnabled]);

  // Text selection synchronization function - syncs based on selected text range
  const syncTextSelection = useCallback((fromEditor: 'source' | 'target', selectionStart: number, selectionEnd: number) => {
    if (!isScrollSyncEnabled || isScrollSyncing.current) return;
    
    isScrollSyncing.current = true;
    
    try {
      const sourceEditor = sourceEditorRef.current;
      const targetEditor = targetEditorRef.current;
      const clickedEditor = fromEditor === 'source' ? sourceEditor : targetEditor;
      const otherEditor = fromEditor === 'source' ? targetEditor : sourceEditor;
      
      if (!clickedEditor?.view || !otherEditor?.view) return;
      
      // Try to use external alignment data first, then internal mappings
      let targetPosition: number | null = null;
      
      // Priority 1: Use external alignment data if available
      if (externalAlignmentData?.data) {
        const { alignment_annotation, target_annotation } = externalAlignmentData.data;
        
        if (fromEditor === 'source') {
          // Find source annotation containing selection
          const sourceAnnotation = alignment_annotation.find(ann => 
            selectionStart >= ann.span.start && selectionEnd <= ann.span.end
          );
          
          if (sourceAnnotation && sourceAnnotation.alignment_index.length > 0) {
            const targetIndex = sourceAnnotation.alignment_index[0];
            const targetAnnotation = target_annotation.find(ann => ann.index === targetIndex);
            
            if (targetAnnotation) {
              targetPosition = targetAnnotation.span.start;
            }
          }
        } else {
          // Find target annotation containing selection
          const targetAnnotation = target_annotation.find(ann => 
            selectionStart >= ann.span.start && selectionEnd <= ann.span.end
          );
          
          if (targetAnnotation) {
            const sourceAnnotation = alignment_annotation.find(ann => 
              ann.alignment_index.includes(targetAnnotation.index)
            );
            
            if (sourceAnnotation) {
              targetPosition = sourceAnnotation.span.start;
            }
          }
        }
        
        if (targetPosition !== null) {
          // Scroll to target position without creating selection
          const scrollEffect = EditorView.scrollIntoView(targetPosition, {
            y: 'center',
            yMargin: 50
          });
          
          otherEditor.view.dispatch({
            effects: [scrollEffect]
          });
          
          requestAnimationFrame(() => {
            isScrollSyncing.current = false;
          });
          return;
        }
      }
      
      // Priority 2: Use internal alignment mappings
      const alignmentMappings = generateSentenceMappings();
      
      if (alignmentMappings.length > 0) {
        for (const mapping of alignmentMappings) {
          const sourceSpan = mapping.source;
          const targetSpan = mapping.target;
          
          if (fromEditor === 'source') {
            if (selectionStart >= sourceSpan.start && selectionEnd <= sourceSpan.end) {
              if (targetSpan.start >= 0 && targetSpan.end >= 0) {
                targetPosition = targetSpan.start;
                break;
              }
            }
          } else {
            if (selectionStart >= targetSpan.start && selectionEnd <= targetSpan.end) {
              if (sourceSpan.start >= 0 && sourceSpan.end >= 0) {
                targetPosition = sourceSpan.start;
                break;
              }
            }
          }
        }
        
        if (targetPosition !== null) {
          const scrollEffect = EditorView.scrollIntoView(targetPosition, {
            y: 'center',
            yMargin: 50
          });
          
          otherEditor.view.dispatch({
            effects: [scrollEffect]
          });
          
          requestAnimationFrame(() => {
            isScrollSyncing.current = false;
          });
          return;
        }
      }
      
      // Fallback: sync based on line number
      const doc = clickedEditor.view.state.doc;
      const line = doc.lineAt(selectionStart);
      const lineNumber = line.number;
      
      const targetDoc = otherEditor.view.state.doc;
      const totalTargetLines = targetDoc.lines;
      const targetLineNumber = Math.min(lineNumber, totalTargetLines);
      
      if (targetLineNumber > 0) {
        const targetLinePos = targetDoc.line(targetLineNumber).from;
        const scrollEffect = EditorView.scrollIntoView(targetLinePos, {
          y: 'center',
          yMargin: 50
        });
        
        otherEditor.view.dispatch({
          effects: [scrollEffect]
        });
      }
      
      requestAnimationFrame(() => {
        isScrollSyncing.current = false;
      });
    } catch (error) {
      console.error('Error syncing text selection:', error);
      isScrollSyncing.current = false;
    }
  }, [isScrollSyncEnabled, generateSentenceMappings, externalAlignmentData]);

  const value: EditorContextValue = useMemo(() => ({
    sourceEditorRef,
    targetEditorRef,
    getSourceContent,
    getTargetContent,
    generateSentenceMappings,
    syncScrollToLine,
    syncToClickedLine,
    syncLineSelection,
    syncTextSelection,
    isScrollSyncing,
    isScrollSyncEnabled,
    setScrollSyncEnabled,
    externalAlignmentData,
    setExternalAlignmentData,
    loadAlignmentData,
    setOriginalSourceText,
    setOriginalTargetText,
    isContentValid,
  }), [getSourceContent, getTargetContent, generateSentenceMappings, syncScrollToLine, syncToClickedLine, syncLineSelection, syncTextSelection, isScrollSyncEnabled, externalAlignmentData, loadAlignmentData, setOriginalSourceText, setOriginalTargetText, isContentValid]);

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}

