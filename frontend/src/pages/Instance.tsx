import { useInstance } from '@/hooks/useTexts';
import { useParams } from 'react-router-dom';
import InstanceCard from '../components/InstanceCard';
import BreadCrumb from '../components/BreadCrumb';
import type { OpenPechaTextInstance } from '@/types/text';
import { useTranslation } from 'react-i18next';

function Instance() {
  const { t } = useTranslation();
  const { instance_id } = useParams();
  const {
    data: instance,
    isLoading,
    error,
    refetch
  } = useInstance(instance_id || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">{t('common.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-400 mr-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-800">{t('common.error')}</h3>
            <p className="text-sm text-red-600 mt-1">
              {error instanceof Error ? error.message : t('messages.loadError')}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
        >
          {t('textsPage.retry')}
        </button>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('messages.loadError')}</h3>
        <p className="text-gray-500">{t('messages.loadError')}</p>
      </div>
    );
  }
  const title = instance.metadata?.colophon || t('header.instances');
  return (
    <div className="space-y-6 container mx-auto py-16 ">
      {/* Breadcrumb */}
      <BreadCrumb instancename={title}/>
      <InstanceCard instance={instance as OpenPechaTextInstance} />
    </div>
  );
}

export default Instance;
