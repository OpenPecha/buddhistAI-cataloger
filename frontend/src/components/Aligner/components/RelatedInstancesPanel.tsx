import React from 'react';
import { useRelatedInstances, type RelatedInstance } from '../hooks/useRelatedInstances';
import { getLanguageFromCode } from '../utils/languageUtils';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RelatedInstanceResponse {
  instance_id: string;
  metadata: {
    instance_type: string;
    copyright: string;
    text_id: string;
    title: Record<string, string>;
    alt_titles: Array<Record<string, string>>;
    language: string;
    contributions: Array<{
      person_id: string;
      role: string;
    }>;
  };
  annotation: string;
  relationship: string;
}

interface RelatedInstancesPanelProps {
  sourceInstanceId: string | null;
  selectedTargetInstanceId: string | null;
  onTargetInstanceSelect: (instanceId: string, hasAlignment: boolean) => void;
  onCreateTranslation: () => void;
  onCreateCommentary: () => void;
}

export function RelatedInstancesPanel({
  sourceInstanceId,
  selectedTargetInstanceId,
  onTargetInstanceSelect,
  onCreateTranslation,
  onCreateCommentary,
}: RelatedInstancesPanelProps) {
  const { data: relatedInstances = [], isLoading: isLoadingRelatedInstances, error: relatedInstancesError,refetch: refetchRelatedInstances } = useRelatedInstances(
    sourceInstanceId
  );


  const getInstanceTitle = (instance: RelatedInstance): string => {
    const isNewFormat = 'instance_id' in instance && 'metadata' in instance;
    
    if (isNewFormat) {
      const apiInstance = instance as RelatedInstanceResponse;
      const titleObj = apiInstance.metadata.title;
      const firstTitleKey = titleObj ? Object.keys(titleObj)[0] : undefined;
      return (firstTitleKey && titleObj[firstTitleKey]) || `Instance ${instance.instance_id || instance.id}`;
    } else {
      const titleObj = instance.incipit_title;
      const altTitlesObj = instance.alt_incipit_titles;
      const titleObjTyped = titleObj && typeof titleObj === 'object' && titleObj !== null ? titleObj as Record<string, string> : null;
      const altTitlesObjTyped = altTitlesObj && typeof altTitlesObj === 'object' && altTitlesObj !== null ? altTitlesObj as Record<string, string> : null;
      const firstTitleKey = titleObjTyped ? Object.keys(titleObjTyped)[0] : undefined;
      const firstAltTitleKey = altTitlesObjTyped ? Object.keys(altTitlesObjTyped)[0] : undefined;
      
      return (firstTitleKey && titleObjTyped?.[firstTitleKey]) || 
             (firstAltTitleKey && altTitlesObjTyped?.[firstAltTitleKey]) || 
             `Instance ${instance.instance_id || instance.id}`;
    }
  };

  const getInstanceMetadata = (instance: RelatedInstance) => {
    const isNewFormat = 'instance_id' in instance && 'metadata' in instance;
    
    if (isNewFormat) {
      const apiInstance = instance as RelatedInstanceResponse;
      const language = apiInstance.metadata.language ? ` ${apiInstance.metadata.language}` : '';
      const relationship = apiInstance.relationship ? ` [${apiInstance.relationship}]` : '';
      const hasAlignment = Boolean(apiInstance.annotation);
      return { language, relationship, hasAlignment };
    } else {
      const annotations = instance.annotations;
      const hasAlignment = Boolean(
        annotations && 
        typeof annotations === 'object' && 
        Object.values(annotations).some((annArray) => 
          Array.isArray(annArray) && 
          annArray.some((ann: unknown) => 
            typeof ann === 'object' && ann !== null && 'type' in ann && (ann as {type: string}).type === 'alignment'
          )
        )
      );
      return { language: '', relationship: '', hasAlignment };
    }
  };

  return (
    <div className="rounded-lg">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className=" flex text-lg font-medium text-gray-900 mb-2">
            Align with Existing Text
            <button
            onClick={() => refetchRelatedInstances()}
            className=" ml-2 text-sm font-medium rounded-md focus:ring-offset-2 transition-colors flex items-center gap-2"
            disabled={isLoadingRelatedInstances}
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingRelatedInstances ? 'animate-spin' : ''}`} />
          </button>
          </h3>
     
          <p className="text-sm text-gray-600">
            Select a related translation or commentary to align with, or create a new one:
          </p>
        </div>
        <div className="flex flex-col gap-2 ml-4">
          {/* Create Translation Button */}
          <button
            onClick={onCreateTranslation}
            className="px-4 py-2 bg-blue-600 font-poppins text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <span className="hidden sm:inline">Create Translation</span>
            <span className="sm:hidden">Translation</span>
          </button>

          {/* Create Commentary Button */}
          <button
            onClick={onCreateCommentary}
            className="px-4 py-2 bg-green-600 font-poppins text-white  text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="hidden sm:inline">Create Commentary</span>
            <span className="sm:hidden">Commentary</span>
          </button>
        </div>
      </div>

     <AlignmentList isLoadingRelatedInstances={isLoadingRelatedInstances} relatedInstancesError={relatedInstancesError} availableTargetInstances={relatedInstances} selectedTargetInstanceId={selectedTargetInstanceId} sourceInstanceId={sourceInstanceId} onTargetInstanceSelect={onTargetInstanceSelect} getInstanceTitle={getInstanceTitle} getInstanceMetadata={getInstanceMetadata}/>
    </div>
  );
}




const AlignmentList = ({
  isLoadingRelatedInstances,
  relatedInstancesError,
  availableTargetInstances,
  selectedTargetInstanceId,
  sourceInstanceId,
  onTargetInstanceSelect,
  getInstanceTitle,
  getInstanceMetadata,
}: {
  isLoadingRelatedInstances: boolean;
  relatedInstancesError: Error | null;
  availableTargetInstances: RelatedInstance[];
  selectedTargetInstanceId: string | null;
  sourceInstanceId: string | null;
  onTargetInstanceSelect: (instanceId: string, hasAlignment: boolean) => void;
  getInstanceTitle: (instance: RelatedInstance) => string;
  getInstanceMetadata: (instance: RelatedInstance) => { language: string; relationship: string; hasAlignment: boolean };
}) => {
  const navigate = useNavigate();


  if (isLoadingRelatedInstances) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center space-x-2 text-sm text-blue-600">
          <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading related instances...</span>
        </div>
      </div>
    );
  }
  
  if (relatedInstancesError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-sm text-red-600">
          Failed to load related instances: {relatedInstancesError.message}
        </p>
      </div>
    );
  }
  
  if (availableTargetInstances.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
        <p className="text-sm text-gray-600 text-center">
          No related instances found
        </p>
      </div>
    );
  }

return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {availableTargetInstances.map((instance) => {
        
        const instanceId = instance.instance_id || instance.id;
        
        const isSelected = selectedTargetInstanceId === instanceId;
        const title = getInstanceTitle(instance);
        const { language, relationship, hasAlignment } = getInstanceMetadata(instance);

        const handleClick = () => {
          if (sourceInstanceId && instanceId) {
            navigate(`/aligner/${sourceInstanceId}/${instanceId}`);
          } else {
            onTargetInstanceSelect(instanceId, hasAlignment);
          }
        };

        return (
          <button
            key={instanceId}
            onClick={handleClick}
            className={`p-4 border-2 cursor-pointer rounded-lg text-left transition-all hover:shadow-md relative ${
              isSelected
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              {isSelected && (
                <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <h4 className={`font-bold mb-1 ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
              {title}
            </h4>
            <div className="flex w-full flex-wrap gap-1 mt-2 justify-between">
              {language && (
                <span className="text-xs px-2 py-0.5 capitalize rounded bg-purple-100 text-purple-700 font-medium">
                  {getLanguageFromCode(language)}-{relationship.replace(/[[\]]/g, '')}
                </span>
              )}
            
                {!hasAlignment && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 font-medium">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Not Aligned
                  </span>
                )}
            </div>
          </button>
        );
      })}
    </div>
  );
}