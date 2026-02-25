import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useOutlinerDocument } from '@/hooks/useOutlinerDocument';
import { OutlinerFileUploadZone } from '@/components/outliner/OutlinerFileUploadZone';
import { listOutlinerDocuments, updateDocumentStatus, assignVolume, type OutlineDocumentStatus, type OutlinerDocumentListItem } from '@/api/outliner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Upload, Calendar, BarChart3, Trash2, RotateCcw, Filter, Settings, Check, Workflow, Cross, TheaterIcon, Play, CheckLine } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { Progress } from '@/components/ui/progress';

// Simple modal implementation
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed z-50 inset-0 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-2xl p-0 relative animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <span className="text-2xl">&times;</span>
        </button>
        {children}
      </div>
    </div>
  );
}

const OutlinerUpload: React.FC = () => {
  const {user}= useUser();
  const isAdmin = user?.role === 'admin';
  const userId = user?.id;
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const { uploadFile, isLoading } = useOutlinerDocument();
  const queryClient = useQueryClient();
  // Fetch documents list with optional deleted filter
  const { data: documents = [], isLoading: isLoadingDocuments, refetch } = useQuery<OutlinerDocumentListItem[]>({
    queryKey: ['outliner-documents', userId, showDeleted],
    queryFn: () => listOutlinerDocuments(userId, 0, 100, showDeleted),
    enabled: !!userId,
  });

  // Filter documents based on current view
  const displayedDocuments = showDeleted
    ? documents.filter(doc => doc.status === 'deleted')
    : documents.filter(doc => doc.status !== 'deleted');

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => updateDocumentStatus(documentId, 'deleted', userId),
    onSuccess: () => {
      // Refetch documents list after deletion
      queryClient.invalidateQueries({ queryKey: ['outliner-documents', userId] });
    },
  });

  // Restore document mutation
  const restoreDocumentMutation = useMutation({
    mutationFn: (documentId: string) => updateDocumentStatus(documentId, 'active', userId),
    onSuccess: () => {
      // Refetch documents list after restoration
      queryClient.invalidateQueries({ queryKey: ['outliner-documents', userId] });
      toast.success('Document restored successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to restore document');
    },
  });


  const assignWorkMutation = useMutation({
    mutationFn: () => assignVolume(userId!),
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ['outliner-documents', userId] });
      toast.success(`Work assigned successfully! Document: ${document.filename || document.id}`);
      // Navigate to the assigned document
      navigate(`/outliner/${document.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign work');
    },
  });

  const assignWork = () => {
    if (!userId) {
      toast.error('User ID is required');
      return;
    }
    assignWorkMutation.mutate();
  };




  const handleFileUpload = async (file: File) => {
    await uploadFile(file, userId);
    // Refetch documents list after upload
    refetch();
    setShowUpload(false);
  };

  const handleDocumentClick = (documentId: string) => {
    navigate(`/outliner/${documentId}`);
  };

  const handleDeleteClick = async (e: React.MouseEvent, documentId: string) => {
    e.stopPropagation(); // Prevent row click
    if (globalThis.confirm('Are you sure you want to delete this document?')) {
      await deleteDocumentMutation.mutateAsync(documentId);
    }
  };

  const handleRestoreClick = async (e: React.MouseEvent, documentId: string) => {
    e.stopPropagation(); // Prevent row click
    await restoreDocumentMutation.mutateAsync(documentId);
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


  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Outliner Documents</h1>
            <p className="text-gray-600">Manage your text documents and annotations</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowDeleted(!showDeleted)}
              variant={showDeleted ? "default" : "outline"}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showDeleted ? 'Show Active' : 'Show Deleted'}
            </Button>
            {/* <Button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload New
            </Button> */}
                <Button 
              onClick={assignWork}
              disabled={assignWorkMutation.isPending || !userId}
            >
              {assignWorkMutation.isPending ? 'Assigning...' : 'Assign me a work'}
            </Button>
            {isAdmin && (
            <Link to="/outliner-admin">
             <Button variant="outline" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Admin
             </Button>
            </Link>
            )}
          </div>
        </div>

        {/* Modal for Upload */}
        <Modal open={showUpload} onClose={() => setShowUpload(false)}>
          <div className="p-6 w-full max-w-2xl">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Document</h1>
            </div>
         
            <OutlinerFileUploadZone onFileUpload={handleFileUpload} isUploading={isLoading} />
          </div>
        </Modal>

        {/* Documents List */}
        {isLoadingDocuments && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p className="text-gray-600">Loading documents...</p>
            </div>
          </div>
        )}
        {!isLoadingDocuments && displayedDocuments.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {showDeleted ? 'No deleted documents' : 'No documents yet'}
            </h2>
            <p className="text-gray-600 mb-6">
              {showDeleted 
                ? 'You don\'t have any deleted documents' 
                : 'Get started by uploading your first document'}
            </p>
            {!showDeleted && (
              <Button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 mx-auto"
              >
                <Upload className="w-4 h-4" />
                Upload Your First Document
              </Button>
            )}
          </div>
        )}
        {!isLoadingDocuments && displayedDocuments.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Document</TableHead>
                  <TableHead className="font-semibold">Progress</TableHead>
                  <TableHead className="font-semibold">Last Updated</TableHead>
                  <TableHead className="font-semibold w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedDocuments.map((doc) => {
                  const isDeleted = doc.status === 'deleted';
                  const isActive=doc.status==='active'||doc.status==='completed';
                  const isOwner = doc.user_id === userId || !doc.user_id;
                  const checked_percentage = (doc.checked_segments || 0) / (doc.total_segments || 1) * 100;
                  return (
                  <TableRow
                    key={doc.id}
                    onClick={() => {

                      if (!isDeleted && isActive)  {
                        handleDocumentClick(doc.id);
                      }
                    }}
                    className={`${isDeleted ||
                      !isActive ? 'opacity-60' : 'cursor-pointer hover:bg-gray-50'} transition-colors`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {doc.filename || 'Untitled Document'}
                          </div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            {doc.total_segments} segment{doc.total_segments === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-sm">Checked: {doc.checked_segments || 0} / {doc.total_segments}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Unchecked: {doc.unchecked_segments || 0}
                        </div>
                        <div className='flex gap-2 items-center'>

                        <Progress value={checked_percentage} />
                        <StatusPreview status={doc?.status||''}/>
                        </div>
                      </div>
                    </TableCell>
              
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {formatDate(doc.updated_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isDeleted && isOwner && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => handleRestoreClick(e, doc.id)}
                            disabled={restoreDocumentMutation.isPending}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Restore document"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                        {!isDeleted && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => handleDeleteClick(e, doc.id)}
                            disabled={deleteDocumentMutation.isPending}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutlinerUpload;

type StatusPreviewProps={
  status:OutlineDocumentStatus
}

const StatusPreview = ({status}:StatusPreviewProps) => {
  const statusIcons = {
    "completed": Check,
    "active": Play,
    "rejected": Cross,
    "approved": CheckLine
  };
  if(status===''||!status) return null;
  const Icon = statusIcons[status];
  if (!Icon) return null;
  return (
    <div title={status}>
      <Icon className="w-4 h-4" />
    </div>
  );
};