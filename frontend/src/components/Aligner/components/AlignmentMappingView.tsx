import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { useTextSelectionStore } from '../../../stores/textSelectionStore';
import { fetchInstance } from '../../../api/text';

const AlignmentMappingView: React.FC = () => {
  const { 
    annotationData,
    sourceInstanceId,
    targetInstanceId
  } = useTextSelectionStore();
  
  const [isLoadingMergedText, setIsLoadingMergedText] = React.useState(false);
  const [sourceContent, setSourceContent] = React.useState<string>('');
  const [targetContent, setTargetContent] = React.useState<string>('');
  const [showEditor, setShowEditor] = React.useState(true);

  // Memoize rows calculation
  const rows = React.useMemo(() => {
    if (!annotationData) return [];

    // Create a reverse map: which alignment annotations map to each target annotation
    const alignmentMap = new Map<string, number[]>();
    for (let idx = 0; idx < annotationData.alignment_annotation.length; idx++) {
      const alignment = annotationData.alignment_annotation[idx];
      if (alignment?.aligned_segments) {
        for (const targetId of alignment.aligned_segments) {
          if (!alignmentMap.has(targetId)) {
            alignmentMap.set(targetId, []);
          }
          alignmentMap.get(targetId)!.push(idx);
        }
      }
    }

    // Create a map to track which sources have been displayed
    const displayedSources = new Set<number>();
    
    // Build rows based on alignment_annotation (targets) as primary driver
    const rowsArray: Array<{
      alignment: typeof annotationData.alignment_annotation[0];
      alignmentIdx: number;
      sources: Array<{ source: typeof annotationData.target_annotation[0]; sourceIdx: number }>;
    }> = [];

    // Iterate through alignment_annotation to create rows
    for (let alignmentIdx = 0; alignmentIdx < annotationData.alignment_annotation.length; alignmentIdx++) {
      const alignment = annotationData.alignment_annotation[alignmentIdx];
      if (!alignment) continue;
      
      const alignedSources: Array<{ source: typeof annotationData.target_annotation[0]; sourceIdx: number }> = [];
      
      // Find which sources map to this alignment
      if (alignment.aligned_segments && alignment.aligned_segments.length > 0) {
        for (const sourceId of alignment.aligned_segments) {
          const sourceIdx = annotationData.target_annotation.findIndex(t => t?.id === sourceId);
          if (sourceIdx >= 0 && annotationData.target_annotation[sourceIdx]) {
            alignedSources.push({
              source: annotationData.target_annotation[sourceIdx]!,
              sourceIdx
            });
            displayedSources.add(sourceIdx);
          }
        }
      }
      
      rowsArray.push({
        alignment,
        alignmentIdx,
        sources: alignedSources
      });
    }

    // Add any remaining source segments that weren't mapped to any target
    for (let sourceIdx = 0; sourceIdx < annotationData.target_annotation.length; sourceIdx++) {
      const source = annotationData.target_annotation[sourceIdx];
      if (!displayedSources.has(sourceIdx) && source && source.id !== null && source.id !== undefined) {
        // Find if this source maps to any alignment
        const mapsToAlignment = alignmentMap.has(source.id);
        if (!mapsToAlignment) {
          // Add as unmapped source row
          rowsArray.push({
            alignment: null,
            alignmentIdx: -1,
            sources: [{ source, sourceIdx }]
          });
        }
      }
    }

    return rowsArray;
  }, [annotationData]);

  // Generate merged content from rows - each segment separated by newline
  const generateMergedContent = React.useCallback(async () => {
    if (!sourceInstanceId || !targetInstanceId || !annotationData || rows.length === 0) {
      return;
    }

    setIsLoadingMergedText(true);
    try {
      // Fetch original instance data to get full text content
      // Note: These fetches happen in parallel, so we show a general message
      const [sourceInstanceData, targetInstanceData] = await Promise.all([
        fetchInstance(sourceInstanceId),
        fetchInstance(targetInstanceId)
      ]);

      const fullSourceContent = sourceInstanceData.content || '';
      const fullTargetContent = targetInstanceData.content || '';
      
      // Build separate content: each row's segments on separate lines
      const sourceLines: string[] = [];
      const targetLines: string[] = [];

      // Track positions to handle gaps and unaligned content
      let sourceLastEnd = 0;
      let targetLastEnd = 0;

      for (const row of rows) {
        const { alignment, sources } = row;
        const hasAlignment = alignment && alignment.id !== null;
        const hasSources = sources.length > 0;

        // Handle gaps - process both source and target gaps, ensuring alignment
        if (hasSources && sources[0]?.source && hasAlignment && alignment) {
          // Both have content - handle gaps before both
          const firstSource = sources[0].source;
          const sourceGapStart = sourceLastEnd;
          const sourceGapEnd = firstSource.span.start;
          const targetGapStart = targetLastEnd;
          const targetGapEnd = alignment.span.start;

          // If both have gaps, add them separately to maintain alignment
          if (sourceGapEnd > sourceGapStart) {
            const gapText = fullSourceContent.substring(sourceGapStart, sourceGapEnd);
            if (gapText.trim().length > 0 || gapText.length > 0) {
              sourceLines.push(gapText);
              targetLines.push(''); // Empty line to maintain alignment
            }
          }

          if (targetGapEnd > targetGapStart) {
            const gapText = fullTargetContent.substring(targetGapStart, targetGapEnd);
            if (gapText.trim().length > 0 || gapText.length > 0) {
              targetLines.push(gapText);
              sourceLines.push(''); // Empty line to maintain alignment
            }
          }
        } else if (hasSources && sources[0]?.source) {
          // Only source has content - handle gap before source
          const firstSource = sources[0].source;
          if (firstSource.span.start > sourceLastEnd) {
            const gapText = fullSourceContent.substring(sourceLastEnd, firstSource.span.start);
            if (gapText.trim().length > 0 || gapText.length > 0) {
              sourceLines.push(gapText);
              targetLines.push(''); // Empty line to maintain alignment
            }
          }
        } else if (hasAlignment && alignment) {
          // Only target has content - handle gap before target
          if (alignment.span.start > targetLastEnd) {
            const gapText = fullTargetContent.substring(targetLastEnd, alignment.span.start);
            if (gapText.trim().length > 0 || gapText.length > 0) {
              targetLines.push(gapText);
              sourceLines.push(''); // Empty line to maintain alignment
            }
          }
        }

        // Collect source segments for this row
        const sourceSegments: string[] = [];
        if (hasSources) {
          for (const { source } of sources) {
            if (source?.content) {
              sourceSegments.push(source.content);
            } else if (source) {
              // Fallback to extracting from content if content field is not available
              const segment = fullSourceContent.substring(source.span.start, source.span.end);
              if (segment.trim().length > 0 || segment.length > 0) {
                sourceSegments.push(segment);
              }
            }
          }
        }

        // Collect target segment for this row
        let targetSegment = '';
        if (hasAlignment && alignment) {
          if (alignment.content) {
            targetSegment = alignment.content;
          } else {
            // Fallback to extracting from content if content field is not available
            targetSegment = fullTargetContent.substring(alignment.span.start, alignment.span.end);
          }
        }

        // Add source line
        const sourceText = sourceSegments.join(' ');
        if (sourceText.trim().length > 0 || sourceText.length > 0) {
          sourceLines.push(sourceText);
        } else {
          sourceLines.push('');
        }

        // Add target line
        if (targetSegment.trim().length > 0 || targetSegment.length > 0) {
          targetLines.push(targetSegment);
        } else {
          targetLines.push('');
        }

        // Update last end positions
        if (hasSources && sources.length > 0) {
          const lastSource = sources[sources.length - 1]?.source;
          if (lastSource) {
            sourceLastEnd = Math.max(sourceLastEnd, lastSource.span.end);
          }
        }
        if (hasAlignment && alignment) {
          targetLastEnd = Math.max(targetLastEnd, alignment.span.end);
        }
      }

      // Handle any remaining content after the last annotations
      if (sourceLastEnd < fullSourceContent.length) {
        const remainingText = fullSourceContent.substring(sourceLastEnd);
        if (remainingText.trim().length > 0 || remainingText.length > 0) {
          sourceLines.push(remainingText);
          targetLines.push(''); // Empty line to maintain alignment
        }
      }

      if (targetLastEnd < fullTargetContent.length) {
        const remainingText = fullTargetContent.substring(targetLastEnd);
        if (remainingText.trim().length > 0 || remainingText.length > 0) {
          targetLines.push(remainingText);
          sourceLines.push(''); // Empty line to maintain alignment
        }
      }

      // Ensure both arrays have the same length
      const maxLength = Math.max(sourceLines.length, targetLines.length);
      while (sourceLines.length < maxLength) {
        sourceLines.push('');
      }
      while (targetLines.length < maxLength) {
        targetLines.push('');
      }

      setSourceContent(sourceLines.join('\n'));
      setTargetContent(targetLines.join('\n'));
      setShowEditor(true);
    } catch (error) {
      console.error('Error generating merged content:', error);
    } finally {
      setIsLoadingMergedText(false);
    }
  }, [rows, sourceInstanceId, targetInstanceId, annotationData]);

  // Generate merged content on mount or when rows change
  React.useEffect(() => {
    if (rows.length > 0 && sourceInstanceId && targetInstanceId) {
      generateMergedContent();
    }
  }, [rows.length, sourceInstanceId, targetInstanceId, generateMergedContent]);

  if (!annotationData) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No alignment data available
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-[86vh] pb-[10px]">
    
      {showEditor ? (
        <div className="flex-1 min-h-0 overflow-hidden flex gap-2 relative">
      
          
          {/* Source Editor */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-4 py-2 bg-green-50 border-b border-green-200 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <h3 className="text-sm font-semibold text-gray-700">Source Text</h3>
                {isLoadingMergedText && (
                  <span className="text-xs text-gray-500 ml-2">Loading...</span>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden relative">
              {isLoadingMergedText && !sourceContent ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-500">Preparing source content...</p>
                  </div>
                </div>
              ) : (
                <CodeMirror
                  value={sourceContent}
                  height="100%"
                  width="100%"
                  className="font-['monlam'] h-full"
                  editable={false}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    highlightSelectionMatches: false,
                  }}
                  extensions={[
                    EditorView.lineWrapping,
                  ]}
                />
              )}
            </div>
          </div>

          {/* Target Editor */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <h3 className="text-sm font-semibold text-gray-700">Target Text</h3>
                {isLoadingMergedText && (
                  <span className="text-xs text-gray-500 ml-2">Loading...</span>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden relative">
              {isLoadingMergedText && !targetContent ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-500">Preparing target content...</p>
                  </div>
                </div>
              ) : (
                <CodeMirror
                  value={targetContent}
                  height="100%"
                  width="100%"
                  className="font-['monlam'] h-full"
                  editable={false}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    highlightSelectionMatches: false,
                  }}
                  extensions={[
                    EditorView.lineWrapping,
                  ]}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-3">
            {rows.map((row, rowIdx) => {
              const { alignment, alignmentIdx, sources } = row;
              
              const isAlignmentGap = alignment && alignment.id === null;
              const hasAlignment = alignment && alignment.id !== null;

              return (
                <div key={rowIdx} className="grid grid-cols-2 gap-4">
                  {/* Source Column */}
                  <div className={`border rounded-lg p-3 flex flex-col ${
                    sources.length > 0
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    {sources.length > 0 ? (
                      <>
                        {sources.map(({ source, sourceIdx }, sourceItemIdx) => {
                          if (!source) return null;
                          return (
                            <div key={`${sourceIdx}-${sourceItemIdx}`} className={sourceItemIdx > 0 ? 'mt-3 pt-3 border-t border-green-300' : ''}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-gray-600">
                                  Source {sourceIdx + 1}
                                </span>
                                {source.id && (
                                  <span className="text-xs px-2 py-0.5 bg-green-200 text-gray-700 rounded">
                                    {source.id.substring(0, 8)}...
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-800 mb-2">
                                {source.content || '(no content)'}
                              </div>
                              <div className="text-xs text-gray-500 mb-2">
                                Span: [{source.span.start}-{source.span.end}]
                              </div>
                            </div>
                          );
                        })}
                        {/* Mapped to section - aligned at bottom */}
                        <div className="mt-auto pt-2 border-t border-green-300">
                          {hasAlignment ? (
                            <>
                              <div className="text-xs text-gray-600 font-semibold mb-1">
                                Mapped to:
                              </div>
                              <div className="text-xs text-gray-600">
                                → Target {alignmentIdx + 1}
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-gray-400 italic">No mapping</div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col h-full min-h-[100px]">
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-xs text-gray-400 italic">No source segment</div>
                        </div>
                        {/* Empty mapping section at bottom to align with target */}
                        <div className="mt-auto pt-2 border-t border-gray-300">
                          <div className="text-xs text-gray-400 italic">No mapping</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Target Column */}
                  <div className={`border rounded-lg p-3 flex flex-col ${
                    hasAlignment
                      ? 'bg-blue-50 border-blue-200'
                      : isAlignmentGap
                      ? 'bg-gray-50 border-gray-300'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    {hasAlignment ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-gray-600">
                            Target {alignmentIdx + 1}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-blue-200 text-gray-700 rounded">
                            {alignment.id?.substring(0, 8)}...
                          </span>
                        </div>
                        <div className="text-sm text-gray-800 mb-2">
                          {alignment.content || '(no content)'}
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          Span: [{alignment.span.start}-{alignment.span.end}]
                        </div>
                        {/* Mapped from section - aligned at bottom */}
                        <div className="mt-auto pt-2 border-t border-blue-300">
                          {sources.length > 0 ? (
                            <>
                              <div className="text-xs text-gray-600 font-semibold mb-1">
                                Mapped from:
                              </div>
                              {sources.map(({ sourceIdx }, idx) => (
                                <div key={`source-${sourceIdx}-${idx}`} className="text-xs text-gray-600">
                                  ← Source {sourceIdx + 1}
                                </div>
                              ))}
                            </>
                          ) : (
                            <div className="text-xs text-gray-400 italic">No mapping</div>
                          )}
                        </div>
                      </>
                    ) : isAlignmentGap ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-gray-600">
                            Target {alignmentIdx + 1}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-gray-300 text-gray-700 rounded">
                            Gap
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {alignment.content || '(gap content)'}
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          Span: [{alignment.span.start}-{alignment.span.end}]
                        </div>
                        {/* Empty mapping section at bottom to align with source */}
                        <div className="mt-auto pt-2 border-t border-gray-300">
                          <div className="text-xs text-gray-400 italic">No source mapping</div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col h-full min-h-[100px]">
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-xs text-gray-400 italic">No target segment</div>
                        </div>
                        {/* Empty mapping section at bottom to align with source */}
                        <div className="mt-auto pt-2 border-t border-gray-300">
                          <div className="text-xs text-gray-400 italic">No mapping</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlignmentMappingView;

