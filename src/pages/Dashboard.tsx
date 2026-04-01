import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Link2,
  Copy,
  Search,
  Play,
  Download,
  Clock,
  Eye,
  Heart,
  MessageCircle,
  User,
  Calendar,
  ShoppingBag,
  Store,
  Package,
  Users,
  ExternalLink,
  ClipboardCheck
} from 'lucide-react';
import Card from '../components/ui/Card';
import VideoPlayer from '../components/ui/VideoPlayer';
import { LoadingSpinner, MetadataSkeleton } from '../components/ui/Loading';
import { VideoMetadata, ProductInfo } from '../types/electron.d';

// Regex nhận diện TikTok URL hợp lệ
const TIKTOK_URL_REGEX = /https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/.+/i;

function Dashboard() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  // Product info state
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  // Auto-paste state
  const [autoPasteNotice, setAutoPasteNotice] = useState(false);
  const lastPastedUrl = useRef<string>('');
  // FastMoss state
  const [fastmossLoading, setFastmossLoading] = useState(false);
  const [fastmossError, setFastmossError] = useState<string | null>(null);

  // ─── Auto-paste clipboard khi app được focus ───────────────────────────────
  const tryAutoPaste = useCallback(async () => {
    try {
      const settings = await window.electronAPI.getSettings();
      const autoPaste = (settings?.data as any)?.autoPasteClipboard;
      if (autoPaste !== 'true') return;

      const text = await navigator.clipboard.readText();
      const trimmed = text?.trim();
      if (
        trimmed &&
        TIKTOK_URL_REGEX.test(trimmed) &&
        trimmed !== lastPastedUrl.current
      ) {
        lastPastedUrl.current = trimmed;
        setUrl(trimmed);
        setAutoPasteNotice(true);
        setTimeout(() => setAutoPasteNotice(false), 2500);
      }
    } catch {
      // Clipboard không khả dụng hoặc quyền bị từ chối — bỏ qua
    }
  }, []);

  // Chạy khi component mount + mỗi lần window được focus
  useEffect(() => {
    tryAutoPaste();
    window.addEventListener('focus', tryAutoPaste);
    return () => window.removeEventListener('focus', tryAutoPaste);
  }, [tryAutoPaste]);

  // Handle paste thủ công (click icon)
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  }, []);

  // Fetch video metadata
  const handleFetch = useCallback(async () => {
    if (!url.trim()) return;
    
    setLoading(true);
    setError(null);
    setMetadata(null);
    setProductInfo(null);
    setProductLoading(true);
    
    try {
      // Validate URL first
      const validation = await window.electronAPI.validateUrl(url);
      if (!validation.valid) {
        throw new Error('Invalid TikTok URL. Please enter a valid video URL (e.g., https://www.tiktok.com/@user/video/1234567890)');
      }
      
      // Fetch metadata
      const result = await window.electronAPI.getVideoMetadata(url);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch video metadata');
      }
      
      setMetadata(result.data);
      
      // Fetch product info in parallel (non-blocking)
      window.electronAPI.getProductInfo(url)
        .then((info) => {
          console.log('[Dashboard] Product info result:', info);
          setProductInfo(info);
        })
        .catch((err) => {
          console.error('[Dashboard] Product info error:', err);
        })
        .finally(() => {
          setProductLoading(false);
        });
        
    } catch (err) {
      setError((err as Error).message);
      setProductLoading(false);
    } finally {
      setLoading(false);
    }
  }, [url]);

  // Download video
  const handleDownload = useCallback(async () => {
    if (!metadata) return;
    
    setDownloading(true);
    setDownloadStarted(false);
    
    try {
      // Just call downloadVideo - progress events will be handled by the store listener
      const result = await window.electronAPI.downloadVideo(metadata.url);
      
      if (result.success) {
        setDownloadStarted(true);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  }, [metadata]);

  // Mở FastMoss tìm KOC
  const handleOpenFastMoss = useCallback(async () => {
    if (!metadata) return;
    setFastmossLoading(true);
    setFastmossError(null);
    try {
      const result = await window.electronAPI.openFastMoss(url, metadata?.uploader);
      if (!result?.success) {
        // Fallback: mở thẳng trình duyệt ngoài nếu không có cookies
        const username = metadata.uploader || '';
        const fallbackUrl = `https://www.fastmoss.com/vi/influencer/search?keyword=${encodeURIComponent(username)}`;
        window.open(fallbackUrl, '_blank');
        if (result?.error?.includes('cookie') || result?.error?.includes('Cookie')) {
          setFastmossError('Chưa cấu hình cookies → đã mở FastMoss trên trình duyệt. Vào Settings để cấu hình cookies cho trải nghiệm tốt hơn.');
        }
      }
    } catch {
      // Nếu có lỗi bất ngờ, vẫn fallback ra browser
      const username = metadata?.uploader || '';
      window.open(`https://www.fastmoss.com/vi/influencer/search?keyword=${encodeURIComponent(username)}`, '_blank');
    } finally {
      setFastmossLoading(false);
      // Tự xóa thông báo lỗi sau 5 giây
      setTimeout(() => setFastmossError(null), 5000);
    }
  }, [url, metadata]);

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format number
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Unknown';
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 stagger-children">
      {/* URL Input Card */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tiktok-red/20 to-tiktok-cyan/20 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-tiktok-red" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-white">Video URL</h3>
            <p className="text-sm text-white/50">Paste a TikTok video URL to preview</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              placeholder="https://www.tiktok.com/@user/video/..."
              className="input pr-12"
            />
            <button
              onClick={handlePaste}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
              title="Paste from clipboard"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={handleFetch}
            disabled={!url.trim() || loading}
            className="btn btn-primary px-6"
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <Search className="w-4 h-4" />
                Preview
              </>
            )}
          </button>
        </div>

        {/* Auto-paste notice */}
        {autoPasteNotice && (
          <div className="mt-3 flex items-center gap-2 text-xs text-tiktok-cyan animate-fadeIn">
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>URL TikTok đã được tự động dán từ clipboard</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </Card>

      {/* Loading State */}
      {loading && <MetadataSkeleton />}

      {/* Video Preview Card */}
      {metadata && !loading && (
        <Card className="animate-fadeIn">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Video Player */}
            <div className="lg:w-80 flex-shrink-0">
              <VideoPlayer 
                url={metadata.hdDownloadUrl || metadata.downloadUrl || ''}
                thumbnail={metadata.thumbnail}
                className="aspect-[9/16] w-full"
              />
            </div>

            {/* Metadata */}
            <div className="flex-1 space-y-4">
              {/* Title & Creator */}
              <div>
                <h3 className="font-display font-semibold text-white text-lg line-clamp-2">
                  {metadata.title}
                </h3>
                <div className="flex items-center gap-2 mt-2 text-white/60">
                  <User className="w-4 h-4" />
                  <span className="font-medium">@{metadata.uploader}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-2 text-white/50 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">Duration</span>
                  </div>
                  <p className="font-mono font-semibold text-white">
                    {formatDuration(metadata.duration)}
                  </p>
                </div>
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-2 text-white/50 mb-1">
                    <Eye className="w-4 h-4" />
                    <span className="text-xs">Views</span>
                  </div>
                  <p className="font-mono font-semibold text-white">
                    {formatNumber(metadata.viewCount)}
                  </p>
                </div>
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-2 text-white/50 mb-1">
                    <Heart className="w-4 h-4" />
                    <span className="text-xs">Likes</span>
                  </div>
                  <p className="font-mono font-semibold text-white">
                    {formatNumber(metadata.likeCount)}
                  </p>
                </div>
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-2 text-white/50 mb-1">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-xs">Comments</span>
                  </div>
                  <p className="font-mono font-semibold text-white">
                    {formatNumber(metadata.commentCount)}
                  </p>
                </div>
              </div>

              {/* Upload Date */}
              <div className="flex items-center gap-2 text-white/50">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Uploaded: {formatDate(metadata.uploadDate)}</span>
              </div>

              {/* Description */}
              {metadata.description && (
                <div className="glass rounded-xl p-4">
                  <p className="text-sm text-white/70 line-clamp-3">
                    {metadata.description}
                  </p>
                </div>
              )}

              {/* Product Info Section */}
              {productLoading && (
                <div className="glass rounded-xl p-4 border border-tiktok-cyan/30">
                  <div className="flex items-center gap-3">
                    <LoadingSpinner size="sm" />
                    <span className="text-sm text-white/60">Checking for attached products...</span>
                  </div>
                </div>
              )}
              
              {productInfo?.hasProduct && !productLoading && (
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-tiktok-red/10 via-purple-500/10 to-tiktok-cyan/10 p-[1px]">
                  <div className="glass rounded-xl p-4 bg-black/40">
                    <div className="flex items-center gap-2 mb-3">
                      <ShoppingBag className="w-5 h-5 text-tiktok-cyan" />
                      <span className="font-semibold text-white">TikTok Shop Product</span>
                    </div>
                    
                    <div className="flex gap-4">
                      {/* Product Image */}
                      {productInfo.productImage && (
                        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-white/10">
                          <img 
                            src={productInfo.productImage} 
                            alt={productInfo.productTitle || 'Product'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        {productInfo.productTitle && (
                          <h4 className="font-medium text-white line-clamp-2 mb-2">
                            {productInfo.productTitle}
                          </h4>
                        )}
                        
                        <div className="flex flex-wrap gap-3 text-sm">
                          {productInfo.shopName && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <Store className="w-4 h-4" />
                              <span>{productInfo.shopName}</span>
                            </div>
                          )}
                          
                          {productInfo.soldCount && productInfo.soldCount > 0 && (
                            <div className="flex items-center gap-1.5 text-white/60">
                              <Package className="w-4 h-4" />
                              <span>{productInfo.soldCount.toLocaleString()} sold</span>
                            </div>
                          )}
                        </div>
                        
                        {productInfo.productUrl && (
                          <button 
                            onClick={() => window.open(productInfo.productUrl, '_blank')}
                            className="mt-3 text-sm text-tiktok-cyan hover:text-tiktok-cyan/80 transition-colors"
                          >
                            View Product →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {!productInfo?.hasProduct && !productLoading && metadata && (
                <div className="glass rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2 text-white/40 text-sm">
                    <ShoppingBag className="w-4 h-4" />
                    <span>No product attached to this video</span>
                  </div>
                </div>
              )}

              {/* FastMoss KOC Button */}
              {metadata && (
                <div className="space-y-2">
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-500/20 to-tiktok-cyan/20 p-[1px]">
                    <div className="glass rounded-xl p-4 bg-black/40 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Tìm KOC trên FastMoss</p>
                          <p className="text-xs text-white/50">
                            Xem analytics của @{metadata.uploader}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleOpenFastMoss}
                        disabled={fastmossLoading}
                        className="flex items-center gap-1.5 text-sm font-medium text-tiktok-cyan hover:text-white transition-colors flex-shrink-0 disabled:opacity-50"
                      >
                        {fastmossLoading ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <>
                            Mở FastMoss
                            <ExternalLink className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  {/* Thông báo lỗi/fallback */}
                  {fastmossError && (
                    <div className="px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 animate-fadeIn">
                      <p className="text-xs text-yellow-400">{fastmossError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => window.open(metadata.url, '_blank')}
                  className="btn btn-secondary flex-1"
                >
                  <Play className="w-4 h-4" />
                  Open in TikTok
                </button>
                <button 
                  onClick={handleDownload}
                  disabled={downloading}
                  className="btn btn-primary flex-1"
                >
                  {downloading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download Video
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!metadata && !loading && !error && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-tiktok-red/20 to-tiktok-cyan/20 flex items-center justify-center mx-auto mb-6">
            <Play className="w-10 h-10 text-white/50" />
          </div>
          <h3 className="font-display font-semibold text-white/70 text-xl mb-2">
            No Video Selected
          </h3>
          <p className="text-white/40 max-w-md mx-auto">
            Paste a TikTok video URL above to preview its metadata and download.
            You can also download the video in the best available quality.
          </p>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
