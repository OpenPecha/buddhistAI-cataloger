import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import type { Person } from "@/types/person";
import type { OpenPechaText ,Title as TitleType} from "@/types/text";
import { MultilevelCategorySelector } from "@/components/MultilevelCategorySelector";
import { useTranslation } from "react-i18next";
import LanguageSelectorForm from "./formComponent/LanguageSelectorForm";
import Copyright from "./formComponent/Copyright";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

import AlternativeTitle from "./formComponent/AlternativeTitle";
import Title from "./formComponent/Title";
import Contributor from "./formComponent/Contributor";
import type { ContributorItem } from "./formComponent/Contributor";
import BDRCWork, { type BDRCWorkRef } from "./formComponent/BDRCWORK";
interface TextCreationFormProps {
  onDataChange?: (textData: any) => void;
  getFormData?: () => any;
  onExistingTextFound?: (text: OpenPechaText) => void;
}

export interface TextCreationFormRef {
  addTitle: (text: string, language?: string) => void;
  addAltTitle: (text: string, language?: string) => void;
  hasTitle: () => boolean;
  setBdrcId: (bdrcId: string, label: string) => void;
  setFormLanguage: (language: string) => void;
  getLanguage: () => string;
  addContributorFromBdrc: (personBdrcId: string, personName: string, role: "translator" | "author") => void;
  initializeForm?: (data: {
    type?: string;
    language?: string;
    date?: string;
    categoryId?: string;
    copyright?: string;
    license?: string;
    bdrc?: string;
    target?: string;
  }) => void;
}






