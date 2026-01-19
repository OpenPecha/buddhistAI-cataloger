import { useState } from 'react';
import FileUploadZone from '@/components/textCreation/FileUploadZone';

interface OutlinerFileUploadZoneProps {
  onFileUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
}

/**
 * File upload zone component specifically for Outliner
 * Handles file upload to backend and shows loading state
 */
export const OutlinerFileUploadZone: React.FC<OutlinerFileUploadZoneProps> = ({
  onFileUpload,
  isUploading = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (content: string, filename: string) => {
    // Validate content
    if (!content || content.trim().length === 0) {
      console.error('Cannot upload empty content');
      return;
    }

    // Create a File object from the content
    // Ensure filename is always provided - use default if empty
    const fileFilename = filename && filename.trim() ? filename : 'document.txt';
    const blob = new Blob([content], { type: 'text/plain' });
    const file = new File([blob], fileFilename, { type: 'text/plain' });
    
    // Validate file was created correctly
    if (!file || file.size === 0) {
      console.error('Failed to create valid file from content');
      return;
    }
    
    setIsProcessing(true);
    try {
      await onFileUpload(file);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const isLoading = isUploading || isProcessing;

  return (
    <div className="relative">
      <FileUploadZone onFileUpload={handleFileUpload} />
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-sm text-gray-600">Uploading document...</p>
          </div>
        </div>
      )}
    </div>
  );
};
