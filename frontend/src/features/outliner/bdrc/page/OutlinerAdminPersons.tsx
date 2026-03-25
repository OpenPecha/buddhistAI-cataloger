import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SimplePagination } from '@/components/ui/simple-pagination';
import { useOutlinerUsers } from '@/hooks/useOutlinerUsers';
import type { BdrcOtPersonRow } from '../api/persons';
import { useSearchBDRCPersons } from '../hook/useSearchBDRCPersons';
import { formatDistanceToNow } from 'date-fns';

const TABLE_COL_COUNT = 6;
const PAGE_SIZE = 20;

const URL_KEYS = {
  page: 'page',
  pref_label_bo: 'pref_label_bo',
  modified_by: 'modified_by',
  record_origin: 'record_origin',
  record_status: 'record_status',
} as const;

const ADMIN_SELECT_CLASS =
  'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50';

function asPersonRows(raw: unknown[]): BdrcOtPersonRow[] {
  return raw.filter(
    (r): r is BdrcOtPersonRow =>
      typeof r === 'object' && r !== null && 'id' in r
  );
}


function TitleWithAltLabels({ row }: Readonly<{ row: BdrcOtPersonRow }>) {
  const title = row.pref_label_bo?.trim() || '—';
  const alts = row.alt_label_bo ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="max-w-xs truncate cursor-pointer rounded text-left text-sm text-blue-700 wrap-break-word hover:underline focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {title}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-md p-3">
        <p className="text-muted-foreground mb-2 text-xs font-medium">
          Alternative labels
        </p>
        {alts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No alternative labels.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto text-sm wrap-break-word">
            {alts.map((label, i) => (
              <li key={`alt-${i}-${label.slice(0, 48)}`}>{label}</li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BDRCPersonsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { users: annotators, isLoading: annotatorsLoading } = useOutlinerUsers();

  const page = Math.max(
    1,
    Number.parseInt(searchParams.get(URL_KEYS.page) || '1', 10) || 1
  );
  const modifiedByEmail = searchParams.get(URL_KEYS.modified_by) ?? '';
  const recordOrigin = searchParams.get(URL_KEYS.record_origin) ?? '';
  const recordStatus = searchParams.get(URL_KEYS.record_status) ?? '';

  const [prefLabelBo, setPrefLabelBo] = useState(
    () => searchParams.get(URL_KEYS.pref_label_bo) ?? ''
  );

  const prefInUrl = searchParams.get(URL_KEYS.pref_label_bo) ?? '';
  useEffect(() => {
    setPrefLabelBo(prefInUrl);
  }, [prefInUrl]);

  const [debouncedPrefForUrl, setDebouncedPrefForUrl] = useState(() =>
    (searchParams.get(URL_KEYS.pref_label_bo) ?? '').trim()
  );
  useEffect(() => {
    const t = globalThis.setTimeout(
      () => setDebouncedPrefForUrl(prefLabelBo.trim()),
      600
    );
    return () => globalThis.clearTimeout(t);
  }, [prefLabelBo]);

  useEffect(() => {
    if (debouncedPrefForUrl === prefInUrl) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedPrefForUrl) next.set(URL_KEYS.pref_label_bo, debouncedPrefForUrl);
      else next.delete(URL_KEYS.pref_label_bo);
      next.set(URL_KEYS.page, '1');
      return next;
    });
  }, [debouncedPrefForUrl, prefInUrl, setSearchParams]);

  const patchUrl = useCallback(
    (entries: Record<string, string | null | undefined>, resetPage = true) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, val] of Object.entries(entries)) {
          if (val == null || val === '') next.delete(key);
          else next.set(key, val);
        }
        if (resetPage) next.set(URL_KEYS.page, '1');
        return next;
      });
    },
    [setSearchParams]
  );

  const setPageOnly = useCallback(
    (nextPage: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(URL_KEYS.page, String(Math.max(1, nextPage)));
        return next;
      });
    },
    [setSearchParams]
  );

  const filters = useMemo(
    () => ({
      prefLabelBo,
      modifiedByEmail,
      recordOrigin,
      recordStatus,
      page,
      pageSize: PAGE_SIZE,
    }),
    [prefLabelBo, modifiedByEmail, recordOrigin, recordStatus, page]
  );

  const {
    results: rawResults,
    total,
    offset,
    isLoading,
    isFetching,
    error,
  } = useSearchBDRCPersons(filters, { debounceMs: 600 });
  const results = asPersonRows(rawResults);

  const hasNextPage = offset + results.length < total;
  const hasPrevPage = page > 1;

  const annotatorsWithEmail = useMemo(
    () => annotators.filter((u) => u.email.trim() !== ''),
    [annotators]
  );

  const showOverlay = isFetching && results.length > 0;
  const showInitialSearch = isLoading && results.length === 0;
  let tableBodyContent: ReactNode;
  if (showInitialSearch) {
    tableBodyContent = (
      <TableRow className="hover:bg-transparent">
        <TableCell
          colSpan={TABLE_COL_COUNT}
          className="px-6 py-8 text-center text-sm text-gray-500"
        >
          Loading persons…
        </TableCell>
      </TableRow>
    );
  } else if (results.length === 0) {
    tableBodyContent = (
      <TableRow className="hover:bg-transparent">
        <TableCell
          colSpan={TABLE_COL_COUNT}
          className="px-6 py-8 text-center text-sm text-gray-500"
        >
          No persons match your filters.
        </TableCell>
      </TableRow>
    );
  } else {
    tableBodyContent = results.map((row, index) =>{
        const modifiedAt = row.curation?.modified_at;
        const istDate = modifiedAt ? new Date(modifiedAt) : new Date();

        return <TableRow key={row.id || `row-${index}`}>
        <TableCell className="max-w-xs px-6 py-3 align-top">
          <TitleWithAltLabels row={row} />
        </TableCell>
        
      
        <TableCell className="wrap-break-word px-6 py-3 text-sm text-gray-900">
          {row.curation?.modified_by?.trim() || '—'}
        </TableCell>
        <TableCell className="wrap-break-word px-6 py-3 font-mono text-sm text-gray-900">
          {row.canonical_id != null && row.canonical_id !== ''
            ? row.canonical_id
            : '—'}
        </TableCell>
        <TableCell className="whitespace-nowrap px-6 py-3 text-sm text-gray-900">
          {formatDistanceToNow(istDate, { addSuffix: true })}
        </TableCell>
      </TableRow>
        }
    );
  }

  const totalLabel = total === 1 ? 'person' : 'persons';
  const paginationLabel =
    total > 0
      ? `Page ${page} · ${total.toLocaleString()} ${totalLabel}`
      : `Page ${page}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">BDRC persons</h3>
              <p className="mt-1 text-sm text-gray-600">
                List and filter person records (BEC OT API)
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="bdrc-person-pref-label-bo"
                  className="text-sm font-medium text-gray-700"
                >
                  Preferred label (bo)
                </label>
                <div className="relative w-full min-w-[200px] max-w-xs sm:w-64">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    aria-hidden
                  />
                  <Input
                    id="bdrc-person-pref-label-bo"
                    type="search"
                    placeholder="Search by name…"
                    value={prefLabelBo}
                    onChange={(e) => setPrefLabelBo(e.target.value)}
                    className="h-9 pl-9 text-sm"
                    aria-label="Filter by preferred Tibetan label"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="bdrc-person-modified-by"
                  className="text-sm font-medium text-gray-700"
                >
                  Modified by
                </label>
                <select
                  id="bdrc-person-modified-by"
                  disabled={annotatorsLoading}
                  value={modifiedByEmail}
                  onChange={(e) =>
                    patchUrl({ [URL_KEYS.modified_by]: e.target.value || null })
                  }
                  className={`${ADMIN_SELECT_CLASS} min-w-[200px]`}
                  aria-label="Filter by annotator email"
                >
                  <option value="">Any annotator</option>
                  {annotatorsWithEmail.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.name?.trim() ? `${u.name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="bdrc-person-record-origin"
                  className="text-sm font-medium text-gray-700"
                >
                  Record origin
                </label>
                <select
                  id="bdrc-person-record-origin"
                  value={recordOrigin}
                  onChange={(e) =>
                    patchUrl({ [URL_KEYS.record_origin]: e.target.value || null })
                  }
                  className={ADMIN_SELECT_CLASS}
                  aria-label="Filter by record origin"
                >
                  <option value="">Any origin</option>
                  <option value="local">local</option>
                  <option value="imported">imported</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="bdrc-person-record-status"
                  className="text-sm font-medium text-gray-700"
                >
                  Record status
                </label>
                <select
                  id="bdrc-person-record-status"
                  value={recordStatus}
                  onChange={(e) =>
                    patchUrl({ [URL_KEYS.record_status]: e.target.value || null })
                  }
                  className={ADMIN_SELECT_CLASS}
                  aria-label="Filter by record status"
                >
                  <option value="">Any status</option>
                  <option value="active">active</option>
                  <option value="duplicate">duplicate</option>
                  <option value="withdrawn">withdrawn</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="shrink-0 pb-2 text-sm text-red-600" role="alert">
            {error}
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable] rounded-md border border-gray-200 bg-white">
          {showOverlay ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px] transition-opacity">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            </div>
          ) : null}

          <Table
            wrapperClassName="min-w-0 overflow-visible"
            className="w-full min-w-[960px] divide-y divide-gray-200"
          >
            <TableHeader className="sticky top-0 z-1 bg-gray-50 shadow-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Name
                </TableHead>
                
            
                <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Modified by
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Canonical ID
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Modified at
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-200 bg-white">
              {tableBodyContent}
            </TableBody>
          </Table>
        </div>
      </div>

      {(hasPrevPage || hasNextPage) && (
        <div className="shrink-0">
          <SimplePagination
            canGoPrev={hasPrevPage}
            canGoNext={hasNextPage}
            onPrev={() => setPageOnly(page - 1)}
            onNext={() => setPageOnly(page + 1)}
            label={paginationLabel}
            labelPosition="left"
            isDisabled={isFetching}
          />
        </div>
      )}
    </div>
  );
}

export default BDRCPersonsPage;
