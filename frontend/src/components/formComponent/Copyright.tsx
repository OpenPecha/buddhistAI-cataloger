import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from '../ui/label';
import { useEffect } from 'react';
import type { LicenseType } from '@/types/text';

interface CopyrightProps {
 readonly copyright: string;
 readonly setCopyright: (copyright: string) => void;
  readonly license: LicenseType;
 readonly setLicense: (license: LicenseType) => void;
 readonly copyrightLabelKey?: string;
 readonly  licenseLabelKey?: string;
 readonly required?: boolean;
 readonly className?: string;
}

function Copyright({
  copyright,
  setCopyright,
  license,
  setLicense,
  copyrightLabelKey = "textForm.copyright",
  licenseLabelKey = "textForm.license",
  required = false,
  className = "",
}: CopyrightProps) {
  const { t } = useTranslation();

    // Auto-set license when copyright category changes (slugs match API LicenseType)
    useEffect(() => {
      if (copyright === "Unknown") {
        setLicense("unknown");
      } else if (copyright === "Public domain") {
        setLicense("public");
      } else if (copyright === "In copyright") {
        setLicense("copyrighted");
      }
    }, [copyright, setLicense]);

  const isLicenseDisabled = copyright === "Unknown";

  return (
    <div className={className}>
      {/* Copyright Field */}
      <div>
        <Label htmlFor="copyright"
        className="mb-2"
        >
          {t(copyrightLabelKey)} {required && <span className="text-red-500">*</span>}
        </Label>
        <Select name="copyright" value={copyright} onValueChange={setCopyright}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("textForm.copyrightUnknown")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Unknown">{t("textForm.copyrightUnknown")}</SelectItem>
            <SelectItem value="In copyright">{t("textForm.copyrightInCopyright")}</SelectItem>
            <SelectItem value="Public domain">{t("textForm.copyrightPublicDomain")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* License Field */}
      <div className="mt-4">
        <Label htmlFor="license"
        className="mb-2"
        >

          {t(licenseLabelKey)} {required && <span className="text-red-500">*</span>}
        </Label>
        <Select 
        name="license"
          value={license} 
          onValueChange={(v) => setLicense(v as LicenseType)}
        >
          <SelectTrigger 
            className={`w-full ${isLicenseDisabled ? "bg-gray-100 cursor-not-allowed opacity-60" : ""}`}
            disabled={isLicenseDisabled}
          >
            <SelectValue placeholder={t("textForm.licenseUnknown")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">{t("textForm.licensePublic")}</SelectItem>
            <SelectItem value="cc0">{t("textForm.licenseCC0")}</SelectItem>
            <SelectItem value="cc-by">{t("textForm.licenseCCBY")}</SelectItem>
            <SelectItem value="cc-by-sa">{t("textForm.licenseCCBYSA")}</SelectItem>
            <SelectItem value="cc-by-nd">{t("textForm.licenseCCBYND")}</SelectItem>
            <SelectItem value="cc-by-nc">{t("textForm.licenseCCBYNC")}</SelectItem>
            <SelectItem value="cc-by-nc-sa">{t("textForm.licenseCCBYNCSA")}</SelectItem>
            <SelectItem value="cc-by-nc-nd">{t("textForm.licenseCCBYNCND")}</SelectItem>
            <SelectItem value="copyrighted">{t("textForm.licenseUnderCopyright")}</SelectItem>
            <SelectItem value="unknown">{t("textForm.licenseUnknown")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default Copyright;