const TextCreationForm = forwardRef<TextCreationFormRef, TextCreationFormProps>(
  ({ onDataChange, onExistingTextFound }, ref) => {
    const { t } = useTranslation();
    // State declarations
    const [selectedType, setSelectedType] = useState<
      "root" | "translation" | ""
    >("root");
    const [titles, setTitles] = useState<TitleType[]>([]);
    const [altTitles, setAltTitles] = useState<TitleType[][]>([]);
    const [language, setLanguage] = useState("");
    const [target, setTarget] = useState("");
    const [date, setDate] = useState(() => {
      // Initialize with today's date in YYYY-MM-DD format
      const today = new Date();
      return today.toISOString().split('T')[0];
    });
    const [bdrc, setBdrc] = useState("");
    const [categoryId, setCategoryId] = useState<string>("");
    const [categoryError, setCategoryError] = useState<boolean>(false);
    const [copyright, setCopyright] = useState<string>("Unknown");
    const [license, setLicense] = useState<string>("Unknown");

    // Contributor management
    const [contributors, setContributors] = useState<ContributorItem[]>([]);

    // Validation errors
    const [errors, setErrors] = useState<Record<string, string>>({});

    // BDRC Work component ref
    const bdrcWorkRef = useRef<BDRCWorkRef>(null);


    // Build form data - can be called on demand
    const buildFormData = useCallback(() => {
      // Validate required fields
      if (!selectedType) {
        throw new Error(t("textForm.typeRequired"));
      }

      if (!language.trim()) {
        throw new Error(t("textForm.languageRequired"));
      }

      // Build title object from titles array (last value wins for duplicate languages)
      const title: Record<string, string> = {};
      titles.forEach((titleEntry) => {
        if (titleEntry.language && titleEntry.value.trim()) {
          title[titleEntry.language] = titleEntry.value.trim();
        }
      });

      if (Object.keys(title).length === 0) {
        throw new Error(t("textForm.titleRequired"));
      }

      if (!categoryId.trim()) {
        setCategoryError(true);
        throw new Error(t("textForm.categoryRequired"));
      } else {
        setCategoryError(false);
      }

      // Build contributions array (only if contributors exist)
      const contributionsArray = contributors?.map((contributor) => {
          // Use bdrc field if available, otherwise fall back to id
          const personBdrcId = contributor.person!.bdrc || contributor.person!.id;
          return {
            person_bdrc_id: personBdrcId,
            role: contributor.role,
          };
        });

      // Build alt_titles array - transform from grouped structure to array of dictionaries
      const altTitlesArray = altTitles
        .map((titleGroup) => {
          const alt: Record<string, string> = {};
          titleGroup.forEach(({ language, value }) => {
            if (language && value.trim()) {
              alt[language] = value.trim();
            }
          });
          return alt;
        })
        .filter((alt) => Object.keys(alt).length > 0);

      // Build final payload
      const textData: any = {
        type: selectedType,
        title,
        language: language.trim(),
        alt_titles: altTitlesArray,
      };

      // Only add contributions if there are any
      if (contributors.length > 0) {
        textData.contributions = contributionsArray;
      }

      // Add target field for translation and commentary types
      if (selectedType === "translation" || selectedType === "commentary") {
        textData.target = target.trim() || "N/A";
      }

      // Add optional fields
      if (date.trim()) textData.date = date.trim();
      if (bdrc.trim()) textData.bdrc = bdrc.trim();
      
      // Add required category
      if (categoryId && categoryId.trim()) {
        textData.category_id = categoryId.trim();
      }

      // Add copyright (optional field)
      if (copyright && copyright.trim()) {
        textData.copyright = copyright.trim();
      }

      // Add license (if copyright is Unknown, send "unknown", otherwise use selected license or default to "CC0")
      if (copyright === "Unknown") {
        textData.license = "unknown";
      } else if (license && license.trim()) {
        textData.license = license.trim();
      } else {
        // If license is empty, send "CC0" as default
        textData.license = "CC0";
      }

      return textData;
    }, [
      selectedType,
      titles,
      altTitles,
      language,
      target,
      contributors,
      date,
      bdrc,
      categoryId,
      copyright,
      license,
      t,
    ]);

    // Expose buildFormData to parent via window object
    useEffect(() => {
      // Store the function reference so parent can call it
      (window as any).__getTextFormData = buildFormData;
    }, [buildFormData]);

    // Call onDataChange when form data changes
    useEffect(() => {
      if (onDataChange) {
        try {
          const data = buildFormData();
          onDataChange(data);
        } catch {
          // Form is not yet valid, don't call onDataChange
          onDataChange(null);
        }
      }
    }, [
      buildFormData,
      onDataChange,
    ]);

    // Expose methods to parent component via ref
    useImperativeHandle(ref, () => ({
      addTitle: (text: string, language?: string) => {
        const langToUse = language || "";
        setTitles((prev) => {
          // Check if there's already a title entry with this language
          const existingIndex = prev.findIndex(
            (title) => title.language === langToUse
          );
          
          if (existingIndex !== -1) {
            // Update existing title
            const updated = [...prev];
            updated[existingIndex].value = text;
            return updated;
          } else {
            // Add new title
            return [...prev, { language: langToUse, value: text }];
          }
        });
      },
      addAltTitle: (text: string, language?: string) => {
        const langToUse = language || "";
        setAltTitles((prev) => {
          // Add to the last group, or create a new group if none exists
          if (prev.length === 0) {
            return [[{ language: langToUse, value: text }]];
          }
          const updated = [...prev];
          const lastGroup = updated[updated.length - 1];
          // Check if language already exists in last group
          const existingIndex = lastGroup.findIndex(
            (t) => t.language === langToUse
          );
          if (existingIndex !== -1) {
            lastGroup[existingIndex].value = text;
          } else {
            lastGroup.push({ language: langToUse, value: text });
          }
          updated[updated.length - 1] = [...lastGroup];
          return updated;
        });
      },
      hasTitle: () => {
        return titles.some((t) => t.value.trim() !== "");
      },
      setBdrcId: (bdrcId: string, label: string) => {
        bdrcWorkRef.current?.setBdrcId(bdrcId, label);
      },
      setFormLanguage: (lang: string) => {
        setLanguage(lang);
      },
      getLanguage: () => {
        return language;
      },
      addContributorFromBdrc: (personBdrcId: string, personName: string, role: "translator" | "author") => {
        // Create a temporary Person object from BDRC data
        const bdrcPerson: Person = {
          id: personBdrcId,
          name: { bo: personName },
          alt_names: [],
          bdrc: personBdrcId,
          wiki: null
        };
        
        // Add contributor directly
        setContributors((prev) => [
          ...prev,
          {
            person: bdrcPerson,
            role: role as "translator" | "author",
          },
        ]);
      },
      initializeForm: (data: {
        type?: string;
        language?: string;
        date?: string;
        categoryId?: string;
        copyright?: string;
        license?: string;
        bdrc?: string;
        target?: string;
      }) => {
        if (data.type) setSelectedType(data.type as any);
        if (data.language) setLanguage(data.language);
        if (data.date) setDate(data.date);
        if (data.categoryId) setCategoryId(data.categoryId);
        if (data.copyright) setCopyright(data.copyright);
        if (data.license) setLicense(data.license);
        if (data.bdrc) {
          bdrcWorkRef.current?.setBdrcId(data.bdrc, data.bdrc);
        }
        if (data.target) setTarget(data.target);
      },
    }), [language, titles, altTitles, contributors]);

    return (
      <div className="space-y-6 text-lg">
        {/* Type and Language */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="hidden">
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("textForm.type")} <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              value={selectedType}
              disabled={true}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <option value="">{t("textForm.selectType")}</option>
              <option value="root">{t("textForm.root")}</option>
              <option value="translation">{t("textForm.translation")}</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type}</p>
            )}
          </div>

          <div>
            <Label
              htmlFor="language"
              className="mb-2"
            >
              {t("textForm.language")} <span className="text-red-500">*</span>
            </Label>
           <LanguageSelectorForm language={language} setLanguage={setLanguage} />
            {errors.language && (
              <p className="mt-1 text-sm text-red-600">{errors.language}</p>
            )}
          </div>
        </div>

        {/* Target field - only for commentary/translation */}
        {selectedType === "translation"&& (
          <div>
            <Label
              htmlFor="target"
              className="mb-2"
            >
              {t("textForm.targetTextId")}
            </Label>
            <Input
              id="target"
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={t("textForm.leaveEmptyNA")}
            />

            {errors.target && (
              <p className="mt-1 text-sm text-red-600">{errors.target}</p>
            )}
          </div>
        )}
        {/* Titles Section */}
        <Title setTitles={setTitles}  errors={errors.titles} />

        {/* Alternative Titles Section */}
         <AlternativeTitle altTitles ={altTitles} setAltTitles={setAltTitles} titles={titles} />

        {/* Contributors Section */}
       <Contributor contributors={contributors} setContributors={setContributors} errors={errors} />

        {/* Optional Fields */}
        <BDRCWork
          ref={bdrcWorkRef}
          bdrc={bdrc}
          onBdrcChange={setBdrc}
          onExistingTextFound={onExistingTextFound}
        />

        {/* Category Selector */}
        <div>
          <MultilevelCategorySelector
            onCategorySelect={(id) => {
              setCategoryId(id);
              if (id.trim()) {
                setCategoryError(false);
              }
            }}
            selectedCategoryId={categoryId}
            error={categoryError}
          />
          {categoryError && (
            <p className="mt-1 text-sm text-red-600">
              {t("textForm.selectCategory")}
            </p>
          )}
        </div>

        {/* Copyright and License Fields */}
        <Copyright
          copyright={copyright}
          setCopyright={setCopyright}
          license={license}
          setLicense={setLicense}
          copyrightLabelKey="textForm.copyright"
          licenseLabelKey="textForm.license"
          required={false}
        />

     
      </div>
    );
  }
);

TextCreationForm.displayName = "TextCreationForm";

export default TextCreationForm;
