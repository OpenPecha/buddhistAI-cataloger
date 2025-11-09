import { useBibliography } from '@/contexts/BibliographyContext';
import { X, FileText, BookOpen, User, Scroll } from 'lucide-react';

const TYPE_ICONS = {
  title: <FileText className="h-4 w-4" />,
  colophon: <Scroll className="h-4 w-4" />,
  incipit_title: <BookOpen className="h-4 w-4" />,
  person: <User className="h-4 w-4" />,
  author: <User className="h-4 w-4" />,
  translator: <User className="h-4 w-4" />,
  custom: <FileText className="h-4 w-4" />,
};

const TYPE_COLORS = {
  title: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  colophon: 'bg-green-100 text-green-800 border-green-200',
  incipit_title: 'bg-blue-100 text-blue-800 border-blue-200',
  person: 'bg-orange-100 text-orange-800 border-orange-200',
  author: 'bg-purple-100 text-purple-800 border-purple-200',
  translator: 'bg-pink-100 text-pink-800 border-pink-200',
  custom: 'bg-gray-100 text-gray-800 border-gray-200',
};

const TYPE_LABELS = {
  title: 'Title',
  colophon: 'Colophon Text',
  incipit_title: 'Incipit Title',
  person: 'Person',
  author: 'Author',
  translator: 'Translator',
  custom: 'Custom',
};

interface BibliographyAnnotationsListProps {
  className?: string;
}

export const BibliographyAnnotationsList: React.FC<BibliographyAnnotationsListProps> = ({
  className = '',
}) => {
  const { annotations, removeAnnotation, clearAnnotations } = useBibliography();

  if (annotations.length === 0) {
    return (
      <div className={`text-center py-12 text-gray-500 ${className}`}>
        <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
        <h3 className="text-lg font-medium text-gray-700 mb-2">No Bibliography Annotations</h3>
        <p className="text-sm mb-1">Select text in the Content tab to create annotations</p>
        <p className="text-xs text-gray-400">Choose from Title, Colophon, Incipit, or Person types</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6 p-4 border-b border-gray-200">
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            Bibliography Annotations
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {annotations.length} annotation{annotations.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button
          onClick={clearAnnotations}
          className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors border border-red-200"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {annotations.map((annotation) => (
          <div
            key={annotation.id}
            className={`
              flex items-start gap-3 p-3 rounded-lg border
              ${TYPE_COLORS[annotation.type]}
              hover:shadow-md transition-shadow
            `}
          >
            <div className="flex-shrink-0 mt-0.5">
              {TYPE_ICONS[annotation.type]}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">
                  {TYPE_LABELS[annotation.type]}
                </span>
                <span className="text-xs opacity-70">
                  [{annotation.span.start}-{annotation.span.end}]
                </span>
              </div>
              
              <div className="text-sm break-words">
                "{annotation.text}"
              </div>
              
              <div className="text-xs opacity-70 mt-1">
                Added {new Date(annotation.timestamp).toLocaleTimeString()}
              </div>
            </div>
            
            <button
              onClick={() => removeAnnotation(annotation.id)}
              className="flex-shrink-0 p-1 hover:bg-red-100 rounded transition-colors"
              title="Remove annotation"
            >
              <X className="h-4 w-4 text-red-600" />
            </button>
          </div>
        ))}
      </div>

   
    </div>
  );
};
