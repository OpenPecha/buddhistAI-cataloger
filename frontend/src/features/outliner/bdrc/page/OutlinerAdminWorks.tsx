import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useBdrcSearch, type BdrcSearchResult } from '@/hooks/useBdrcSearch';
import { useSearchBDRC } from '../hook/useSearchBDRCWorks';
import { formatDistanceToNow } from 'date-fns';
import { AdminMarkDuplicateWorkButton } from '../components/AdminBdrcMarkDuplicate';
import { TitleWithAltLabels } from './OutlinerAdminPersons';
import BDRCSeachWrapper from '@/components/outliner/BDRCSeachWrapper';

const TABLE_COL_COUNT = 6;
const PAGE_SIZE = 20;

const URL_KEYS = {
  page: 'page',
  pref_label_bo: 'pref_label_bo',
  modified_by: 'modified_by',
  record_origin: 'record_origin',
  record_status: 'record_status',
  author_id: 'author_id',
} as const;

/** Match admin Documents / Users filter controls */
const ADMIN_SELECT_CLASS =
  'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50';

/** BEC OT API work search row (subset used in the table). */
export interface BdrcOtWorkRow {
  id: string;
  pref_label_bo?: string | null;
  alt_label_bo?: string[];
  authors?: string[];
  author_records?: { id?: string; pref_label_bo?: string | null }[];
  canonical_id?: string | null;
  curation?: {
    modified_at?: string | null;
    modified_by?: string | null;
  } | null;
}

function asWorkRows(raw: unknown[]): BdrcOtWorkRow[] {
  return raw.filter((r): r is BdrcOtWorkRow => typeof r === 'object' && r !== null && 'id' in r);
}



