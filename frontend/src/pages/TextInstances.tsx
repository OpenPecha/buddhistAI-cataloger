import {
  useTextInstance,
  useText,
} from "@/hooks/useTexts";
import { useParams } from "react-router-dom";
import TextInstanceCard from "@/components/TextInstanceCard";
import BreadCrumb from "@/components/BreadCrumb";
import type { OpenPechaTextInstanceListItem } from "@/types/text";

function TextInstanceCRUD() {
  const { text_id } = useParams();

  const {
    data: instances = [],
    isLoading,
    error,
    refetch,
  } = useTextInstance(text_id || "");
  const { data: text } = useText(text_id || "");

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

      <div className="px-2 sm:px-0">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center sm:text-left break-words">{title}</h2>
      </div>

      <div className="grid gap-6 px-2 sm:px-0">
        {instances.map((instance: OpenPechaTextInstanceListItem) => (
          <TextInstanceCard key={instance.id} instance={instance} />
        ))}
      </div>
    </div>
  );
}

export default TextInstanceCRUD;
