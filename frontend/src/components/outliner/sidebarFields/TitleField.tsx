import { useEffect, useRef,  forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Emitter from '@/events';
import type { TextSegment } from '../types';
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
  const titleSearch = formData?.title?.name || '';
  const setTitleSearch = (value: string) => {
    onUpdate('title', { name: value, bdrc_id: formData?.title?.bdrc_id ?? '' });
  };
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleBubbleMenuUpdate = (value: string) => {
      setTitleSearch(value);
      inputRef.current?.focus();
    };

    Emitter.on('bubbleMenu:updateTitle', handleBubbleMenuUpdate);
    return () => {
      Emitter.off('bubbleMenu:updateTitle', handleBubbleMenuUpdate);
    };
  }, [setTitleSearch]);

  return (
    <div>
      <div className="flex items-center gap-2  justify-between" >
      <Label htmlFor="title" className="">Title</Label>
        
        <div className="flex items-center gap-2 mb-2"> 
          <input
          type="checkbox"
          id="reconstructed-title"
          checked={suppliedTitleChecked}
          onChange={(e) => onSuppliedTitleChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
        <Label htmlFor="reconstructed-title" title="Title reconstructed from the text / title not clear" className="text-sm text-gray-500 font-normal cursor-pointer">
        reconstructed
        </Label>
          </div>
      </div>
      <Input
        ref={inputRef}
        id="title"
        value={titleSearch}
        onChange={(e) => setTitleSearch(e.target.value)}
        placeholder={suppliedTitleChecked ? 'Title reconstructed by the annotator' : 'Enter title'}
        className="w-full"
        disabled={disabled}
      />
      
    </div>
  );
});

TitleField.displayName = 'TitleField';
