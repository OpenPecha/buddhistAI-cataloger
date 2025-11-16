import React, { memo, useEffect, useState } from 'react';

interface FormattedTextDisplayProps {
  content?: string;
  lines?: string[];
}

/**
 * Reusable component to display text content with line breaks
 * Accepts either:
 * - content: raw string that will be processed (removes empty lines)
 * - lines: pre-processed array of lines
 */
const FormattedTextDisplay: React.FC<FormattedTextDisplayProps> = ({ content, lines }) => {
  // Process content to split into lines (same logic as annotation calculator)
  const getFormattedLines = () => {
    // If lines are provided directly, use them
    if (lines && lines.length > 0) {
      return lines;
    }
    
    if (!content) return [];
    
    // Split by newlines
    const contentLines = content.split('\n');
    
    // Remove trailing empty lines
    while (contentLines.length > 0 && contentLines[contentLines.length - 1].trim() === '') {
      contentLines.pop();
    }
    
    // Filter out empty lines (length === 0)
    const filteredLines = contentLines.filter(line => line.length > 0);
    
    return filteredLines;
  };
  const contentLines = getFormattedLines();
  if (contentLines.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>No content to display</p>
      </div>
    );
  }

  return (
    <div className="h-[80dvh] overflow-y-auto">
      {contentLines.map((line, index) => (
        <div 
          key={index} 
          className="py-3 px-4 border-b border-gray-200 font-['noto'] last:border-0 text-base leading-relaxed text-gray-900"
        >
          {line || <span className="text-gray-400 italic">(empty line)</span>}
        </div>
      ))}
    </div>
  );
};

export default memo(FormattedTextDisplay);

