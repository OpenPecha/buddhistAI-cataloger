import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useBdrcSearch } from '../hooks/uesBDRC';
import { MultilevelCategorySelector } from './CategoryList';

interface PublishFormProps {
  onSubmit: (metadata: PublishMetadata) => void;
  targetType: 'translation' | 'commentary' | null;
  isLoading?: boolean;
}

export interface PublishMetadata {
  title: string;
  language: string;
  author: {
    person_bdrc_id: string;
  };
  category_id: string;
  copyright: string;
}

const PublishForm: React.FC<PublishFormProps> = ({
  onSubmit,
  targetType,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<PublishMetadata>({
    title: '',
    language: 'en',
    author: {
      person_bdrc_id: '',
    },
    category_id: '',
    copyright: 'public',
  });

  const [errors, setErrors] = useState<Partial<PublishMetadata & { author_person_bdrc_id: string }>>({});
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<Array<{ id: string; title: string; parentId: string | null }>>([]);
  
  // BDRC Person search state
  const [authorSearchQuery, setAuthorSearchQuery] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState<{ bdrc_id: string; name: string } | null>(null);
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  
  // BDRC Title search state
  const [titleSearchQuery, setTitleSearchQuery] = useState(formData.title);
  const [selectedTitle, setSelectedTitle] = useState<{ instanceId: string; prefLabel: string } | null>(null);
  const [showTitleDropdown, setShowTitleDropdown] = useState(false);
  
  // BDRC search hooks
  const { results: authorResults, isLoading: isLoadingAuthors } = useBdrcSearch(authorSearchQuery, "Person", 300);
  const { results: titleResults, isLoading: isLoadingTitles } = useBdrcSearch(titleSearchQuery, "Instance", 300);


  // Handle category selection
  const handleCategorySelect = (categoryId: string, path: Array<{ id: string; title: string; parentId: string | null }>) => {
    setFormData(prev => ({
      ...prev,
      category_id: categoryId
    }));
    setSelectedCategoryPath(path);
    
    // Clear category error
    if (errors.category_id) {
      setErrors(prev => ({
        ...prev,
        category_id: undefined
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<PublishMetadata & { author_person_bdrc_id: string }> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.language.trim()) {
      newErrors.language = 'Language is required';
    }

    if (!formData.author.person_bdrc_id.trim()) {
      newErrors.author_person_bdrc_id = 'Author is required';
    }

    if (!formData.category_id.trim()) {
      newErrors.category_id = 'Category ID is required';
    }

    if (!formData.copyright.trim()) {
      newErrors.copyright = 'Copyright is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field: keyof PublishMetadata | 'author_person_bdrc_id', value: string) => {
    if (field === 'author_person_bdrc_id') {
      setFormData(prev => ({
        ...prev,
        author: { person_bdrc_id: value }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  // Handle author selection from BDRC search
  const handleAuthorSelect = (author: { bdrc_id?: string; name?: string }) => {
    if (author.bdrc_id && author.name) {
      setSelectedAuthor({ bdrc_id: author.bdrc_id, name: author.name });
      setFormData(prev => ({
        ...prev,
        author: { person_bdrc_id: author.bdrc_id! }
      }));
      setAuthorSearchQuery(author.name);
      setShowAuthorDropdown(false);
      
      // Clear error
      if (errors.author_person_bdrc_id) {
        setErrors(prev => ({
          ...prev,
          author_person_bdrc_id: undefined
        }));
      }
    }
  };

  // Handle author search input change
  const handleAuthorSearchChange = (value: string) => {
    setAuthorSearchQuery(value);
    setShowAuthorDropdown(value.length > 0);
    
    // Clear selection if user is typing
    if (selectedAuthor && value !== selectedAuthor.name) {
      setSelectedAuthor(null);
      setFormData(prev => ({
        ...prev,
        author: { person_bdrc_id: '' }
      }));
    }
  };

  // Handle title selection from BDRC search
  const handleTitleSelect = (title: { instanceId?: string; prefLabel?: string }) => {
    if (title.instanceId && title.prefLabel) {
      setSelectedTitle({ instanceId: title.instanceId, prefLabel: title.prefLabel });
      setFormData(prev => ({
        ...prev,
        title: title.prefLabel!
      }));
      setTitleSearchQuery(title.prefLabel);
      setShowTitleDropdown(false);
      
      // Clear error
      if (errors.title) {
        setErrors(prev => ({
          ...prev,
          title: undefined
        }));
      }
    }
  };

  // Handle title search input change
  const handleTitleSearchChange = (value: string) => {
    setTitleSearchQuery(value);
    setFormData(prev => ({
      ...prev,
      title: value
    }));
    setShowTitleDropdown(value.length > 0);
    
    // Clear selection if user is typing and it doesn't match selected title
    if (selectedTitle && value !== selectedTitle.prefLabel) {
      setSelectedTitle(null);
    }
    
    // Clear error when user starts typing
    if (errors.title) {
      setErrors(prev => ({
        ...prev,
        title: undefined
      }));
    }
  };


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">
          {targetType === 'translation' ? 'Translation' : 'Commentary'}
        </h3>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title with BDRC Search */}
          <div className="relative">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <div className="relative">
              <input
                type="text"
                id="title"
                value={titleSearchQuery}
                onChange={(e) => handleTitleSearchChange(e.target.value)}
                onFocus={() => setShowTitleDropdown(titleSearchQuery.length > 0)}
                disabled={isLoading}
                className={`w-full px-3 py-2 pr-10 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                  errors.title ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                }`}
                placeholder="Search for title or enter manually..."
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                {isLoadingTitles ? (
                  <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <Search className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
            
            {/* Search Results Dropdown */}
            {showTitleDropdown && titleResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {titleResults.map((title, index) => (
                  <button
                    key={title.instanceId || index}
                    type="button"
                    onClick={() => handleTitleSelect(title)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none text-sm border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{title.prefLabel}</div>
                    {title.instanceId && (
                      <div className="text-xs text-gray-500">ID: {title.instanceId}</div>
                    )}
                    {title.creator && (
                      <div className="text-xs text-gray-500">Creator: {title.creator}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {/* Selected Title Display */}
            {selectedTitle && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                <div className="text-sm text-green-800">
                  <span className="font-medium">Selected:</span> {selectedTitle.prefLabel}
                </div>
                <div className="text-xs text-green-600">BDRC ID: {selectedTitle.instanceId}</div>
              </div>
            )}
            
            {errors.title && (
              <p className="mt-1 text-xs text-red-600">{errors.title}</p>
            )}
          </div>

          {/* Language */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
              Language *
            </label>
            <select
              id="language"
              value={formData.language}
              onChange={(e) => handleInputChange('language', e.target.value)}
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.language ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
              }`}
            >
              <option value="en">English</option>
              <option value="bo">Tibetan</option>
              <option value="zh">Chinese</option>
              <option value="sa">Sanskrit</option>
              <option value="hi">Hindi</option>
              <option value="ne">Nepali</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="es">Spanish</option>
              <option value="it">Italian</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
            </select>
            {errors.language && (
              <p className="mt-1 text-xs text-red-600">{errors.language}</p>
            )}
          </div>

          {/* Author Search */}
          <div className="relative">
            <label htmlFor="author_search" className="block text-sm font-medium text-gray-700 mb-1">
              Author *
            </label>
            <div className="relative">
              <input
                type="text"
                id="author_search"
                value={authorSearchQuery}
                onChange={(e) => handleAuthorSearchChange(e.target.value)}
                onFocus={() => setShowAuthorDropdown(authorSearchQuery.length > 0)}
                disabled={isLoading}
                className={`w-full px-3 py-2 pr-10 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                  errors.author_person_bdrc_id ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                }`}
                placeholder="Search for author..."
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                {isLoadingAuthors ? (
                  <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <Search className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
            
            {/* Search Results Dropdown */}
            {showAuthorDropdown && authorResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {authorResults.map((author, index) => (
                  <button
                    key={author.bdrc_id || index}
                    type="button"
                    onClick={() => handleAuthorSelect(author)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none text-sm border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{author.name}</div>
                    {author.bdrc_id && (
                      <div className="text-xs text-gray-500">ID: {author.bdrc_id}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {/* Selected Author Display */}
            {selectedAuthor && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                <div className="text-sm text-green-800">
                  <span className="font-medium">Selected:</span> {selectedAuthor.name}
                </div>
                <div className="text-xs text-green-600">BDRC ID: {selectedAuthor.bdrc_id}</div>
              </div>
            )}
            
            {errors.author_person_bdrc_id && (
              <p className="mt-1 text-xs text-red-600">{errors.author_person_bdrc_id}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <MultilevelCategorySelector
              onCategorySelect={handleCategorySelect}
              error={!!errors.category_id}
            />
            {errors.category_id && (
              <p className="mt-1 text-xs text-red-600">{errors.category_id}</p>
            )}
            {/* Show selected category path */}
            {selectedCategoryPath.length > 0 && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-sm text-blue-800">
                  <span className="font-medium">Selected:</span> {selectedCategoryPath.map(cat => cat.title).join(' > ')}
                </div>
              </div>
            )}
          </div>

          {/* Copyright */}
          <div>
            <label htmlFor="copyright" className="block text-sm font-medium text-gray-700 mb-1">
              Copyright *
            </label>
            <select
              id="copyright"
              value={formData.copyright}
              onChange={(e) => handleInputChange('copyright', e.target.value)}
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.copyright ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
              }`}
            >
              <option value="public">Public</option>
              <option value="copyrighted">Copyrighted</option>
            </select>
            {errors.copyright && (
              <p className="mt-1 text-xs text-red-600">{errors.copyright}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{isLoading ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </form>
    </div>
  );
};

export default PublishForm;
