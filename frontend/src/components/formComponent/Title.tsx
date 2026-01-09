import { Label } from '../ui/label';
import {t} from 'i18next';
import { Button } from '../ui/button';
import { Loader2, Plus, X } from 'lucide-react';
import { detectLanguage } from '@/utils/languageDetection';
import { useLanguage } from '@/hooks/useEnum';
import type { Title as TitleType } from '@/types/text';
import { useState } from 'react';
import { useDebouncedCallback } from '@tanstack/react-pacer';


interface LanguageOption {
  code: string;
  name: string;
}


type TitleProps = {
 readonly setTitles: (titles: TitleType[]) => void;
 readonly errors: string | undefined;
}

function Title({setTitles, errors}: TitleProps) {
  const [formTitle,setFormTitle] = useState<TitleType[]>([]);
  const {data: LANGUAGE_OPTIONS,isLoading: isLoadingLanguageOptions} = useLanguage();

  const updateTitlesDebounced = useDebouncedCallback((data) => {
    setTitles(data);
  }, {
    wait: 1000 // Wait 1000ms between executions
  });

  function addTitle() {
    setFormTitle([...formTitle, { language: "", value: "" }])
    updateTitlesDebounced(formTitle);
  }
  function removeTitle(index: number) {
    setFormTitle(formTitle.filter((_, i) => i !== index))
    updateTitlesDebounced(formTitle);

  }
  function updateTitles(e: React.ChangeEvent<HTMLSelectElement>,index: number) {
        const selectedLang = e.target.value;
        
        // Check if this language already exists in another title entry
        const existingIndex = formTitle.findIndex(
          (t, i) => i !== index && t.language === selectedLang
        );
        
        if (existingIndex !== -1 && selectedLang) {
          // Language exists in another entry - merge/overwrite
          setFormTitle(prev => {
            
          const updatedTitles = prev.filter((_, i) => i !== existingIndex);
          updatedTitles[index === existingIndex ? index : (index > existingIndex ? index - 1 : index)].language = selectedLang;
    updateTitlesDebounced(updatedTitles);

            return updatedTitles;
        });
        } else {
          // No conflict, just update normally
          const newTitles = [...formTitle];
          newTitles[index].language = selectedLang;
          setFormTitle(prev => {
            updateTitlesDebounced(prev);
            return newTitles;
          });
      }

  }

  


 function updateTitleValue(e: React.ChangeEvent<HTMLInputElement>,index: number) {
        const newTitles = [...formTitle];
        newTitles[index].value = e.target.value;
        
        // Auto-detect language if not already set
        if (!newTitles[index].language && e.target.value.trim()) {
          const detectedLang = detectLanguage(e.target.value);
          if (detectedLang) {
            // Check if this detected language already exists in another title entry
            const existingIndex = formTitle.findIndex(
              (t, i) => i !== index && t.language === detectedLang
            );
            
            if (existingIndex !== -1) {
              // Language exists in another entry - remove the other one
              const updatedTitles = newTitles.filter((_, i) => i !== existingIndex);
              const adjustedIndex = index > existingIndex ? index - 1 : index;
              updatedTitles[adjustedIndex].language = detectedLang;
              setFormTitle(updatedTitles);
              return;
            } else {
              newTitles[index].language = detectedLang;
            }
          }
        }
        
        setFormTitle(newTitles);
        updateTitlesDebounced(newTitles);
        
        // Check if any titles remain with values
      }


  return (
    <div>
     {/* Titles Section */}
     <div className="flex items-center justify-between mb-2">
       <Label
         htmlFor="title"
         className="mb-2"
       >
         {t("textForm.title")} <span className="text-red-500">*</span> ({t("textForm.atLeastOneRequired")})
       </Label>
       <Button
         type="button"
         onClick={addTitle}
         variant="outline"
         size="sm"
         className="flex items-center gap-1"
       >
         <Plus className="h-4 w-4" />
         {t("textForm.addTitle")}
       </Button>
     </div>

     {/* Existing Titles List */}
     {!!formTitle?.length  && (
       <div className="space-y-3 mb-4">
         {formTitle.map((title, index) => (
           <div
             key={index}
             className="flex gap-2 items-start p-3 bg-gray-50 border border-gray-200 rounded-md"
           >
              
             {isLoadingLanguageOptions && (
               <div className="w-20 sm:w-32 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                 <Loader2 className="h-4 w-4 animate-spin" />
               </div>
             )}
             <select
               value={title.language}
               onChange={(e) => updateTitles(e,index)}
               className="w-fit sm:w-32 font-poppins h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
             >
               <option value="">{t("textForm.selectLanguage")}</option>
               {!isLoadingLanguageOptions && !!LANGUAGE_OPTIONS && LANGUAGE_OPTIONS.map((lang: LanguageOption) => (
                 <option key={lang.code} value={lang.code} className="capitalize">
                   {lang.name}
                   </option>
                 ))}
             </select>
             <input
               type="text"
               value={title.value}
               onChange={(e) => updateTitleValue(e,index)}
               className="flex-1  min-w-0 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
               placeholder={t("textForm.enterTitle")}
             />
             <Button
               type="button"
               onClick={() => removeTitle(index)}
               variant="outline"
               size="sm"
               className="text-red-600 hover:text-red-700 flex-shrink-0"
             >
               <X className="h-4 w-4" />
             </Button>
           </div>
         ))}
       </div>
     )}

     {errors && (
       <p className="mt-1 text-sm text-red-600">{errors}</p>
     )}
   </div>
  )
}

export default Title
