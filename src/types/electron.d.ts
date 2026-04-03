export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  uploader: string;
  uploaderId: string;
  authorId?: string;
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

// ─── KOC AI Analysis Types ────────────────────────────────────────────────

export interface KOCOverview {
  gmv_total: string;
  gmv_video: string;
  gmv_livestream: string;
  gpm_video_28d: string;
  total_videos: string;
  sales_videos: string;
  non_sales_videos: string;
  total_plays: string;
  median_views: string;
  avg_engagement_rate: string;
  livestream_count: string;
  livestream_avg_revenue: string;
}

export interface KOCAudience {
  gender_male: string;
  gender_female: string;
  age_18_24: string;
  age_25_34: string;
  age_35_44: string;
  age_45_plus: string;
  region_top: Array<{ name: string; percent: string }>;
  fan_active: string;
  fan_potential: string;
}

export interface KOCTopVideo {
  title: string;
  duration: string;
  sales_count: string;
  revenue: string;
  views: string;
  engagement_rate: string;
  product_name: string;
  category: string;
}

export interface KOCSales {
  partner_stores: string;
  total_products: string;
  total_sales: string;
  total_gmv: string;
  top_categories: Array<{ name: string; percent: string }>;
  top_videos: KOCTopVideo[];
}

export interface KOCScrapeData {
  username: string;
  authorId: string;
  scrapedAt: string;
  overview: KOCOverview;
  audience: KOCAudience;
  sales: KOCSales;
}

export interface KOCAnalysisBrand {
  overall_score: number;
  tier: 'nano' | 'micro' | 'mid' | 'macro' | 'mega';
  recommendation: 'excellent' | 'good' | 'fair' | 'poor';
  fit_categories: string[];
  content_strategy: string[];
  suggestions: string[];
  risks: string[];
}

export interface KOCAnalysisSection {
  score: number;
  summary: string;
  ai_comment: string;
  highlights: string[];
}

export interface KOCAnalysisResult {
  id: string;
  username: string;
  authorId: string;
  createdAt: string;
  scrapeData: KOCScrapeData;
  computed: {
    video_sales_ratio: string;
    est_gmv_per_video: string;
    avg_revenue_top5: string;
  };
  analysis: {
    sales_capability: KOCAnalysisSection;
    audience_quality: KOCAnalysisSection;
    content_quality: KOCAnalysisSection;
    brand_recommendation: KOCAnalysisBrand;
  };
}

export interface KOCProgressEvent {
  step: number;
  totalSteps: number;
  label: string;
  percent: number;
  status: 'running' | 'done' | 'error';
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
      // KOC AI Analysis
      analyzeKOC: (authorId: string, username: string) => Promise<{ success: boolean; data?: KOCAnalysisResult; error?: string }>;
      getKOCHistory: (limit?: number) => Promise<{ success: boolean; data?: KOCAnalysisResult[]; error?: string }>;
      exportKOCReport: (reportId: string) => Promise<{ success: boolean; error?: string }>;
      onKOCProgress: (callback: (progress: KOCProgressEvent) => void) => () => void;
      // TikTok Shop Product Info
      getProductInfo: (videoUrl: string) => Promise<ProductInfo>;
    };
  }
}

export {};
