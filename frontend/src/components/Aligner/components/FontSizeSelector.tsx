import React from 'react';

interface FontSizeSelectorProps {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  availableSizes?: number[];
}

function FontSizeSelector({ 
  fontSize, 
  onFontSizeChange, 
  availableSizes = [12, 14, 16, 18, 20] 
}: FontSizeSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500 mr-1">Font:</span>
        <select
          value={fontSize}
          onChange={(e) => onFontSizeChange(parseInt(e.target.value))}
          className="text-xs leading-0 font-medium transition-colors text-gray-700 hover:bg-gray-100"
        >
          <option value="">default</option>
          {availableSizes.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      
    </div>
  );
}

export default FontSizeSelector;

