export interface SentenceMapping {
  source: {
    start: number;
    end: number;
    index: string;
  };
  target: {
    start: number;
    end: number;
    alignment_index: string[];
  };
}