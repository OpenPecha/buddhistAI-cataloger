import { useTranslation } from 'react-i18next';

function SourceSelection({ source, setSource }: { source: string, setSource: (source: string) => void }) {
  const { t } = useTranslation();

  const sourceOptions = [
    { value: 'bdrc.io', label: 'bdrc.io' },
    { value: 'openpecha.org', label: 'openpecha.org' },
    {value:'lotsawahouse.org', label: 'lotsawahouse.org'},
    { value: 'unknown', label: 'unknown' },
  ]

  return (
    <select
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" className="text-gray-300">{t("instance.sourcePlaceholder")}</option>
              {sourceOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
  )
}

export default SourceSelection
