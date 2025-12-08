import React from 'react';
import { useTexts, useInstance, useTextInstances } from '@/hooks/useTextData';
import { useTextSelectionStore } from '../../../stores/textSelectionStore';
import { PlusCircle, RotateCcw } from 'lucide-react';
import { CATALOGER_URL } from '@/config';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function SourceSelectionPanel() {
  const { t } = useTranslation();
  const {
    sourceTextId, sourceInstanceId,
    setSourceSelection
  } = useTextSelectionStore();
  
  const [selectedTextId, setSelectedTextId] = React.useState<string>(sourceTextId || '');
  const [selectedInstanceId, setSelectedInstanceId] = React.useState<string | null>(sourceInstanceId || null);
  
  const [, setSearchParams] = useSearchParams();
  
  // React Query hooks
  const { data: availableTexts = [], isLoading: isLoadingTexts, error: textsError } = useTexts();
  const { data: instancesData, isLoading: isLoadingInstances, error: instancesError } = useTextInstances(selectedTextId);
  const { isLoading: isLoadingInstance, error: instanceError } = useInstance(selectedInstanceId);
  
  // Available instances for source editor
  const availableInstances = React.useMemo(() => {
    return Array.isArray(instancesData) ? instancesData : [];
  }, [instancesData]);
  
  // Sync local state with store state
  React.useEffect(() => {
    setSelectedTextId(sourceTextId || '');
    setSelectedInstanceId(sourceInstanceId || null);
  }, [sourceTextId, sourceInstanceId]);

  // Handle text selection from dropdown (first step)
  const handleTextSelection = React.useCallback((textId: string) => {
    if (!textId) return;
    
    setSelectedTextId(textId);
    setSelectedInstanceId(null); // Clear instance selection when text changes
  }, []);

  // Handle instance selection from dropdown (second step)
  const handleInstanceSelection = React.useCallback((instanceId: string) => {
    console.log('🔗 Instance selection:', instanceId);
    if (!instanceId || !selectedTextId) return;
    
    setSelectedInstanceId(instanceId);
    
    try {
      setSourceSelection(selectedTextId, instanceId);
      
      setSearchParams((prev) => {
        prev.set('s_id', instanceId);
        return prev;
      });
      
    } catch (error) {
      console.error('Error updating source parameters:', error);
    }
  }, [selectedTextId, setSourceSelection, setSearchParams]);

  // Handle creating new text (redirect to cataloger)
  const handleCreateText = React.useCallback(() => {
    if (!selectedTextId) return;
    const selected = `${CATALOGER_URL}/create?t_Id=${selectedTextId}`;
    window.open(selected, '_blank');
  }, [selectedTextId]);

  // Handle reset - clear source selection
  const handleReset = React.useCallback(() => {
    const { clearSourceSelection } = useTextSelectionStore.getState();
    clearSourceSelection();
    
    // Also clear local state
    setSelectedTextId('');
    setSelectedInstanceId(null);
    
    // Clear URL parameters for source
    setSearchParams((prev) => {
      prev.delete('s_id');
      prev.delete('sTextId');
      prev.delete('sInstanceId');
      return prev;
    });
    
    // Invalidate all queries to refresh data
  }, [setSearchParams]);

  return (
    <div className="h-full flex flex-col bg-gray-50 border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {t('aligner.sourceText')}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {t('aligner.selectSourceText')}
            </p>
          </div>
          {/* Reset button - show when there is a source selection */}
          {sourceInstanceId && (
            <button 
              title={t('aligner.resetSourceTextSelection')} 
              onClick={handleReset} 
              className='cursor-pointer flex gap-2 items-center px-3 py-2 text-sm rounded transition-colors hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300'
            >
              <RotateCcw className="w-4 h-4" />
              <Link to="/aligner" className="hidden sm:inline">{t('common.reset')}</Link>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Step 1: Text Selection Dropdown */}
        <div className="space-y-2">
          <label htmlFor="source-text-select" className="block text-sm font-medium text-gray-700">
            {t('aligner.step1SelectSourceText')}
          </label>
          <select
            id="source-text-select"
            value={selectedTextId}
            onChange={(e) => handleTextSelection(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">
              {(() => {
                if (isLoadingTexts) return t('aligner.loadingTexts');
                if (textsError) return t('aligner.errorLoadingTexts');
                return t('aligner.chooseText');
              })()}
            </option>
            {availableTexts.map((text) => (
              <option key={text.id} value={text.id}>
                {text.title.bo || text.title.en || text.title[Object.keys(text.title)[0]] || `Text ${text.id}`}
                {text.language && ` (${text.language})`}
              </option>
            ))}
          </select>
          {textsError && (
            <p className="text-sm text-red-600">
              {t('aligner.failedToLoadTexts')}: {textsError.message}
            </p>
          )}
        </div>

        {/* Step 2: Instance Selection Dropdown */}
        {selectedTextId && (
          <div className="space-y-2">
            <label htmlFor="source-instance-select" className="block text-sm font-medium text-gray-700">
              {t('aligner.step2SelectInstance')}
            </label>
            <div className="flex gap-2 items-center">
              <select
                id="source-instance-select"
                value={selectedInstanceId || ""}
                onChange={(e) => handleInstanceSelection(e.target.value)}
                disabled={isLoadingInstances || isLoadingInstance}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">
                  {(() => {
                    if (isLoadingInstances) return t('aligner.loadingInstances');
                    if (instancesError) return t('aligner.errorLoadingInstances');
                    if (availableInstances?.length === 0) return t('common.empty');
                    return t('aligner.chooseInstance');
                  })()}
                </option>
                {availableInstances.map((instance) => {
                  if (!instance) return null;
                  const incipitTitle = instance?.incipit_title;
                  const altIncipitTitles = instance?.alt_incipit_titles;
                  const firstIncipitKey = incipitTitle && typeof incipitTitle === 'object' ? Object.keys(incipitTitle)[0] : undefined;
                  const firstAltIncipitKey = altIncipitTitles && typeof altIncipitTitles === 'object' ? Object.keys(altIncipitTitles)[0] : undefined;
                  const title = (firstIncipitKey && incipitTitle && typeof incipitTitle === 'object' && incipitTitle[firstIncipitKey]) || 
                                (firstAltIncipitKey && altIncipitTitles && typeof altIncipitTitles === 'object' && altIncipitTitles[firstAltIncipitKey]) || 
                                `Instance ${instance.id}`;

                  return (
                    <option key={instance.id} value={instance.id}>
                      {instance.type || 'Instance'} - {title}
                    </option>
                  );
                })}
              </select>
              {isLoadingInstance ? (
                <div className="flex items-center px-2">
                  <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : (
                <div className="flex gap-1">
                  <button title="Create new instance" onClick={handleCreateText} className='cursor-pointer flex gap-2 items-center px-3 py-2 text-sm rounded transition-colors hover:bg-gray-100'>
                    <PlusCircle className="w-5 h-5 text-gray-500" /> 
                  </button>
                  <button title="Reset source selection" onClick={handleReset} className='cursor-pointer flex gap-2 items-center px-3 py-2 text-sm rounded transition-colors hover:bg-gray-100 text-red-600 hover:bg-red-50'>
                    <RotateCcw className="w-5 h-5" /> 
                  </button>
                </div>
              )}
            </div>
            {instancesError && (
              <p className="text-sm text-red-600">
                {t('aligner.failedToLoadInstances')}: {instancesError.message}
              </p>
            )}
            {instanceError && (
              <p className="text-sm text-red-600">{t('aligner.failedToLoadInstances')}: {instanceError.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SourceSelectionPanel;
