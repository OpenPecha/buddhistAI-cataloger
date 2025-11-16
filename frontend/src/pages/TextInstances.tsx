import {
  useTextInstance,
  useCreateTextInstance,
  useText,
} from "@/hooks/useTexts";
import { useParams } from "react-router-dom";
import TextInstanceCard from "@/components/TextInstanceCard";
import BreadCrumb from "@/components/BreadCrumb";
import InstanceCreationForm from "@/components/InstanceCreationForm";
import type { OpenPechaTextInstanceListItem } from "@/types/text";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";

function TextInstanceCRUD() {
  const { text_id } = useParams();
  const { user } = useAuth0();
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const {
    data: instances = [],
    isLoading,
    error,
    refetch,
  } = useTextInstance(text_id || "");
  const { data: text } = useText(text_id || "");
  const createInstanceMutation = useCreateTextInstance();

  const handleInstanceSubmit = async (instanceData: any) => {
    setIsSubmitting(true);
    createInstanceMutation.mutate(
      {
        textId: text_id || "",
        instanceData,
        user:JSON.stringify(user || {}),
      },
      {
        onSuccess: () => {
          setShowModal(false);
          setIsSubmitting(false);
          refetch();
          setNotification({
            type: 'success',
            message: 'Text instance created successfully!'
          });
        },
        onError: (error) => {
          setIsSubmitting(false);
          setNotification({
            type: 'error',
            message: error.message || 'Failed to create instance'
          });
        },
      }
    );
  };

  const openModal = () => {
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading text details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-400 mr-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-800">
              Error loading text details
            </h3>
            <p className="text-sm text-red-600 mt-1">
              {error instanceof Error
                ? error.message
                : "An unknown error occurred"}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!instances || instances.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg
            className="w-12 h-12 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Text Details Found
        </h3>
        <p className="text-gray-500">This text doesn't have any details yet.</p>
      </div>
    );
  }

  const title = text?.title?.bo || text?.title?.en || text?.title?.sa || "Untitled";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <BreadCrumb textname={title} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-gray-600 mt-1">
            Found {instances.length} detail{instances.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={openModal}>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Details
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {instances.map((instance: OpenPechaTextInstanceListItem) => (
          <TextInstanceCard key={instance.id} instance={instance} />
        ))}
      </div>

      {/* Create Instance Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Create Text Instance</h3>
              <Button variant={"ghost"} onClick={closeModal}>
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </div>

            <InstanceCreationForm
              onSubmit={handleInstanceSubmit}
              isSubmitting={isSubmitting}
              onCancel={closeModal}
            />
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 duration-300">
          <div
            className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg border-2 min-w-[320px] ${
              notification.type === 'success'
                ? 'bg-green-50 border-green-500 text-green-900'
                : 'bg-red-50 border-red-500 text-red-900'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-semibold text-sm">
                {notification.type === 'success' ? 'Success!' : 'Error'}
              </p>
              <p className="text-sm mt-1">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-500 hover:text-gray-700 flex-shrink-0"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TextInstanceCRUD;
