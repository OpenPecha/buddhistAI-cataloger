import React from 'react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  className?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isVisible, 
  message = "Loading...", 
  className = "" 
}) => {
  if (!isVisible) return null;

  // Use fixed positioning if className includes "fixed", otherwise use absolute
  const positionClass = className.includes('fixed') ? 'fixed' : 'absolute';

  return (
    <div className={`${positionClass} inset-0 bg-black/50 bg-opacity-90 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4">
        <div className="flex flex-col items-center space-y-4">
          {/* Spinner */}
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
          
          {/* Message */}
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900 mb-2">{message}</p>
            <div className="flex items-center justify-center space-x-1 mt-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
