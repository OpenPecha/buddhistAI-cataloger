import { useBibliography } from '@/contexts/BibliographyContext';
import { X, FileText, BookOpen, User, Scroll } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TYPE_ICONS = {
  title: <FileText className="h-4 w-4" />,
  alt_title: <FileText className="h-4 w-4" />,
  colophon: <Scroll className="h-4 w-4" />,
  incipit: <BookOpen className="h-4 w-4" />,
  incipit_title: <BookOpen className="h-4 w-4" />,
  alt_incipit: <BookOpen className="h-4 w-4" />,
  person: <User className="h-4 w-4" />,
  author: <User className="h-4 w-4" />,
  translator: <User className="h-4 w-4" />,
  custom: <FileText className="h-4 w-4" />,
};

const TYPE_COLORS = {
  title: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  alt_title: 'bg-purple-100 text-purple-800 border-purple-200',
  colophon: 'bg-green-100 text-green-800 border-green-200',
  incipit: 'bg-blue-100 text-blue-800 border-blue-200',
  incipit_title: 'bg-blue-100 text-blue-800 border-blue-200',
  alt_incipit: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  person: 'bg-orange-100 text-orange-800 border-orange-200',
  author: 'bg-purple-100 text-purple-800 border-purple-200',
  translator: 'bg-pink-100 text-pink-800 border-pink-200',
  custom: 'bg-gray-100 text-gray-800 border-gray-200',
};

interface BibliographyAnnotationsListProps {
  className?: string;
}

export const BibliographyAnnotationsList: React.FC<BibliographyAnnotationsListProps> = ({
  className = '',
}) => {
  const { annotations, removeAnnotation, clearAnnotations } = useBibliography();
  const { t } = useTranslation();

  // Function to get translated label for annotation type
  const getTypeLabel = (type: string): string => {
    const labelMap: Record<string, string> = {
      title: t('bibliography.typeTitle'),
      alt_title: t('selectionMenu.altTitle'),
      colophon: t('bibliography.typeColophon'),
      incipit: t('selectionMenu.incipit'),
      incipit_title: t('bibliography.typeIncipitTitle'),
      alt_incipit: t('selectionMenu.altIncipit'),
      person: t('bibliography.typePerson'),
      author: t('bibliography.typeAuthor'),
      translator: t('bibliography.typeTranslator'),
      custom: t('bibliography.typeCustom'),
    };
    return labelMap[type] || type;
  };

  if (annotations.length === 0) {
    return (
      <div className={`text-center py-12 text-gray-500 ${className}`}>
        <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
        <h3 className="text-lg font-medium text-gray-700 mb-2">{t('bibliography.noAnnotations')}</h3>
        <p className="text-sm mb-1">{t('bibliography.selectTextPrompt')}</p>
        <p className="text-xs text-gray-400">{t('bibliography.typesPrompt')}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6 p-4 border-b border-gray-200">
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            {t('bibliography.title')}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {t('bibliography.annotationCount', { count: annotations.length })}
          </p>
        </div>
        <button
          onClick={clearAnnotations}
          className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors border border-red-200"
        >
          {t('bibliography.clearAll')}
        </button>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {annotations.map((annotation) => (
          <div
            key={annotation.id}
            className={`
              flex items-start gap-3 p-3 rounded-lg border
              ${TYPE_COLORS[annotation.type as keyof typeof TYPE_COLORS]}
              hover:shadow-md transition-shadow
            `}
          >
            <div className="flex-shrink-0 mt-0.5">
              {TYPE_ICONS[annotation.type as keyof typeof TYPE_ICONS]}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">
                  {getTypeLabel(annotation.type)}
                </span>
                <span className="text-xs opacity-70">
                  [{annotation.span.start}-{annotation.span.end}]
                </span>
              </div>
              
              <div className="text-sm break-words">
                "{annotation.text}"
              </div>
              
              <div className="text-xs opacity-70 mt-1">
                {t('bibliography.added')} {new Date(annotation.timestamp).toLocaleTimeString()}
              </div>
            </div>
            
            <button
              onClick={() => removeAnnotation(annotation.id)}
              className="flex-shrink-0 p-1 hover:bg-red-100 rounded transition-colors"
              title={t('bibliography.removeAnnotation')}
            >
              <X className="h-4 w-4 text-red-600" />
            </button>
          </div>
        ))}
      </div>

   
    </div>
  );
};
