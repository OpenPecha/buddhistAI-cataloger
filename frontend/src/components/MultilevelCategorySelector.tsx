import { useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import type { Category } from '@/hooks/useCategories';
import { ChevronRight, Loader2, Check, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CategoryLevel {
  id: string;
  title: string;
  parentId: string | null;
}

interface MultilevelCategorySelectorProps {
  onCategorySelect: (categoryId: string, path: CategoryLevel[]) => void;
  selectedCategoryId?: string;
  error?: boolean;
}

export const MultilevelCategorySelector: React.FC<MultilevelCategorySelectorProps> = ({
  onCategorySelect,
  selectedCategoryId,
}) => {
  const { t } = useTranslation();
  const [navigationPath, setNavigationPath] = useState<CategoryLevel[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{
    category: Category;
    path: CategoryLevel[];
  } | null>(null);

  const { categories, loading, error } = useCategories(currentParentId);

  // Handle category badge click
  const handleCategoryClick = (category: Category) => {
    if (category.has_child) {
      // Navigate into this category
      const newPath = [...navigationPath, {
        id: category.id,
        title: category.title,
        parentId: currentParentId,
      }];
      setNavigationPath(newPath);
      setCurrentParentId(category.id);
    } else {
      // Select this leaf category
      const fullPath = [...navigationPath, {
        id: category.id,
        title: category.title,
        parentId: currentParentId,
      }];
      setSelectedCategory({ category, path: fullPath });
      onCategorySelect(category.id, fullPath);
    }
  };

  // Handle breadcrumb click
  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Go to root
      setNavigationPath([]);
      setCurrentParentId(null);
    } else {
      // Go to specific level
      const newPath = navigationPath.slice(0, index + 1);
      setNavigationPath(newPath);
      setCurrentParentId(newPath[index].id);
    }
  };

  // Reset selection
  const handleReset = () => {
    setSelectedCategory(null);
    setNavigationPath([]);
    setCurrentParentId(null);
    onCategorySelect('', []);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('category.category')} <span className="text-red-500">*</span>
        </label>
        
      

        {/* Breadcrumb Navigation */}
        {navigationPath.length > 0 && (
          <div className="flex items-center gap-1 text-xs flex-wrap  px-3 py-2 rounded-md ">
            <button
              onClick={() => handleBreadcrumbClick(-1)}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900"
            >
              <Home className="h-3 w-3" />
              <span>{t('category.root')}</span>
            </button>
            {navigationPath.map((level, index) => (
              <div key={level.id} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-gray-400" />
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className="px-2 py-1 rounded hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900"
                >
                  {level.title}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Category Badges Grid */}
        <div className={`rounded-md bg-white max-h-[400px] overflow-y-auto p-3 border ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-200'
        }`}>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{t('category.loadingCategories')}</span>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-red-600">
              {t('category.errorLoadingCategories')} {error}
            </div>
          ) : categories.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              {t('category.noCategoriesAvailable')}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const isSelected = selectedCategory?.category.id === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category)}
                    className={`
                      inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                      transition-all duration-200
                      ${isSelected 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                      }
                      ${category.has_child ? 'pr-3' : ''}
                    `}
                  >
                    <span>{category.title}</span>
                    {isSelected && <Check className="h-4 w-4" />}
                    {category.has_child && !isSelected && (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

       
      </div>
    </div>
  );
};

