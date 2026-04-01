export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  uploader: string;
  uploaderId: string;
  duration: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  thumbnail: string;
  url: string;
  uploadDate: string;
  // TikWM API extra fields
  downloadUrl?: string;
  hdDownloadUrl?: string;
  audioUrl?: string;
  images?: string[];
  avatarUrl?: string;
}

// FastMoss Types
export interface FastMossInfluencer {
  id: string;
  name: string;
  tiktokId: string;
  avatar: string;
  followers: string;
  country: string;
}

export interface FastMossOverview {
  gmvTotal: string;
  gmvRank: string;
  gmvVideo: string;
  gmvLivestream: string;
  gpmVideo28d: string;
  gpmLivestream28d: string;
  totalVideos: number;
  totalViews: string;
  engagementRate: string;
  salesVideos: number;
  avgViews: string;
  livestreamCount: number;
  maxLivestreamViewers: string;
  avgLivestreamViewers: string;
}

export interface FastMossVideo {
  thumbnail: string;
  title: string;
  duration: string;
  publishedAt: string;
  videoType: string;
  salesCount: string;
  revenue: string;
  views: string;
  engagementRate: string;
  productThumbnail?: string;
  videoUrl?: string;
}

export interface FastMossData {
  influencer: FastMossInfluencer;
  overview: FastMossOverview;
  topVideos: FastMossVideo[];
  detailUrl: string;
  crawledAt: string;
}

export interface DownloadProgress {
  jobId: string;
  percent: number;
  speed?: string;
  eta?: string;
  status: 'downloading' | 'completed' | 'error' | 'cancelled' | 'fetching';
  savedPath?: string;
  error?: string;
  message?: string;
}

export interface VideoHistoryItem {
  id: number;
  url: string;
  video_id: string;
  caption: string;
  creator: string;
  duration: number;
  thumbnail: string;
  status: string;
  saved_path: string | null;
  created_at: string;
  updated_at: string;
  // Video stats (from TikWM API)
  view_count?: number;
  play_count?: number;
  like_count?: number;
  digg_count?: number;
  comment_count?: number;
  share_count?: number;
}

export interface Settings {
  downloadPath: string;
  autoPasteClipboard: string;
  maxConcurrentDownloads: string;
}

export interface AppInfo {
  version: string;
  name: string;
  platform: string;
  arch: string;
  electronVersion: string;
  nodeVersion: string;
}

export interface YtdlpStatus {
  available: boolean;
  version: string | null;
}

// TikTok Shop Product Info
export interface ProductInfo {
  hasProduct: boolean;
  productId?: string;
  productTitle?: string;
  shopName?: string;
  shopId?: string;
  soldCount?: number;
  productUrl?: string;
  productImage?: string;
  anchorType?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

declare global {
  interface Window {
    electronAPI: {
      validateUrl: (url: string) => Promise<{ valid: boolean; type: 'video' | 'unknown' }>;
      getVideoMetadata: (url: string) => Promise<ApiResponse<VideoMetadata>>;
      downloadVideo: (url: string, outputPath?: string) => Promise<{ success: boolean; jobId: string; savedPath?: string; error?: string }>;
      cancelDownload: (jobId: string) => Promise<{ success: boolean; error?: string }>;
      getHistory: (type: 'video', limit?: number) => Promise<ApiResponse<VideoHistoryItem[]>>;
      clearHistory: (type: 'video') => Promise<{ success: boolean; error?: string }>;
      deleteHistoryItem: (id: number) => Promise<{ success: boolean; error?: string }>;
      getSettings: () => Promise<ApiResponse<Settings>>;
      setSetting: (key: string, value: string) => Promise<{ success: boolean; error?: string }>;
      selectFolder: () => Promise<{ success: boolean; path?: string }>;
      openFolder: (path: string) => Promise<{ success: boolean }>;
      openFile: (path: string) => Promise<{ success: boolean }>;
      checkYtdlp: () => Promise<YtdlpStatus>;
      getAppInfo: () => Promise<AppInfo>;
      onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void;
      // FastMoss APIs
      openFastMoss: (tiktokUrl: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
      openFastMossDetail: (detailUrl: string) => Promise<{ success: boolean; error?: string }>;
      checkFastMossCookies: () => Promise<{ valid: boolean; message: string }>;
      refreshFastMossSession: () => Promise<{ success: boolean; message?: string; error?: string }>;
      // TikTok Shop Product Info
      getProductInfo: (videoUrl: string) => Promise<ProductInfo>;
    };
  }
}

export {};
