import { useTexts } from '../hooks/useTexts';
import type { OpenPechaText } from '../types/text';
import { Button } from './ui/button';



const TextList = () => {
  const {
    data: texts = [],
    isLoading,
    error,
    refetch,
    isRefetching
  } = useTexts();

  // Helper function to get the main title
  const getMainTitle = (text: OpenPechaText): string => {
    if (text.title && text.title[text.language]) {
      return text.title[text.language];
    }
    // Fallback to first available title
    const firstTitle = Object.values(text.title)[0];
    return firstTitle || 'Untitled';
  };

  // Helper function to get contributors
  const getContributors = (text: OpenPechaText): string => {
    const roles = text.contributions.map(contrib => contrib.role);
    const uniqueRoles = [...new Set(roles)];
    return uniqueRoles.join(', ');
  };

  // Helper function to get alternative titles
  const getAltTitles = (text: OpenPechaText): string[] => {
    return text.alt_titles.map(altTitle => Object.values(altTitle)[0]).slice(0, 3);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">
            {error instanceof Error ? error.message : 'Failed to load texts'}
          </p>
          <button 
            onClick={() => refetch()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Text Collection</h1>
    
      </div>

      {texts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-xl">No texts found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {texts.map((text: OpenPechaText) => (
            <div key={text.id} className="bg-white rounded-lg shadow-md p-6 border hover:shadow-lg transition-shadow">
              {/* Main Title */}
              <h3 className="text-xl font-semibold text-gray-800 mb-3 leading-tight">
                {getMainTitle(text)}
              </h3>

              {/* Language Badge */}
              <div className="mb-3">
                <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                  {text.language.toUpperCase()}
                </span>
                <span className="ml-2 text-sm text-gray-500">{text.type}</span>
              </div>

              {/* Contributors */}
              {text.contributions.length > 0 && (
                <p className="text-gray-600 mb-2 text-sm">
                  <span className="font-medium">Contributors:</span> {getContributors(text)}
                </p>
              )}

              {/* BDRC ID */}
              {text.bdrc && (
                <p className="text-gray-500 mb-3 text-xs">
                  <span className="font-medium">BDRC:</span> {text.bdrc}
                </p>
              )}

              {/* Alternative Titles */}
              {text.alt_titles.length > 0 && (
                <div className="mb-3">
                  <p className="text-gray-600 text-sm font-medium mb-1">Alternative Titles:</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    {getAltTitles(text).map((altTitle, index) => (
                      <li key={index} className="truncate">• {altTitle}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Date */}
              {text.date && (
                <p className="text-gray-500 text-xs mb-2">
                  <span className="font-medium">Date:</span> {text.date}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TextList;