function AuthorWithRecords({ row }: Readonly<{ row: BdrcOtWorkRow }>) {
  const primary = row.authors?.[0]?.trim() || '—';
  const recordsWithNames = (row.author_records ?? []).filter((r) => Boolean(r.pref_label_bo?.trim()));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="max-w-48 cursor-pointer rounded text-left text-sm text-blue-700 wrap-break-word hover:underline focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {primary}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-md p-3">
        <p className="text-muted-foreground mb-2 text-xs font-medium">Author records</p>
        {recordsWithNames.length === 0 ? (
          <p className="text-muted-foreground text-sm">No author record names.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto text-sm wrap-break-word">
            {recordsWithNames.map((r, i) => (
              <li key={r.id ?? `author-${i}`}>{r.pref_label_bo?.trim() ?? ''}</li>
            ))}
          </ul>
        )}
          <BDRCSeachWrapper bdrcId={row?.id}>
          <span className='text-xs text-blue-500 '>link</span>
          </BDRCSeachWrapper>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AuthorIdFilterField({
  authorId,
  selectedName,
  onSelect,
  onClear,
}: Readonly<{
  authorId: string;
  selectedName: string;
  onSelect: (id: string, name: string) => void;
  onClear: () => void;
}>) {
  const [focused, setFocused] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const searchQuery = focused ? localQuery : '';
  const { results, isLoading } = useBdrcSearch(searchQuery, 'Person', 400, () => {}, focused);

  useEffect(() => {
    if (!focused) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
        setLocalQuery('');
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [focused]);

  const display =
    focused ? localQuery : selectedName.trim() || authorId.trim() || '';

  const showDropdown = focused && (searchQuery.trim().length > 0 || isLoading);

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <Label htmlFor="bdrc-author-id-filter" className="text-sm font-medium text-gray-700">
        Author (BDRC person)
      </Label>
      <div className="relative flex gap-1">
        <Input
          id="bdrc-author-id-filter"
          type="search"
          placeholder="Search person…"
          value={display}
          onChange={(e) => {
            setLocalQuery(e.target.value);
            if (!focused) setFocused(true);
          }}
          onFocus={() => {
            setFocused(true);
            setLocalQuery('');
          }}
          className="h-9 flex-1 text-sm"
          aria-label="Search BDRC persons for author filter"
          autoComplete="off"
        />
        {authorId ? (
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            aria-label="Clear author filter"
            onClick={() => {
              onClear();
              setLocalQuery('');
              setFocused(false);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        {isLoading ? (
          <div className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        ) : null}
      </div>
      {showDropdown ? (
        <div className="absolute z-60 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {!isLoading && results.length === 0 && searchQuery.trim() ? (
            <p className="px-3 py-2 text-sm text-gray-500">No persons match.</p>
          ) : null}
          {results.map((person: BdrcSearchResult, i: number) => {
            const id = person.bdrc_id?.trim() ?? '';
            if (!id) return null;
            return (
              <button
                key={`${id}-${i}`}
                type="button"
                className="w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-gray-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(id, person.name?.trim() || id);
                  setLocalQuery('');
                  setFocused(false);
                }}
              >
                <span className="font-medium text-gray-900">{person.name ?? id}</span>
                <span className="mt-0.5 block font-mono text-xs text-gray-500">{id}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function BDRCPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { users: annotators, isLoading: annotatorsLoading } = useOutlinerUsers();

  const page = Math.max(1, Number.parseInt(searchParams.get(URL_KEYS.page) || '1', 10) || 1);
  const modifiedByEmail = searchParams.get(URL_KEYS.modified_by) ?? '';
  const recordOrigin = searchParams.get(URL_KEYS.record_origin) ?? '';
  const recordStatus = searchParams.get(URL_KEYS.record_status) ?? '';
  const authorId = searchParams.get(URL_KEYS.author_id) ?? '';

  const [prefLabelBo, setPrefLabelBo] = useState(() => searchParams.get(URL_KEYS.pref_label_bo) ?? '');
  const [authorDisplayName, setAuthorDisplayName] = useState('');

  const prefInUrl = searchParams.get(URL_KEYS.pref_label_bo) ?? '';
  useEffect(() => {
    setPrefLabelBo(prefInUrl);
  }, [prefInUrl]);

  useEffect(() => {
    if (!authorId) setAuthorDisplayName('');
  }, [authorId]);

  const [debouncedPrefForUrl, setDebouncedPrefForUrl] = useState(() =>
    (searchParams.get(URL_KEYS.pref_label_bo) ?? '').trim()
  );
  useEffect(() => {
    const t = globalThis.setTimeout(() => setDebouncedPrefForUrl(prefLabelBo.trim()), 600);
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
      authorId,
      page,
      pageSize: PAGE_SIZE,
    }),
    [prefLabelBo, modifiedByEmail, recordOrigin, recordStatus, authorId, page]
  );

  const { results: rawResults, isLoading, isFetching, error } = useSearchBDRC(filters, {
    debounceMs: 600,
  });
  const results = asWorkRows(rawResults);

  const hasNextPage = results.length === PAGE_SIZE;
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
        <TableCell colSpan={TABLE_COL_COUNT} className="px-6 py-8 text-center text-sm text-gray-500">
          Loading works…
        </TableCell>
      </TableRow>
    );
  } else if (results.length === 0) {
    tableBodyContent = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={TABLE_COL_COUNT} className="px-6 py-8 text-center text-sm text-gray-500">
          No works match your filters.
        </TableCell>
      </TableRow>
    );
  } else {
    tableBodyContent = results.map((row, index) => {
      const modifiedAt = row.curation?.modified_at;
      const istDate = modifiedAt ? new Date(modifiedAt) : new Date();

    return <TableRow key={row.id || `row-${index}`}>
        <TableCell className="max-w-xs px-6 py-3 align-top">
          <TitleWithAltLabels row={row} />
        </TableCell>
        <TableCell className="px-6 py-3 align-top">
          <AuthorWithRecords row={row} />
        </TableCell>
        <TableCell className="wrap-break-word px-6 py-3 text-sm text-gray-900">
          {row.curation?.modified_by?.trim() || '—'}
        </TableCell>
        <TableCell className="wrap-break-word px-6 py-3 font-mono text-sm text-gray-900">
          {row.canonical_id != null && row.canonical_id !== '' ? row.canonical_id : '—'}
        </TableCell>
        <TableCell className="whitespace-nowrap px-6 py-3 text-sm text-gray-900">
        {formatDistanceToNow(istDate, { addSuffix: true })}
        </TableCell>
        <TableCell className="whitespace-nowrap px-6 py-3 align-top">
          <AdminMarkDuplicateWorkButton
            parentWorkId={row.id}
            defaultQuery={row.pref_label_bo?.trim() ?? ''}
          />
        </TableCell>
      </TableRow>
  }
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">BDRC works</h3>
              <p className="mt-1 text-sm text-gray-600">List and filter works (BEC OT API)</p>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="bdrc-pref-label-bo" className="text-sm font-medium text-gray-700">
                  Preferred label (bo)
                </label>
                <div className="relative w-full min-w-[200px] max-w-xs sm:w-64">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    aria-hidden
                  />
                  <Input
                    id="bdrc-pref-label-bo"
                    type="search"
                    placeholder="Search by title…"
                    value={prefLabelBo}
                    onChange={(e) => setPrefLabelBo(e.target.value)}
                    className="h-9 pl-9 text-sm"
                    aria-label="Filter by preferred Tibetan label"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="bdrc-modified-by" className="text-sm font-medium text-gray-700">
                  Modified by
                </label>
                <select
                  id="bdrc-modified-by"
                  disabled={annotatorsLoading}
                  value={modifiedByEmail}
                  onChange={(e) => patchUrl({ [URL_KEYS.modified_by]: e.target.value || null })}
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

              <div className="w-full min-w-[200px] max-w-xs sm:w-64">
                <AuthorIdFilterField
                  authorId={authorId}
                  selectedName={authorDisplayName}
                  onSelect={(id, name) => {
                    setAuthorDisplayName(name);
                    patchUrl({ [URL_KEYS.author_id]: id });
                  }}
                  onClear={() => {
                    setAuthorDisplayName('');
                    patchUrl({ [URL_KEYS.author_id]: null });
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="bdrc-record-origin" className="text-sm font-medium text-gray-700">
                  Record origin
                </label>
                <select
                  id="bdrc-record-origin"
                  value={recordOrigin}
                  onChange={(e) => patchUrl({ [URL_KEYS.record_origin]: e.target.value || null })}
                  className={ADMIN_SELECT_CLASS}
                  aria-label="Filter by record origin"
                >
                  <option value="">Any origin</option>
                  <option value="local">local</option>
                  <option value="imported">imported</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="bdrc-record-status" className="text-sm font-medium text-gray-700">
                  Record status
                </label>
                <select
                  id="bdrc-record-status"
                  value={recordStatus}
                  onChange={(e) => patchUrl({ [URL_KEYS.record_status]: e.target.value || null })}
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
            className="w-full min-w-[1000px] divide-y divide-gray-200"
          >
            <TableHeader className="sticky top-0 z-1 bg-gray-50 shadow-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Title
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Author
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
                <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-200 bg-white">{tableBodyContent}</TableBody>
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
            label={`Page ${page}`}
            labelPosition="left"
            isDisabled={isFetching}
          />
        </div>
      )}
    </div>
  );
}

export default BDRCPage;
