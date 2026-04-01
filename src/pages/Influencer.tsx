import { useState, useEffect } from 'react';
import { 
  Users,
  Search,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ArrowRight,
  Info,
  Loader2
} from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/Loading';

function Influencer() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [cookiesValid, setCookiesValid] = useState<boolean | null>(null);
  const [cookiesMessage, setCookiesMessage] = useState('');
  const [checkingCookies, setCheckingCookies] = useState(true);

  // Check cookies on mount
  useEffect(() => {
    checkCookies();
  }, []);

  const checkCookies = async () => {
    setCheckingCookies(true);
    try {
      const result = await window.electronAPI.checkFastMossCookies();
      setCookiesValid(result.valid);
      setCookiesMessage(result.message);
    } catch (err) {
      setCookiesValid(false);
      setCookiesMessage('Lỗi kiểm tra cookies');
    } finally {
      setCheckingCookies(false);
    }
  };

  // Extract TikTok username from URL or input
  const extractUsername = (input: string): string | null => {
    // Handle full URLs
    const urlMatch = input.match(/tiktok\.com\/@([^\/\?]+)/);
    if (urlMatch) return urlMatch[1];
    
    // Handle just username with @
    if (input.startsWith('@')) return input.slice(1);
    
    // Handle plain username
    if (/^[\w._]+$/.test(input)) return input;
    
    return null;
  };

  const handleOpenFastMoss = async () => {
    const username = extractUsername(url.trim());
    
    if (!username) {
      setError('Vui lòng nhập username TikTok. Ví dụ: ngockemm hoặc @ngockemm');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setStatusMessage('Đang tìm kiếm thông tin influencer...');

    try {
      // Gửi username trực tiếp (không cần full URL)
      const result = await window.electronAPI.openFastMoss(`@${username}`);
      
      if (result.success) {
        setStatusMessage('Đang mở trang chi tiết FastMoss...');
        setSuccess(true);
        // Keep loading state for a bit to show progress
        setTimeout(() => {
          setLoading(false);
          setStatusMessage('');
        }, 1500);
      } else {
        setLoading(false);
        setStatusMessage('');
        setError(result.error || 'Không thể mở FastMoss. Vui lòng kiểm tra cookies.');
      }
    } catch (err) {
      setLoading(false);
      setStatusMessage('');
      setError((err as Error).message);
    }
  };

  const handleOpenFastMossDirect = async () => {
    try {
      await window.electronAPI.openFastMossDetail('https://www.fastmoss.com/vi/influencer/search?shop_window=1');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-white">Influencer Analytics</h3>
            <p className="text-sm text-white/50">Tra cứu dữ liệu TikTok Shop của nhà sáng tạo từ FastMoss</p>
          </div>
          
          {/* Cookies Status */}
          <div className="flex items-center gap-2">
            {checkingCookies ? (
              <LoadingSpinner size="sm" />
            ) : cookiesValid ? (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                FastMoss Connected
              </span>
            ) : (
              <span className="text-xs text-yellow-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Cần cấu hình cookies
              </span>
            )}
            <button onClick={checkCookies} className="btn btn-ghost p-1" title="Kiểm tra lại">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Cookies Warning */}
      {!checkingCookies && !cookiesValid && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-display font-semibold text-yellow-400 mb-2">Cần cấu hình FastMoss Cookies</h4>
              <p className="text-sm text-white/70 mb-3">
                Để sử dụng tính năng này, bạn cần đăng nhập FastMoss trên browser và copy cookies vào Settings.
              </p>
              <p className="text-xs text-white/50">{cookiesMessage}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Search Box */}
      <Card>
        <div className="space-y-4">
          <label className="text-sm text-white/70">Nhập username TikTok của nhà sáng tạo</label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleOpenFastMoss()}
                placeholder="ngockemm hoặc @ngockemm"
                className="input w-full pl-10"
                disabled={loading}
              />
              <Search className="w-5 h-5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <button 
              onClick={handleOpenFastMoss}
              disabled={loading || !url.trim() || !cookiesValid}
              className="btn btn-primary px-6 min-w-[140px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang mở...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Mở FastMoss
                </>
              )}
            </button>
          </div>
          
          {/* Example */}
          <p className="text-xs text-white/40">
            Ví dụ: bepdiiday._ hoặc @bepdiiday._
          </p>
        </div>
      </Card>

      {/* Loading/Status Message */}
      {loading && statusMessage && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <div>
              <p className="text-sm text-blue-400 font-medium">{statusMessage}</p>
              <p className="text-xs text-white/50">Cửa sổ FastMoss sẽ xuất hiện trong giây lát...</p>
            </div>
          </div>
        </Card>
      )}

      {/* Success Message */}
      {success && !loading && (
        <Card className="border-green-500/30 bg-green-500/5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm text-green-400 font-medium">Đã mở FastMoss thành công!</p>
              <p className="text-xs text-white/50">Cửa sổ FastMoss đã được mở. Nếu không thấy, hãy kiểm tra taskbar.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card className="border-red-500/30 bg-red-500/5">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-red-400 mb-2">Lỗi</h4>
              <p className="text-sm text-white/70">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-display font-semibold text-white mb-2">Cách sử dụng</h4>
            <ol className="text-sm text-white/70 space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0">1</span>
                <span>Nhập username TikTok của influencer (ví dụ: ngockemm)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0">2</span>
                <span>Nhấn "Mở FastMoss" - cửa sổ mới sẽ xuất hiện trong vài giây</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0">3</span>
                <span>FastMoss sẽ hiển thị thông tin GMV, video bán hàng, livestream, v.v.</span>
              </li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card>
        <h4 className="font-display font-semibold text-white mb-4">Truy cập nhanh</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button 
            onClick={handleOpenFastMossDirect}
            className="glass rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors text-left"
          >
            <div>
              <p className="text-sm text-white font-medium">Tìm kiếm Influencer</p>
              <p className="text-xs text-white/50">Mở trang tìm kiếm FastMoss</p>
            </div>
            <ArrowRight className="w-5 h-5 text-white/30" />
          </button>
          
          <button 
            onClick={() => window.electronAPI.openFastMossDetail('https://www.fastmoss.com/vi/influencer/ranking')}
            className="glass rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors text-left"
          >
            <div>
              <p className="text-sm text-white font-medium">Xếp hạng Influencer</p>
              <p className="text-xs text-white/50">Top influencers trên TikTok Shop</p>
            </div>
            <ArrowRight className="w-5 h-5 text-white/30" />
          </button>
          
          <button 
            onClick={() => window.electronAPI.openFastMossDetail('https://www.fastmoss.com/vi/product/search')}
            className="glass rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors text-left"
          >
            <div>
              <p className="text-sm text-white font-medium">Tìm kiếm Sản phẩm</p>
              <p className="text-xs text-white/50">Tìm sản phẩm hot trên TikTok Shop</p>
            </div>
            <ArrowRight className="w-5 h-5 text-white/30" />
          </button>
          
          <button 
            onClick={() => window.electronAPI.openFastMossDetail('https://www.fastmoss.com/vi/video/search')}
            className="glass rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors text-left"
          >
            <div>
              <p className="text-sm text-white font-medium">Tìm kiếm Video</p>
              <p className="text-xs text-white/50">Video bán hàng trending</p>
            </div>
            <ArrowRight className="w-5 h-5 text-white/30" />
          </button>
        </div>
      </Card>

      {/* Note */}
      <p className="text-xs text-white/30 text-center">
        Tính năng này yêu cầu tài khoản FastMoss. Cookies được sử dụng để xác thực session.
      </p>
    </div>
  );
}

export default Influencer;
