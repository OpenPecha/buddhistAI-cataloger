import React, { useState, useEffect, useRef } from 'react'
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { useLanguage } from '@/hooks/useEnum';
import type { Title as TitleType } from '@/types/text';
import { t } from 'i18next';
import { Plus, X } from 'lucide-react';
import { detectLanguage } from '@/utils/languageDetection';
import { useDebouncedCallback } from '@tanstack/react-pacer';
type AlternativeTitleProps = {
  readonly altTitles : TitleType[][];
  readonly setAltTitles: (altTitles: TitleType[][]) => void;
  readonly titles: TitleType[];
}

function AlternativeTitles({altTitles ,setAltTitles, titles = []}: AlternativeTitleProps) {
    const [formAltTitles,setFormAltTitles] = useState<TitleType[][]>(altTitles);
    const prevAltTitlesRef = useRef<TitleType[][]>(altTitles);
    const isInternalUpdateRef = useRef(false);
 

    const updateAltTitlesDebounced = useDebouncedCallback((data) => {
        setAltTitles(data);
      }, {
        wait: 1000 // Wait 1000ms between executions
      });

    // Sync formAltTitles with altTitles prop only when it changes externally
    useEffect(() => {
        // Check if altTitles changed externally (not from our own updates)
        if (!isInternalUpdateRef.current && JSON.stringify(prevAltTitlesRef.current) !== JSON.stringify(altTitles)) {
            isInternalUpdateRef.current = false; // Mark as external update before setting state
            setFormAltTitles(altTitles);
        }
        prevAltTitlesRef.current = altTitles;
        isInternalUpdateRef.current = false;
    }, [altTitles]);

    // Call debounced update whenever formAltTitles changes (but not when syncing from external prop)
    useEffect(() => {
        // Only call debounced update if this is an internal change
        if (isInternalUpdateRef.current) {
            updateAltTitlesDebounced(formAltTitles);
        }
    }, [formAltTitles, updateAltTitlesDebounced]);

    // Helper function to update local state (debounced callback will update parent)
    const updateFormAltTitles = (newTitles: TitleType[][]) => {
        isInternalUpdateRef.current = true;
        setFormAltTitles(newTitles);
    };

    function addAlternativeTitle() {
        updateFormAltTitles([...formAltTitles, [{ language: "", value: "" }]]);
    }
    return (
    <div>
    <div className="flex items-center justify-between mb-2">
      <Label htmlFor="alternativeTitle" className="mb-2">
        {t("textForm.alternativeTitle")}
      </Label>
      <Button
        type="button"
        onClick={addAlternativeTitle}
        variant="outline"
        size="sm"
        className="flex items-center gap-1"
      >
        <Plus className="h-4 w-4" />
        {t("textForm.addAlternativeTitle")}
      </Button>
    </div>

    {!!formAltTitles?.length && formAltTitles.map((titleGroup, groupIndex) => (
     <AlternativeTitle 
       formAltTitles={formAltTitles} 
       setFormAltTitles={updateFormAltTitles} 
       titleGroup={titleGroup} 
       groupIndex={groupIndex} 
       titles={titles}
       key={groupIndex+"altTitle"} 
     />
    ))}
  </div>
  )
}



type AlternativeTitleComponentProps = {
  readonly formAltTitles: TitleType[][];
  readonly setFormAltTitles: (formAltTitles: TitleType[][]) => void;
  readonly titleGroup: TitleType[];
  readonly groupIndex: number;
  readonly titles: TitleType[];
}


