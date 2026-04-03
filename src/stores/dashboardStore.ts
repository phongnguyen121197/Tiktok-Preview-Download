import { create } from 'zustand';
import { VideoMetadata, ProductInfo } from '../types/electron.d';

interface DashboardStore {
  url: string;
  metadata: VideoMetadata | null;
  productInfo: ProductInfo | null;
  productLoading: boolean;
  error: string | null;

  setUrl: (url: string) => void;
  setMetadata: (m: VideoMetadata | null) => void;
  setProductInfo: (p: ProductInfo | null) => void;
  setProductLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  url: '',
  metadata: null,
  productInfo: null,
  productLoading: false,
  error: null,

  setUrl: (url) => set({ url }),
  setMetadata: (metadata) => set({ metadata }),
  setProductInfo: (productInfo) => set({ productInfo }),
  setProductLoading: (productLoading) => set({ productLoading }),
  setError: (error) => set({ error }),
  reset: () => set({ url: '', metadata: null, productInfo: null, productLoading: false, error: null }),
}));
