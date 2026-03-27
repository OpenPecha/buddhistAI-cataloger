import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type MouseEvent } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Loader2, PersonStandingIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mergeBdrcPersons, mergeBdrcWorks } from '@/api/bdrc';
import {
  useBdrcSearch,
  bdrcSearchQueryKeyRoot,
  type BdrcSearchResult,
} from '@/hooks/useBdrcSearch';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import { bdrcOtWorksSearchQueryKeyRoot } from '../hook/useSearchBDRCWorks';
import { bdrcOtPersonsSearchQueryKeyRoot } from '../hook/useSearchBDRCPersons';

function useMergeModifiedBy(): string | undefined {
  const { user: apiUser } = useUser();
  const { user: auth0User } = useAuth0();
  return (
    apiUser?.email?.trim() ||
    auth0User?.email?.trim() ||
    apiUser?.id?.trim() ||
    auth0User?.sub?.trim() ||
    undefined
  );
}

type MarkDuplicateWorkProps = Readonly<{
  parentWorkId: string;
  defaultQuery: string;
}>;

export function AdminMarkDuplicateWorkButton({
  parentWorkId,
  defaultQuery,
}: MarkDuplicateWorkProps) {
  const [open, setOpen] = useState(false);
  const modifiedBy = useMergeModifiedBy();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState(defaultQuery);
  const [selected, setSelected] = useState<BdrcSearchResult | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const parent = parentWorkId.trim();

  useEffect(() => {
    if (!open) return;
    setQuery(defaultQuery.trim() || parent);
    setSelected(null);
    setMergeError(null);
    setMerging(false);
  }, [open, defaultQuery, parent]);

  const { results, isLoading, error } = useBdrcSearch(query, 'Work', 1000, () => {}, open);

  const filtered = results.filter((r) => {
    const id = (r.workId ?? '').trim();
    return id && id !== parent;
  });

  const handleMerge = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const searched = selected?.workId?.trim();
    if (!searched || !parent) return;
    setMergeError(null);
    setMerging(true);
    try {
      await mergeBdrcWorks({
        parent_work_id: parent,
        searched_work_id: searched,
        ...(modifiedBy ? { modified_by: modifiedBy } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: bdrcSearchQueryKeyRoot });
      await queryClient.invalidateQueries({ queryKey: bdrcOtWorksSearchQueryKeyRoot });
      toast.success('Duplicate work merged into this record');
      setOpen(false);
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
        Mark duplicate
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge duplicate work</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {`This list row is the canonical work (`}
            <span className="font-mono text-xs text-gray-800">{parent}</span>
            {`). Search for the other work to merge into it.`}
          </p>
          <div className="space-y-2">
            <Label htmlFor="admin-dup-work-search" className="text-xs text-gray-600">
              Search works
            </Label>
            <div className="relative">
              <Input
                id="admin-dup-work-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title…"
                className="pr-9 text-sm"
                autoComplete="off"
              />
              {isLoading ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : null}
            </div>
            {error ? (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            {mergeError ? (
              <p className="text-xs text-red-600" role="alert">
                {mergeError}
              </p>
            ) : null}
          </div>

          {query.trim() && !isLoading && !error ? (
            <div className="max-h-52 overflow-y-auto rounded-md border border-gray-200">
              {filtered.length === 0 ? (
                <p className="p-3 text-xs text-gray-500">No other works match.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filtered.map((item, index) => {
                    const id = item.workId?.trim() ?? String(index);
                    const isSel = selected?.workId?.trim() === id;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => setSelected(item)}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${isSel ? 'bg-emerald-50' : ''}`}
                        >
                          <div className="font-monlam font-medium text-gray-900">
                            {item.title?.trim() || id}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                            <PersonStandingIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>{item.authors?.[0]?.name ?? '—'}</span>
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-gray-500">{id}</div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {selected?.workId?.trim() ? (
            <div className="rounded-md border border-emerald-200/90 bg-emerald-50/50 p-3 text-sm">
              <div className="text-xs font-medium text-emerald-900/90">Selected to merge</div>
              <div className="mt-1 font-mono text-xs text-gray-800">{selected.workId.trim()}</div>
              <div className="mt-1 font-monlam text-gray-900">{selected.title?.trim() || '—'}</div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selected?.workId?.trim() || merging}
              onClick={handleMerge}
            >
              {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Merge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type MarkDuplicatePersonProps = Readonly<{
  parentPersonId: string;
  defaultQuery: string;
}>;

export function AdminMarkDuplicatePersonButton({
  parentPersonId,
  defaultQuery,
}: MarkDuplicatePersonProps) {
  const [open, setOpen] = useState(false);
  const modifiedBy = useMergeModifiedBy();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState(defaultQuery);
  const [selected, setSelected] = useState<BdrcSearchResult | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const parent = parentPersonId.trim();

  useEffect(() => {
    if (!open) return;
    setQuery(defaultQuery.trim() || parent);
    setSelected(null);
    setMergeError(null);
    setMerging(false);
  }, [open, defaultQuery, parent]);

  const { results, isLoading, error } = useBdrcSearch(query, 'Person', 1000, () => {}, open);

  const filtered = results.filter((r) => {
    const id = (r.bdrc_id ?? '').trim();
    return id && id !== parent;
  });

  const handleMerge = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const searched = selected?.bdrc_id?.trim();
    if (!searched || !parent) return;
    setMergeError(null);
    setMerging(true);
    try {
      await mergeBdrcPersons({
        parent_person_id: parent,
        searched_person_id: searched,
        ...(modifiedBy ? { modified_by: modifiedBy } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: bdrcSearchQueryKeyRoot });
      await queryClient.invalidateQueries({ queryKey: bdrcOtPersonsSearchQueryKeyRoot });
      toast.success('Duplicate person merged into this record');
      setOpen(false);
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
        Mark duplicate
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge duplicate person</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {`This list row is the canonical person (`}
            <span className="font-mono text-xs text-gray-800">{parent}</span>
            {`). Search for the other person to merge into it.`}
          </p>
          <div className="space-y-2">
            <Label htmlFor="admin-dup-person-search" className="text-xs text-gray-600">
              Search persons
            </Label>
            <div className="relative">
              <Input
                id="admin-dup-person-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name…"
                className="pr-9 text-sm"
                autoComplete="off"
              />
              {isLoading ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : null}
            </div>
            {error ? (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            {mergeError ? (
              <p className="text-xs text-red-600" role="alert">
                {mergeError}
              </p>
            ) : null}
          </div>

          {query.trim() && !isLoading && !error ? (
            <div className="max-h-52 overflow-y-auto rounded-md border border-gray-200">
              {filtered.length === 0 ? (
                <p className="p-3 text-xs text-gray-500">No other persons match.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filtered.map((item, index) => {
                    const id = item.bdrc_id?.trim() ?? String(index);
                    const isSel = selected?.bdrc_id?.trim() === id;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => setSelected(item)}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${isSel ? 'bg-emerald-50' : ''}`}
                        >
                          <div className="font-monlam font-medium text-gray-900">
                            {item.name?.trim() || id}
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-gray-500">{id}</div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {selected?.bdrc_id?.trim() ? (
            <div className="rounded-md border border-emerald-200/90 bg-emerald-50/50 p-3 text-sm">
              <div className="text-xs font-medium text-emerald-900/90">Selected to merge</div>
              <div className="mt-1 font-mono text-xs text-gray-800">{selected.bdrc_id.trim()}</div>
              <div className="mt-1 font-monlam text-gray-900">{selected.name?.trim() || '—'}</div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selected?.bdrc_id?.trim() || merging}
              onClick={handleMerge}
            >
              {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Merge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
