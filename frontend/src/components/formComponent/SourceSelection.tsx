import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"



function SourceSelection({ source, setSource }: { source: string, setSource: (source: string) => void }) {
  const { t } = useTranslation();

  const sourceOptions = [
    { value: 'bdrc.io', label: 'bdrc.io' },
    { value: 'openpecha.org', label: 'openpecha.org' },
    {value:'lotsawahouse.org', label: 'lotsawahouse.org'},
    { value: 'unknown', label: 'unknown' },
  ]

  return (
    <Select value={source} onValueChange={setSource}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t("instance.sourcePlaceholder")} />
      </SelectTrigger>
      <SelectContent>
        {sourceOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default SourceSelection