function AlternativeTitle({ formAltTitles, setFormAltTitles, titleGroup, groupIndex, titles}: AlternativeTitleComponentProps) {

    function removeAlternativeTitle(groupIndexToRemove: number) {
        const updatedTitles = formAltTitles.filter((_, i: number) => i !== groupIndexToRemove);
        setFormAltTitles(updatedTitles);
    }

    function addLanguageToGroup() {
        const updated = [...formAltTitles];
        updated[groupIndex] = [...updated[groupIndex], { language: "", value: "" }];
        setFormAltTitles(updated);
    }

    return (
        <div
        key={groupIndex}
        className="border rounded-lg p-4 bg-purple-50 mb-3"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {t("textForm.alternativeTitle")} {groupIndex + 1}
          </span>
          <Button
            type="button"
            onClick={() => removeAlternativeTitle(groupIndex)}
            variant="outline"
            size="sm"
            className="text-red-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {titleGroup.map((title, langIndex) => (
        <Eachtitle 
          formAltTitles={formAltTitles} 
          groupIndex={groupIndex} 
          setFormAltTitles={setFormAltTitles} 
          title={title} 
          langIndex={langIndex} 
          titles={titles}
          key={langIndex+"altTitle"} 
        />
        ))}

        <Button
          type="button"
          onClick={addLanguageToGroup}
          variant="outline"
          size="sm"
          className="mt-2 flex items-center gap-1 text-xs"
        >
          <Plus className="h-3 w-3" />
          {t("textForm.addLanguage")}
        </Button>
      </div>
    )
}


type EachtitleProps = {
  readonly formAltTitles: TitleType[][];
  readonly setFormAltTitles: (formAltTitles: TitleType[][]) => void;
  readonly title: TitleType;
  readonly langIndex: number;
  readonly groupIndex: number;
  readonly titles: TitleType[];
}
function Eachtitle({formAltTitles, setFormAltTitles, title, langIndex, groupIndex, titles}: EachtitleProps) {
    
    const {data: LANGUAGE_OPTIONS} = useLanguage();
    
    function updateAlternativeTitle(e: React.ChangeEvent<HTMLSelectElement>,langIndex: number) {
        const selectedLang = e.target.value;

        // Check if this language already exists in the main title
        const existsInMainTitle = titles.some(t => t.language === selectedLang);
        
        // Check if this language already exists in another entry within the same group
        const existingIndex = formAltTitles[groupIndex].findIndex(
          (t, i) => i !== langIndex && t.language === selectedLang
        );
        
        if (existingIndex !== -1 && selectedLang && !existsInMainTitle) {
          // Language exists in another entry within the group (and not in main title) - merge/overwrite
          const updated = [...formAltTitles];
          updated[groupIndex] = updated[groupIndex].filter((_, i) => i !== existingIndex);
          const adjustedLangIndex = langIndex > existingIndex ? langIndex - 1 : langIndex;
          updated[groupIndex][adjustedLangIndex].language = selectedLang;
          setFormAltTitles(updated);
        } else {
          // No conflict within group, or language exists in main title (which is allowed) - update normally
          const updated = [...formAltTitles];
          updated[groupIndex][langIndex].language = selectedLang;
          setFormAltTitles(updated);
        }
      }
function closeAlternativeTitle() {
    const updated = [...formAltTitles];
    updated[groupIndex] = updated[groupIndex].filter((_, i) => i !== langIndex);
    setFormAltTitles(updated);
  }
    return (
        <div key={langIndex} className="flex gap-2 items-start mb-2">
        <select
          value={title.language}
          onChange={(e) => updateAlternativeTitle(e,langIndex)}
          className="w-20 sm:w-32 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
        >
          <option value="">{t("textForm.lang")}</option>
          {LANGUAGE_OPTIONS?.map((lang: { code: string; name: string }) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={title.value}
          onChange={(e) => {
            const updated = [...formAltTitles];
            updated[groupIndex][langIndex].value = e.target.value;
            
            // Auto-detect language if not already set
            if (!updated[groupIndex][langIndex].language && e.target.value.trim()) {
              const detectedLang = detectLanguage(e.target.value);
              if (detectedLang) {
                updated[groupIndex][langIndex].language = detectedLang;
              }
            }
            
            setFormAltTitles(updated);
          }}
          className="flex-1 min-w-0 px-2 sm:px-3 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          placeholder={t("textForm.enterAlternativeTitle")}
        />
          <Button
            type="button"
            onClick={closeAlternativeTitle}
            variant="outline"
            size="sm"
            className="text-red-600 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
      </div>
    )
}

export default AlternativeTitles
