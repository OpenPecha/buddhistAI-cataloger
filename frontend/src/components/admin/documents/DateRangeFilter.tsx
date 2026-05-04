import  { useMemo, useState } from 'react'
import { getDefaultDateRange } from './utils';
import { Input } from '@/components/ui/input';

export default function DateRangeFilter({onUpdateStartDate, onUpdateEndDate}: {onUpdateStartDate: (startDate: string) => void, onUpdateEndDate: (endDate: string) => void}) {
    const defaultRange = useMemo(() => getDefaultDateRange(), []);
    const [startDate, setStartDate] = useState( defaultRange.start);
    const [endDate, setEndDate] = useState(defaultRange.end);

  const inputclass="border w-fit border-gray-300 px-2.5 py-1.5 text-sm bg-white"
  return <>
        <Input
          id="start-date"
          type="date"
          value={startDate}
          onChange={(e) => {
            onUpdateStartDate(e.target.value);
            setStartDate(e.target.value);
          }}
          className={inputclass}
        />
        <span className="text-gray-400 text-sm">–</span>
        <Input
          id="end-date"
          type="date"
          value={endDate}
          onChange={(e) => {
            onUpdateEndDate(e.target.value);
            setEndDate(e.target.value);
          }}
          className={inputclass}
        />
    </>
}