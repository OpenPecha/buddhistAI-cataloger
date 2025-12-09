import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from '../ui/label';

interface CopyrightProps {
  copyright: string;
  setCopyright: (copyright: string) => void;
  license: string;
  setLicense: (license: string) => void;
  copyrightLabelKey?: string;
  licenseLabelKey?: string;
  required?: boolean;
  className?: string;
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

  const isLicenseDisabled = copyright === "Unknown" || copyright === "Public domain";

  return (
    <div className={className}>
      {/* Copyright Field */}
      <div>
        <Label htmlFor="copyright">
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
        <Label htmlFor="license">
          {t(licenseLabelKey)} {required && <span className="text-red-500">*</span>}
        </Label>
        <Select 
        name="license"
          value={license} 
          onValueChange={setLicense}
        >
          <SelectTrigger 
            className={`w-full ${isLicenseDisabled ? "bg-gray-100 cursor-not-allowed opacity-60" : ""}`}
            disabled={isLicenseDisabled}
          >
            <SelectValue placeholder={t("textForm.licenseUnknown")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unknown">{t("textForm.licenseUnknown")}</SelectItem>
            <SelectItem value="CC0">{t("textForm.licenseCC0")}</SelectItem>
            <SelectItem value="Public Domain Mark">{t("textForm.licensePublicDomainMark")}</SelectItem>
            <SelectItem value="CC BY">{t("textForm.licenseCCBY")}</SelectItem>
            <SelectItem value="CC BY-SA">{t("textForm.licenseCCBYSA")}</SelectItem>
            <SelectItem value="CC BY-ND">{t("textForm.licenseCCBYND")}</SelectItem>
            <SelectItem value="CC BY-NC">{t("textForm.licenseCCBYNC")}</SelectItem>
            <SelectItem value="CC BY-NC-SA">{t("textForm.licenseCCBYNCSA")}</SelectItem>
            <SelectItem value="CC BY-NC-ND">{t("textForm.licenseCCBYNCND")}</SelectItem>
            <SelectItem value="under copyright">{t("textForm.licenseUnderCopyright")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default Copyright;

