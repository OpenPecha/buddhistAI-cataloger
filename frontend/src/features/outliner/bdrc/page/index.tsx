import { useState, type ReactNode } from 'react';
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
import { useSearchBDRC } from '../hook/useSearchBDRC';

const TABLE_COL_COUNT = 5;

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

function formatModifiedAt(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function TitleWithAltLabels({ row }: Readonly<{ row: BdrcOtWorkRow }>) {
  const title = row.pref_label_bo?.trim() || '—';
  const alts = row.alt_label_bo ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="max-w-xs cursor-pointer rounded text-left text-sm text-blue-700 wrap-break-word hover:underline focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {title}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-md p-3">
        <p className="text-muted-foreground mb-2 text-xs font-medium">Alternative labels</p>
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

function AuthorWithRecords({ row }: Readonly<{ row: BdrcOtWorkRow }>) {
  const primary = row.authors?.[0]?.trim() || '—';
  const recordsWithNames = (row.author_records ?? []).filter(
    (r) => Boolean(r.pref_label_bo?.trim())
  );

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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BDRCPage() {
  const [titleSearch, setTitleSearch] = useState('');
  const { results: rawResults, isLoading, error } = useSearchBDRC(titleSearch, { debounceMs: 600 });
  const results = asWorkRows(rawResults);

  const trimmed = titleSearch.trim();
  const showOverlay = isLoading && trimmed.length > 0;

  let tableBodyContent: ReactNode;
  if (trimmed.length === 0) {
    tableBodyContent = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={TABLE_COL_COUNT} className="px-6 py-8 text-center text-sm text-gray-500">
          Enter a title to search.
        </TableCell>
      </TableRow>
    );
  } else if (isLoading && results.length === 0) {
    tableBodyContent = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={TABLE_COL_COUNT} className="px-6 py-8 text-center text-sm text-gray-500">
          Searching…
        </TableCell>
      </TableRow>
    );
  } else if (results.length === 0) {
    tableBodyContent = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={TABLE_COL_COUNT} className="px-6 py-8 text-center text-sm text-gray-500">
          No works match your search.
        </TableCell>
      </TableRow>
    );
  } else {
    tableBodyContent = results.map((row, index) => (
      <TableRow key={row.id || `row-${index}`}>
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
          {formatModifiedAt(row.curation?.modified_at ?? undefined)}
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="rounded-lg border border-gray-200 bg-white shadow-md">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">BDRC works search</h2>
            <p className="text-sm text-gray-500">Search by title (BEC OT API)</p>
          </div>
          <div className="relative w-full min-w-[200px] max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <Input
              id="bdrc-work-title-search"
              type="search"
              placeholder="Search by title…"
              value={titleSearch}
              onChange={(e) => setTitleSearch(e.target.value)}
              className="h-9 pl-9 text-sm"
              aria-label="Search BDRC works by title"
            />
          </div>
        </div>

        {error ? (
          <div className="px-6 py-4 text-sm text-red-600" role="alert">
            {error}
          </div>
        ) : null}

        <div className="relative">
          {showOverlay ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            </div>
          ) : null}

          <Table className="min-w-full divide-y divide-gray-200">
            <TableHeader className="bg-gray-50">
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
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-200 bg-white">{tableBodyContent}</TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default BDRCPage;
