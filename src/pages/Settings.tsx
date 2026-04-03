import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Folder,
  Clipboard,
  Download,
  Info,
  CheckCircle,
  XCircle,
  RefreshCw,
  Save,
  Trash2,
  Users,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/Loading';
import { Settings as SettingsType, AppInfo, YtdlpStatus } from '../types/electron.d';

function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [ytdlpStatus, setYtdlpStatus] = useState<YtdlpStatus | null>(null);
  // Anthropic API Key
  const [anthropicKey, setAnthropicKey] = useState('');
  const [anthropicKeySaved, setAnthropicKeySaved] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  // FastMoss cookies
  const [fastmossCookies, setFastmossCookies] = useState('');
  const [fastmossCookieSaved, setFastmossCookieSaved] = useState(false);
  // Password protection for cookies section
  const COOKIES_PASSWORD = 'Phong@97';
  const [cookiesUnlocked, setCookiesUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleUnlockCookies = () => {
    if (passwordInput === COOKIES_PASSWORD) {
      setCookiesUnlocked(true);
      setPasswordError(false);
      setPasswordInput('');
    } else {
      setPasswordError(true);
      setPasswordInput('');
    }
  };

  // Fetch settings
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [settingsResult, appInfoResult, ytdlpResult] = await Promise.all([
          window.electronAPI.getSettings(),
          window.electronAPI.getAppInfo(),
          window.electronAPI.checkYtdlp()
        ]);

        if (settingsResult.success && settingsResult.data) {
          setSettings(settingsResult.data);
          // Load saved Anthropic API Key
          if ((settingsResult.data as any).anthropicApiKey) {
            setAnthropicKey((settingsResult.data as any).anthropicApiKey);
            setAnthropicKeySaved(true);
          }
          // Load saved FastMoss cookies
          if ((settingsResult.data as any).fastmossCookies) {
            setFastmossCookies((settingsResult.data as any).fastmossCookies);
            setFastmossCookieSaved(true);
          }
        }
        setAppInfo(appInfoResult);
        setYtdlpStatus(ytdlpResult);
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Save setting
  const saveSetting = async (key: string, value: string) => {
    setSaving(true);
    try {
      await window.electronAPI.setSetting(key, value);
      setSettings(prev => prev ? { ...prev, [key]: value } : null);
    } catch (err) {
      console.error('Failed to save setting:', err);
    } finally {
      setSaving(false);
    }
  };

  // Select download folder
  const handleSelectFolder = async () => {
    const result = await window.electronAPI.selectFolder();
    if (result.success && result.path) {
      await saveSetting('downloadPath', result.path);
    }
  };

  // Toggle auto paste
  const handleToggleAutoPaste = async () => {
    if (!settings) return;
    const newValue = settings.autoPasteClipboard === 'true' ? 'false' : 'true';
    await saveSetting('autoPasteClipboard', newValue);
  };

  // Change max concurrent downloads
  const handleMaxDownloadsChange = async (value: string) => {
    await saveSetting('maxConcurrentDownloads', value);
  };

  // Refresh yt-dlp status
  const refreshYtdlpStatus = async () => {
    const result = await window.electronAPI.checkYtdlp();
    setYtdlpStatus(result);
  };

  // Save Anthropic API Key
  const handleSaveAnthropicKey = async () => {
    if (!anthropicKey.trim()) return;
    setSaving(true);
    try {
      await window.electronAPI.setSetting('anthropicApiKey', anthropicKey.trim());
      setAnthropicKeySaved(true);
    } catch (err) {
      console.error('Failed to save Anthropic API key:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleClearAnthropicKey = async () => {
    setSaving(true);
    try {
      await window.electronAPI.setSetting('anthropicApiKey', '');
      setAnthropicKey('');
      setAnthropicKeySaved(false);
    } catch (err) {
      console.error('Failed to clear Anthropic API key:', err);
    } finally {
      setSaving(false);
    }
  };

  // Save FastMoss cookies
  const handleSaveFastmossCookies = async () => {
    if (!fastmossCookies.trim()) return;
    setSaving(true);
    try {
      await window.electronAPI.setSetting('fastmossCookies', fastmossCookies.trim());
      setFastmossCookieSaved(true);
    } catch (err) {
      console.error('Failed to save FastMoss cookies:', err);
    } finally {
      setSaving(false);
    }
  };

  // Clear FastMoss cookies
  const handleClearFastmossCookies = async () => {
    setSaving(true);
    try {
      await window.electronAPI.setSetting('fastmossCookies', '');
      setFastmossCookies('');
      setFastmossCookieSaved(false);
    } catch (err) {
      console.error('Failed to clear FastMoss cookies:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500/20 to-slate-500/20 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-white">Settings</h3>
            <p className="text-sm text-white/50">Configure your app preferences</p>
          </div>
        </div>
      </Card>

      {/* Download Settings */}
      <Card>
        <h4 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-tiktok-cyan" />
          Download Settings
        </h4>

        {/* Download Path */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-white/70">Download Location</label>
              <button 
                onClick={handleSelectFolder}
                className="btn btn-secondary btn-sm"
              >
                <Folder className="w-4 h-4" />
                Change
              </button>
            </div>
            <p className="text-sm text-white font-mono truncate">{settings?.downloadPath}</p>
          </div>

          {/* Auto Paste */}
          <div className="glass rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clipboard className="w-5 h-5 text-white/50" />
              <div>
                <p className="text-sm text-white">Auto-paste from clipboard</p>
                <p className="text-xs text-white/40">Automatically detect TikTok URLs from clipboard</p>
              </div>
            </div>
            <button 
              onClick={handleToggleAutoPaste}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings?.autoPasteClipboard === 'true' 
                  ? 'bg-tiktok-red' 
                  : 'bg-white/10'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings?.autoPasteClipboard === 'true' 
                  ? 'translate-x-6' 
                  : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Max Concurrent Downloads */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Max concurrent downloads</p>
                <p className="text-xs text-white/40">Number of simultaneous downloads</p>
              </div>
              <select 
                value={settings?.maxConcurrentDownloads || '3'}
                onChange={(e) => handleMaxDownloadsChange(e.target.value)}
                className="bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:ring-2 focus:ring-tiktok-red/50"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="10">10</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* FastMoss Cookies */}
      {/* ── Anthropic API Key ── */}
      <Card>
        <h4 className="font-display font-semibold text-white mb-1 flex items-center gap-2">
          <span>🤖</span>
          AI Analysis — Anthropic API Key
          {anthropicKeySaved && <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />}
        </h4>
        <p className="text-xs text-white/40 mb-4">
          Dùng cho tính năng "AI Phân tích KOC". Lấy key tại{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-tiktok-cyan hover:underline">
            console.anthropic.com
          </a>
          {' '}→ API Keys → Create Key.
        </p>
        <div className="relative">
          <input
            type={showAnthropicKey ? 'text' : 'password'}
            value={anthropicKey}
            onChange={(e) => { setAnthropicKey(e.target.value); setAnthropicKeySaved(false); }}
            placeholder="sk-ant-api03-..."
            className="input w-full pr-10 font-mono text-sm"
          />
          <button
            onClick={() => setShowAnthropicKey(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
          >
            {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {anthropicKeySaved && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> API Key đã lưu
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleClearAnthropicKey} disabled={!anthropicKey && !anthropicKeySaved} className="btn btn-ghost btn-sm">
              <Trash2 className="w-4 h-4" /> Xóa
            </button>
            <button onClick={handleSaveAnthropicKey} disabled={!anthropicKey.trim() || saving} className="btn btn-primary btn-sm">
              {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />} Lưu
            </button>
          </div>
        </div>
      </Card>

      {/* ── FastMoss Cookies ── */}
      <Card>
        <h4 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          FastMoss Cookies (for Influencer Analytics)
          <Lock className="w-4 h-4 text-yellow-400 ml-auto" />
        </h4>

        {!cookiesUnlocked ? (
          /* Password lock screen */
          <div className="glass rounded-xl p-6 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Lock className="w-7 h-7 text-yellow-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white mb-1">Khu vực bảo mật</p>
              <p className="text-xs text-white/50">Nhập mật khẩu để quản lý FastMoss Cookies</p>
            </div>
            <div className="w-full max-w-xs space-y-3">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUnlockCookies(); }}
                  placeholder="Nhập mật khẩu..."
                  className={`w-full bg-black/30 text-white text-sm rounded-lg px-4 py-2.5 pr-10 border focus:outline-none focus:ring-2 ${
                    passwordError
                      ? 'border-red-500/60 focus:ring-red-500/40'
                      : 'border-white/10 focus:ring-purple-500/50'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Mật khẩu không đúng
                </p>
              )}
              <button
                onClick={handleUnlockCookies}
                disabled={!passwordInput}
                className="btn btn-primary w-full"
              >
                <Lock className="w-4 h-4" />
                Mở khóa
              </button>
            </div>
          </div>
        ) : (
          /* Unlocked — show cookies management */
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Đã mở khóa
              </span>
              <button
                onClick={() => setCookiesUnlocked(false)}
                className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1"
              >
                <Lock className="w-3 h-3" /> Khoá lại
              </button>
            </div>

            <div className="glass rounded-xl p-4">
              <p className="text-sm text-white/70 mb-3">
                Để sử dụng tính năng Influencer Analytics, bạn cần cung cấp cookies từ FastMoss.
              </p>
              <div className="space-y-3">
                <p className="text-xs text-white/50">Cách lấy cookies:</p>
                <ol className="text-xs text-white/40 list-decimal list-inside space-y-1">
                  <li>Đăng nhập vào <a href="https://www.fastmoss.com" target="_blank" rel="noopener noreferrer" className="text-tiktok-cyan hover:underline">fastmoss.com</a></li>
                  <li>Mở DevTools (F12) → Application → Cookies</li>
                  <li>Click vào "fastmoss.com" trong danh sách</li>
                  <li>Select All (Ctrl+A) → Copy (Ctrl+C)</li>
                  <li>Hoặc dùng extension "EditThisCookie" để export JSON</li>
                  <li>Paste cookies vào ô bên dưới</li>
                </ol>
              </div>
            </div>

            <div className="glass rounded-xl p-4">
              <label className="text-sm text-white/70 mb-2 block">Cookies (JSON hoặc Netscape format)</label>
              <textarea
                value={fastmossCookies}
                onChange={(e) => {
                  setFastmossCookies(e.target.value);
                  setFastmossCookieSaved(false);
                }}
                placeholder='[{"name":"session_id","value":"xxx","domain":".fastmoss.com"}]&#10;hoặc&#10;# Netscape HTTP Cookie File&#10;.fastmoss.com	TRUE	/	TRUE	...'
                className="w-full h-32 bg-black/30 text-white text-xs font-mono rounded-lg p-3 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
              />
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  {fastmossCookieSaved && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      FastMoss cookies saved
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearFastmossCookies}
                    disabled={!fastmossCookies && !fastmossCookieSaved}
                    className="btn btn-ghost btn-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                  <button
                    onClick={handleSaveFastmossCookies}
                    disabled={!fastmossCookies.trim() || saving}
                    className="btn btn-primary btn-sm"
                  >
                    {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
                    Save Cookies
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Cookies Not Configured Warning */}
      {!fastmossCookieSaved && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-yellow-400 mb-2">FastMoss Cookies Chưa Cấu Hình</h4>
              <p className="text-sm text-white/70">
                Để sử dụng tính năng Influencer Analytics, vui lòng cấu hình FastMoss cookies ở trên.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default Settings;
