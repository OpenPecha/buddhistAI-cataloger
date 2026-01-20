import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import { OutlinerFileUploadZone } from '@/components/outliner/OutlinerFileUploadZone';
import { listOutlinerDocuments, type OutlinerDocumentListItem } from '@/api/outliner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Upload, Calendar, BarChart3 } from 'lucide-react';

const OutlinerUpload: React.FC = () => {
  const { user } = useAuth0();
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);
  const { uploadFile, isLoading } = useOutlinerDocument();

  // Fetch documents list
  const { data: documents = [], isLoading: isLoadingDocuments, refetch } = useQuery<OutlinerDocumentListItem[]>({
    queryKey: ['outliner-documents', user?.sub],
    queryFn: () => listOutlinerDocuments(user?.sub),
    enabled: !!user?.sub,
  });

  const handleFileUpload = async (file: File) => {
    await uploadFile(file, user?.sub);
    // Refetch documents list after upload
    refetch();
    setShowUpload(false);
  };

  const handleDocumentClick = (documentId: string) => {
    navigate(`/outliner/${documentId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatProgress = (progress: number) => {
    return `${Math.round(progress)}%`;
  };

  if (showUpload) {
    return (
      <div className="h-screen flex items-center justify-center p-12 bg-gray-50">
        <div className="w-full max-w-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Document</h1>
            <p className="text-gray-600">Upload a text file to start outlining</p>
          </div>
          <div className="mb-4">
            <Button
              variant="outline"
              onClick={() => setShowUpload(false)}
              className="w-full"
            >
              ← Back to Documents
            </Button>
          </div>
          <OutlinerFileUploadZone onFileUpload={handleFileUpload} isUploading={isLoading} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Outliner Documents</h1>
            <p className="text-gray-600">Manage your text documents and annotations</p>
          </div>
          <Button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload New
          </Button>
        </div>

        {/* Documents List */}
        {isLoadingDocuments && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p className="text-gray-600">Loading documents...</p>
            </div>
          </div>
        )}
        {!isLoadingDocuments && documents.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No documents yet</h2>
            <p className="text-gray-600 mb-6">Get started by uploading your first document</p>
            <Button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 mx-auto"
            >
              <Upload className="w-4 h-4" />
              Upload Your First Document
            </Button>
          </div>
        )}
        {!isLoadingDocuments && documents.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Document</TableHead>
                  <TableHead className="font-semibold">Progress</TableHead>
                  <TableHead className="font-semibold">Segments</TableHead>
                  <TableHead className="font-semibold">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow
                    key={doc.id}
                    onClick={() => handleDocumentClick(doc.id)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {doc.filename || 'Untitled Document'}
                          </div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            {doc.total_segments} segment{doc.total_segments !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-sm">Checked: {doc.checked_segments || 0} / {doc.total_segments}</span>
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-600 transition-all"
                              style={{ width: `${doc.total_segments > 0 ? ((doc.checked_segments || 0) / doc.total_segments) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          Unchecked: {doc.unchecked_segments || 0}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600">
                        <div>
                          <span className="font-medium">{doc.checked_segments || 0}</span>
                          <span className="text-gray-400"> / </span>
                          <span>{doc.total_segments}</span>
                          <span className="text-gray-400 ml-1">checked</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="font-medium">{doc.annotated_segments}</span>
                          <span className="text-gray-400"> annotated</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {formatDate(doc.updated_at)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutlinerUpload;
