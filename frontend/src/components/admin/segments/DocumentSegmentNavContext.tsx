import {
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

interface ScrollRequest {
  segmentId: string;
  nonce: number;
}

interface DocumentSegmentNavStore {
  getScrollRequest: () => ScrollRequest | null;
  subscribeScrollRequest: (listener: () => void) => () => void;
  requestScrollToSegment: (segmentId: string) => void;
  getActiveSegmentId: () => string | null;
  subscribeActiveSegment: (listener: () => void) => () => void;
  setActiveSegmentId: (segmentId: string | null) => void;
}

function createDocumentSegmentNavStore(): DocumentSegmentNavStore {
  let scrollRequest: ScrollRequest | null = null;
  let activeSegmentId: string | null = null;
  const scrollListeners = new Set<() => void>();
  const activeListeners = new Set<() => void>();

  return {
    getScrollRequest: () => scrollRequest,
    subscribeScrollRequest: (listener) => {
      scrollListeners.add(listener);
      return () => scrollListeners.delete(listener);
    },
    requestScrollToSegment: (segmentId) => {
      scrollRequest = { segmentId, nonce: (scrollRequest?.nonce ?? 0) + 1 };
      scrollListeners.forEach((listener) => listener());
    },
    getActiveSegmentId: () => activeSegmentId,
    subscribeActiveSegment: (listener) => {
      activeListeners.add(listener);
      return () => activeListeners.delete(listener);
    },
    setActiveSegmentId: (segmentId) => {
      if (segmentId === activeSegmentId) return;
      activeSegmentId = segmentId;
      activeListeners.forEach((listener) => listener());
    },
  };
}

const DocumentSegmentNavContext = createContext<DocumentSegmentNavStore | null>(null);

export function DocumentSegmentNavProvider({ children }: { readonly children: ReactNode }) {
  const storeRef = useRef<DocumentSegmentNavStore | null>(null);
  storeRef.current ??= createDocumentSegmentNavStore();
  return (
    <DocumentSegmentNavContext.Provider value={storeRef.current}>
      {children}
    </DocumentSegmentNavContext.Provider>
  );
}

function useStore() {
  const store = useContext(DocumentSegmentNavContext);
  if (!store) {
    throw new Error('useDocumentSegmentNav must be used within DocumentSegmentNavProvider');
  }
  return store;
}

export function useDocumentSegmentNav() {
  return useStore();
}

export function useActiveSegmentId() {
  const store = useStore();
  return useSyncExternalStore(store.subscribeActiveSegment, store.getActiveSegmentId);
}

export function useScrollRequest() {
  const store = useStore();
  return useSyncExternalStore(store.subscribeScrollRequest, store.getScrollRequest);
}
