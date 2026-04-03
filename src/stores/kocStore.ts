import { create } from 'zustand';
import { KOCAnalysisResult, KOCProgressEvent } from '../types/electron.d';

interface KOCTarget {
  authorId: string;
  username: string;
}

interface KOCStore {
  // Target KOC đang phân tích
  target: KOCTarget | null;
  // Trạng thái
  isAnalyzing: boolean;
  progress: KOCProgressEvent | null;
  result: KOCAnalysisResult | null;
  error: string | null;
  // Actions
  setTarget: (authorId: string, username: string) => void;
  setProgress: (p: KOCProgressEvent) => void;
  setResult: (r: KOCAnalysisResult) => void;
  setError: (e: string) => void;
  setAnalyzing: (v: boolean) => void;
  reset: () => void;
}

export const useKOCStore = create<KOCStore>((set) => ({
  target: null,
  isAnalyzing: false,
  progress: null,
  result: null,
  error: null,

  setTarget: (authorId, username) =>
    set({ target: { authorId, username }, result: null, error: null, progress: null }),

  setProgress: (p) => set({ progress: p }),
  setResult: (r) => set({ result: r, isAnalyzing: false }),
  setError: (e) => set({ error: e, isAnalyzing: false }),
  setAnalyzing: (v) => set({ isAnalyzing: v }),
  reset: () => set({ target: null, isAnalyzing: false, progress: null, result: null, error: null }),
}));
