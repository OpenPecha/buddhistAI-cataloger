import React, { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom';
import { getDefaultDateRange } from './utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DateRangeFilter() {
    const [searchParams,setSearchParams] = useSearchParams();
    const defaultRange = useMemo(() => getDefaultDateRange(), []);

    const startDate = searchParams.get('startDate') || defaultRange.start;
    const endDate = searchParams.get('endDate') || defaultRange.end;
    function setStartDate(date: string) {
        setSearchParams(params => {
          params.set('startDate', date);
          return params;
        });
      }
      function setEndDate(date: string) {
        setSearchParams(params => {
        params.set('endDate', date);
        return params;
      });
    }
  const inputclass="border w-fit border-gray-300 px-2.5 py-1.5 text-sm bg-white"
  return <>
        <Input
          id="start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={inputclass}
        />
        <span className="text-gray-400 text-sm">–</span>
        <Input
          id="end-date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className={inputclass}
        />
    </>
}