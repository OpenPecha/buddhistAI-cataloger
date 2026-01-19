import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import { OutlinerFileUploadZone } from '@/components/outliner/OutlinerFileUploadZone';

const OutlinerUpload: React.FC = () => {
  const { user } = useAuth0();
  const { uploadFile, isLoading } = useOutlinerDocument();

  const handleFileUpload = async (file: File) => {
    await uploadFile(file, user?.sub);
  };

  return (
    <div className="h-screen flex items-center justify-center p-12 bg-gray-50">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Document</h1>
          <p className="text-gray-600">Upload a text file to start outlining</p>
        </div>
        <OutlinerFileUploadZone onFileUpload={handleFileUpload} isUploading={isLoading} />
      </div>
    </div>
  );
};

export default OutlinerUpload;
