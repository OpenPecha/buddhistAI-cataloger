import { useEffect, useState } from 'react';

import { getRandomReviewedDocumentIds } from '@/api/outliner';

function ViewOnly() {
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getRandomReviewedDocumentIds();
        if (!cancelled) setDocumentIds(res.document_ids);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load document ids');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Random reviewed documents</h1>
      <p className="mb-3 text-sm text-gray-600">
        Up to five document ids with approved status, chosen at random on each page load.
      </p>
      {loading && <p className="text-gray-600">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        <ul className="space-y-2 font-mono text-sm">
          {documentIds.length === 0 ? (
            <li className="text-gray-600">No approved documents in the database.</li>
          ) : (
            documentIds.map((id) => (
              <li key={id} className="break-all rounded border border-gray-200 bg-white px-3 py-2 text-gray-900">
                {id}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default ViewOnly;
