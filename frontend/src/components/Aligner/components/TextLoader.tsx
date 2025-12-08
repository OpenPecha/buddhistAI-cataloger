import React, { useRef, useState } from 'react';
import { toast } from 'sonner';

interface TextLoaderProps {
  onTextLoad: (text: string, source: 'file' | 'api') => void;
  isLoading?: boolean;
}

const TextLoader: React.FC<TextLoaderProps> = ({ onTextLoad, isLoading = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isApiLoading, setIsApiLoading] = useState(false);


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
      try {
        const text = await file.text();
        onTextLoad(text, 'file');
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Error reading file:', error);
        toast.error('Error reading file. Please try again.')
      }
    } else {
      toast.error('Please select a valid text file (.txt)')
    }
  };

 

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="absolute top-2 right-2 z-10 flex gap-2">
      {/* File Upload Button */}
      <button
        onClick={handleFileClick}
        disabled={isLoading || isApiLoading}
        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-1"
        title="Load text from file"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        File
      </button>


      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};

export default TextLoader;
