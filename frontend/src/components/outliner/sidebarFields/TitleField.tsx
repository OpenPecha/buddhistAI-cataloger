import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FormDataType, Title, Author } from '../AnnotationSidebar';

interface TitleFieldProps {
  formData: FormDataType;
  onUpdate: (field: 'title' | 'author', value: Title | Author) => void;
  suppliedTitleChecked: boolean;
  onSuppliedTitleChange: (checked: boolean) => void;
  disabled?: boolean;
}

export interface TitleFieldRef {
  setValueWithoutUpdate: (value: string) => void;
  getValue: () => string;
}


export const TitleField = forwardRef<TitleFieldRef, TitleFieldProps>(({
  formData,
  onUpdate,
  suppliedTitleChecked,
  onSuppliedTitleChange,
  disabled = false,
}, ref) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Allow parent to set/get title value programmatically
  useImperativeHandle(ref, () => ({
    setValueWithoutUpdate: (value: string) => {
      if (inputRef.current) {
        inputRef.current.value = value;
      }
    },
    getValue: () => {
      return inputRef.current?.value || '';
    }
  }));

  const titleSearch = formData?.title?.name || '';

  const setTitleSearch = (value: string) => {
    onUpdate('title', { name: value, bdrc_id: formData?.title?.bdrc_id ?? '' });
  };

  return (
    <div>
      <div className="flex items-center gap-2 justify-between">
        <Label htmlFor="title" className="">{t('outliner.titleField.label')}</Label>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="reconstructed-title"
            checked={suppliedTitleChecked}
            onChange={(e) => onSuppliedTitleChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <Label 
            htmlFor="reconstructed-title" 
            title={t('outliner.titleField.reconstructedHint')}
            className="text-sm text-gray-500 font-normal cursor-pointer"
          >
            {t('outliner.titleField.reconstructedCheckbox')}
          </Label>
        </div>
      </div>
      <Input
        ref={inputRef}
        id="title"
        value={titleSearch}
        onChange={(e) => setTitleSearch(e.target.value)}
        placeholder={suppliedTitleChecked ? t('outliner.titleField.placeholderReconstructed') : t('outliner.titleField.placeholder')}
        className="w-full"
        disabled={disabled}
      />
    </div>
  );
});
