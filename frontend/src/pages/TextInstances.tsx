import {
  useTextInstance,
  useText,
  useRelatedInstances,
} from "@/hooks/useTexts";
import { useParams, Link } from "react-router-dom";
import TextCard from "@/components/TextCard";
import TextInstanceCard from "@/components/TextInstanceCard";
import BreadCrumb from "@/components/BreadCrumb";
import type { OpenPechaTextInstanceListItem, RelatedInstance } from "@/types/text";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

function TextInstanceCRUD() {
  const { t } = useTranslation();
  const { text_id } = useParams();

  const {
    data: instances = [],
    isLoading: isLoadingInstances,
    error: instancesError,
    refetch: refetchInstances,
  } = useTextInstance(text_id || "");
  const { data: text } = useText(text_id || "");

  // Find the critical instance
  const criticalInstance = useMemo(() => {
    return instances.find((instance: OpenPechaTextInstanceListItem) => instance.type === "critical");
  }, [instances]);

  // Fetch related instances using the critical instance ID
  const {
    data: relatedInstances = [],
    isLoading: isLoadingRelated,
    error: relatedError,
    refetch: refetchRelated,
  } = useRelatedInstances(criticalInstance?.id || null);

  // Loading state for instances
  if (isLoadingInstances) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">{t('textInstances.loadingTextDetails')}</span>
      </div>
    );
  }

  // Error state for instances
  if (instancesError) {
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
              {t('textInstances.errorLoading')}
            </h3>
            <p className="text-sm text-red-600 mt-1">
              {instancesError instanceof Error
                ? instancesError.message
                : t('textInstances.unknownError')}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetchInstances()}
          className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
        >
          {t('textInstances.tryAgain')}
        </button>
      </div>
    );
  }

  // No instances found
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
          {t('textInstances.noTextDetailsFound')}
        </h3>
        <p className="text-gray-500">{t('textInstances.noTextDetailsDescription')}</p>
      </div>
    );
  }

  const title = text?.title?.bo || text?.title?.en || text?.title?.sa || t('textInstances.untitled');

  const textWithoutAlignmentExists = relatedInstances.some((relatedInstance: RelatedInstance) => !relatedInstance.annotation);
  // Helper function to get title - always get the first value from dictionary
  const getTitle = (titleObj: RelatedInstance["metadata"]["title"]) => {
    if (!titleObj || Object.keys(titleObj).length === 0) {
      return t('textInstances.untitled');
    }
    return Object.values(titleObj)[0] || t('textInstances.untitled');
  };

  return (
    <div className="container mx-auto py-16  space-y-6">
      {/* Breadcrumb */}
      <BreadCrumb textname={title} />

      <div className=" flex justify-between items-center px-2 sm:px-0">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center sm:text-left break-words">{title}</h2>
        {textWithoutAlignmentExists && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <div className="flex items-center">
              <div className="text-red-400 mr-3">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                Warning: Some texts do not have alignment.
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Original Instances Layout */}
      <div className="grid gap-6 px-2 sm:px-0">
        {instances.map((instance: OpenPechaTextInstanceListItem) => (
          <TextInstanceCard key={instance.id} instance={instance} />
        ))}
      </div>

      {/* Related Instances Section - Only show if critical instance exists */}
      {criticalInstance && (
        <div className="space-y-4 mt-8">
          <div className="px-2 sm:px-0">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-600">{t('textInstances.relatedTexts')}</h3>
          </div>

          {/* Loading state for related instances */}
          {isLoadingRelated && (
            <div className="flex items-center justify-center min-h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">{t('textInstances.loadingRelatedTexts')}</span>
            </div>
          )}

          {/* Error state for related instances */}
          {relatedError && (
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
                    {t('textInstances.errorLoadingRelatedTexts')}
                  </h3>
                  <p className="text-sm text-red-600 mt-1">
                    {relatedError instanceof Error
                      ? relatedError.message
                      : t('textInstances.unknownError')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => refetchRelated()}
                className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
              >
                {t('textInstances.tryAgain')}
              </button>
            </div>
          )}

          {/* Display related instances */}
          {!isLoadingRelated && !relatedError && (
            <>
              {relatedInstances.length === 0 ? (
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
                    {t('textInstances.noRelatedTextsFound')}
                  </h3>
                </div>
              ) : (
                <div className="grid gap-6 px-2 sm:px-0 md:grid-cols-2 lg:grid-cols-3">
                  {relatedInstances.map((relatedInstance: RelatedInstance) => {
                    const metadata = relatedInstance.metadata;
                    const textId = metadata.text_id;
                    const instanceId = relatedInstance.instance_id;
                    const isAnnotationAvailable = !!relatedInstance.annotation;
                    const sourceInstanceId = criticalInstance?.id;
                    return (
                      <Link
                        key={relatedInstance.instance_id}
                        to={`/texts/${textId}/instances/${instanceId}`}
                        className="block pointer-events-auto"
                      >
                        <TextCard
                          title={getTitle(metadata.title)}
                          language={metadata.language}
                          type={relatedInstance.relationship}
                          bdrcId={undefined}
                          isAnnotationAvailable={isAnnotationAvailable}
                          instanceId={instanceId}
                          sourceInstanceId={sourceInstanceId}
                        />
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default TextInstanceCRUD;
