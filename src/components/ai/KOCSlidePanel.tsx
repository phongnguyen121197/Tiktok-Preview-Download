import { useEffect, useRef, useState } from 'react';
import {
  X, Download, TrendingUp, Users, Video, Star,
  CheckCircle, AlertTriangle, Info, Loader2,
  ChevronRight, Award, ShoppingBag, Target
} from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { KOCAnalysisResult, KOCProgressEvent } from '../../types/electron.d';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  authorId: string;
  username: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Mở trang KOC trên FastMoss' },
  { label: 'Thu thập GMV & tổng quan' },
  { label: 'Phân tích khán giả' },
  { label: 'Đọc top video & sản phẩm' },
  { label: 'AI đang phân tích dữ liệu' },
];

const scoreColor = (s: number) =>
  s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444';

const scoreBg = (s: number) =>
  s >= 75 ? 'bg-green-500/10 text-green-400' : s >= 50 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400';

const recLabel: Record<string, string> = {
  excellent: 'Xuất sắc', good: 'Tốt', fair: 'Trung bình', poor: 'Yếu'
};

const tierColors: Record<string, string> = {
  nano: 'bg-slate-500/20 text-slate-300',
  micro: 'bg-blue-500/20 text-blue-300',
  mid: 'bg-purple-500/20 text-purple-300',
  macro: 'bg-orange-500/20 text-orange-300',
  mega: 'bg-red-500/20 text-red-300',
};

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e'];

// ─── Sub-components ────────────────────────────────────────────────────────

function ScoreRing({ score, label }: { score: number; label: string }) {
  const data = [{ value: score }, { value: 100 - score }];
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%"
            startAngle={90} endAngle={-270} data={[{ value: score, fill: scoreColor(score) }]}>
            <RadialBar dataKey="value" cornerRadius={4} background={{ fill: '#1e293b' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-white">{score}</span>
        </div>
      </div>
      <span className="text-xs text-white/50 mt-1 text-center">{label}</span>
    </div>
  );
}

function ProgressView({ progress }: { progress: KOCProgressEvent | null }) {
  return (
    <div className="flex flex-col h-full justify-center px-8 py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          <h3 className="font-semibold text-white text-lg">Đang phân tích KOC...</h3>
        </div>
        <p className="text-sm text-white/50">
          Bạn có thể xem số liệu trên cửa sổ FastMoss trong lúc chờ nhé!
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-8">
        {STEPS.map((step, i) => {
          const stepNum = i + 1;
          const currentStep = progress?.step ?? 0;
          const isDone = stepNum < currentStep || (stepNum === currentStep && progress?.status === 'done');
          const isActive = stepNum === currentStep && progress?.status === 'running';
          return (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all ${
                isDone ? 'bg-green-500 text-white' :
                isActive ? 'bg-purple-500 text-white' :
                'bg-white/10 text-white/40'
              }`}>
                {isDone ? <CheckCircle className="w-4 h-4" /> : stepNum}
              </div>
              <span className={`text-sm transition-all ${
                isDone ? 'text-green-400' :
                isActive ? 'text-white font-medium' :
                'text-white/40'
              }`}>
                {isActive ? (progress?.label || step.label) : step.label}
              </span>
              {isActive && <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin ml-auto" />}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-700"
          style={{ width: `${progress?.percent ?? 0}%` }}
        />
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-xs text-white/40">{progress?.label || 'Đang khởi động...'}</span>
        <span className="text-xs text-white/40">{progress?.percent ?? 0}%</span>
      </div>
    </div>
  );
}

function ResultView({ result, onExport }: { result: KOCAnalysisResult; onExport: () => void }) {
  const { scrapeData, computed, analysis } = result;
  const { overview, audience, sales } = scrapeData;
  const brand = analysis?.brand_recommendation;

  // Chart data
  const scoreData = [
    { name: 'Bán hàng', score: analysis?.sales_capability?.score ?? 0 },
    { name: 'Khán giả', score: analysis?.audience_quality?.score ?? 0 },
    { name: 'Nội dung', score: analysis?.content_quality?.score ?? 0 },
  ];

  const audienceGenderData = [
    { name: 'Nam', value: parseFloat(audience?.gender_male?.replace('%', '') || '0') },
    { name: 'Nữ', value: parseFloat(audience?.gender_female?.replace('%', '') || '0') },
  ];

  const categoryData = (sales?.top_categories || []).slice(0, 4).map((c: any) => ({
    name: c.name?.slice(0, 15),
    value: parseFloat(c.percent?.replace('%', '') || '0'),
  }));

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* Header Result */}
      <div className="px-6 py-5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">@{result.username}</h3>
            <p className="text-xs text-white/40">{new Date(result.createdAt).toLocaleString('vi-VN')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tierColors[brand?.tier || 'micro']}`}>
              {brand?.tier?.toUpperCase()}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${scoreBg(brand?.overall_score || 0)}`}>
              {recLabel[brand?.recommendation || ''] || ''}
            </span>
          </div>
        </div>

        {/* Score rings */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center">
            <div className="text-3xl font-black" style={{ color: scoreColor(brand?.overall_score || 0) }}>
              {brand?.overall_score ?? '--'}
            </div>
            <div className="text-xs text-white/40">Điểm tổng</div>
          </div>
          <div className="flex gap-4">
            <ScoreRing score={analysis?.sales_capability?.score ?? 0} label="Bán hàng" />
            <ScoreRing score={analysis?.audience_quality?.score ?? 0} label="Khán giả" />
            <ScoreRing score={analysis?.content_quality?.score ?? 0} label="Nội dung" />
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-5">

        {/* Section 1: Năng lực bán hàng */}
        <Section icon={<TrendingUp className="w-4 h-4 text-indigo-400" />} title="Năng lực bán hàng" score={analysis?.sales_capability?.score}>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              ['GMV Video', overview?.gmv_video],
              ['GMV Livestream', overview?.gmv_livestream],
              ['Video bán hàng', `${overview?.sales_videos} (${computed?.video_sales_ratio})`],
              ['Est. GMV/video', computed?.est_gmv_per_video],
              ['GPM 28 ngày', overview?.gpm_video_28d],
              ['Cửa hàng HT', sales?.partner_stores],
            ].map(([l, v]) => (
              <div key={l} className="glass rounded-lg p-2">
                <div className="text-xs text-white/40 mb-0.5">{l}</div>
                <div className="text-sm font-semibold text-white truncate">{v || 'N/A'}</div>
              </div>
            ))}
          </div>
          <AIComment text={analysis?.sales_capability?.ai_comment} />
          <Tags items={analysis?.sales_capability?.highlights} color="indigo" />
          {/* Top categories chart */}
          {categoryData.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-white/40 mb-2">Ngành hàng chính</div>
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={4}>
                    {categoryData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        {/* Top 5 videos */}
        {sales?.top_videos?.length > 0 && (
          <Section icon={<Video className="w-4 h-4 text-pink-400" />} title="Top 5 Video Doanh Thu Cao Nhất">
            <div className="space-y-2">
              {sales.top_videos.slice(0, 5).map((v: any, i: number) => (
                <div key={i} className="glass rounded-lg p-2.5">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-white/40 w-4 flex-shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white font-medium truncate">{v.title || 'N/A'}</div>
                      <div className="flex gap-3 mt-1 text-xs text-white/50">
                        <span className="text-indigo-400 font-semibold">{v.revenue || '-'}</span>
                        <span>{v.views || '-'} views</span>
                        <span>ER: {v.engagement_rate || '-'}</span>
                      </div>
                      {v.product_name && (
                        <div className="text-xs text-white/40 mt-0.5 truncate">📦 {v.product_name}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Section 2: Chất lượng khán giả */}
        <Section icon={<Users className="w-4 h-4 text-cyan-400" />} title="Chất lượng khán giả" score={analysis?.audience_quality?.score}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-xs text-white/40 mb-2">Giới tính</div>
              <ResponsiveContainer width="100%" height={100}>
                <PieChart>
                  <Pie data={audienceGenderData} cx="50%" cy="50%" innerRadius={25} outerRadius={45} dataKey="value">
                    {audienceGenderData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                  </Pie>
                  <Legend iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#94a3b8' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="text-xs text-white/40 mb-2">Độ tuổi</div>
              {[['18-24', audience?.age_18_24], ['25-34', audience?.age_25_34], ['35-44', audience?.age_35_44], ['45+', audience?.age_45_plus]].map(([l, v]) => (
                v ? <div key={l} className="flex justify-between text-xs mb-1">
                  <span className="text-white/50">{l}</span>
                  <span className="text-white font-medium">{v}</span>
                </div> : null
              ))}
              <div className="mt-2 pt-2 border-t border-white/10">
                <div className="text-xs text-white/40 mb-1">Fan tiềm năng</div>
                <div className="text-sm font-bold text-purple-400">{audience?.fan_potential || 'N/A'}</div>
              </div>
            </div>
          </div>
          {(audience?.region_top || []).length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-white/40 mb-2">Khu vực</div>
              {audience.region_top.slice(0, 4).map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-white/50 w-24 truncate">{r.name}</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full" style={{ width: r.percent }} />
                  </div>
                  <span className="text-xs text-white/70 w-10 text-right">{r.percent}</span>
                </div>
              ))}
            </div>
          )}
          <AIComment text={analysis?.audience_quality?.ai_comment} />
        </Section>

        {/* Section 3: Chất lượng nội dung */}
        <Section icon={<Video className="w-4 h-4 text-amber-400" />} title="Chất lượng nội dung" score={analysis?.content_quality?.score}>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              ['Trung vị views', overview?.median_views],
              ['ER trung bình', overview?.avg_engagement_rate],
              ['Est. GMV/video', computed?.est_gmv_per_video],
              ['GPM Video 28 ngày', overview?.gpm_video_28d],
            ].map(([l, v]) => (
              <div key={l} className="glass rounded-lg p-2">
                <div className="text-xs text-white/40 mb-0.5">{l}</div>
                <div className="text-sm font-semibold text-white truncate">{v || 'N/A'}</div>
              </div>
            ))}
          </div>
          <AIComment text={analysis?.content_quality?.ai_comment} />
          <Tags items={analysis?.content_quality?.highlights} color="amber" />
        </Section>

        {/* Section 4: Đề xuất brand */}
        <Section icon={<Target className="w-4 h-4 text-rose-400" />} title="Đề xuất cho Brand">
          <div className="mb-3">
            <div className="text-xs text-white/40 mb-2">Ngành hàng phù hợp</div>
            <div className="flex flex-wrap gap-1.5">
              {(brand?.fit_categories || []).map((c: string, i: number) => (
                <span key={i} className="px-2 py-1 rounded-full text-xs bg-indigo-500/20 text-indigo-300">{c}</span>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <div className="text-xs text-white/40 mb-2">Chiến lược nội dung</div>
            <ul className="space-y-1.5">
              {(brand?.content_strategy || []).map((s: string, i: number) => (
                <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 text-indigo-400 flex-shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="mb-3">
            <div className="text-xs text-white/40 mb-2">Gợi ý</div>
            <ul className="space-y-1.5">
              {(brand?.suggestions || []).map((s: string, i: number) => (
                <li key={i} className="text-xs text-green-400/80 flex items-start gap-2">
                  <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          {(brand?.risks || []).length > 0 && (
            <div>
              <div className="text-xs text-white/40 mb-2">Rủi ro / Lưu ý</div>
              <ul className="space-y-1.5">
                {brand.risks.map((r: string, i: number) => (
                  <li key={i} className="text-xs text-red-400/80 flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      </div>

      {/* Export button */}
      <div className="px-6 py-4 border-t border-white/10 flex-shrink-0">
        <button
          onClick={onExport}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-sm transition-all"
        >
          <Download className="w-4 h-4" />
          Tải xuống báo cáo HTML
        </button>
      </div>
    </div>
  );
}

function Section({ icon, title, score, children }: { icon: React.ReactNode; title: string; score?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-white/5">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        {score !== undefined && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreBg(score)}`}>{score}/100</span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function AIComment({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 mb-2">
      <Info className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-white/70 leading-relaxed">{text}</p>
    </div>
  );
}

function Tags({ items, color }: { items?: string[]; color: string }) {
  if (!items?.length) return null;
  const cls: Record<string, string> = {
    indigo: 'bg-indigo-500/20 text-indigo-300',
    amber: 'bg-amber-500/20 text-amber-300',
    green: 'bg-green-500/20 text-green-300',
  };
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((t, i) => <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${cls[color] || cls.indigo}`}>{t}</span>)}
    </div>
  );
}

// ─── Main KOCSlidePanel ────────────────────────────────────────────────────

export default function KOCSlidePanel({ open, onClose, authorId, username }: Props) {
  const [progress, setProgress] = useState<KOCProgressEvent | null>(null);
  const [result, setResult] = useState<KOCAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Bắt đầu phân tích khi panel mở
  useEffect(() => {
    if (!open || !authorId) return;
    setResult(null);
    setError(null);
    setProgress(null);
    setIsAnalyzing(true);

    // Lắng nghe progress events
    const unsubscribe = window.electronAPI.onKOCProgress((p) => {
      setProgress(p);
      if (p.status === 'done') setIsAnalyzing(false);
      if (p.status === 'error') {
        setError(p.label);
        setIsAnalyzing(false);
      }
    });
    cleanupRef.current = unsubscribe;

    // Gọi analyze
    window.electronAPI.analyzeKOC(authorId, username)
      .then((res) => {
        if (res.success && res.data) {
          setResult(res.data);
        } else {
          setError(res.error || 'Phân tích thất bại');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsAnalyzing(false));

    return () => { cleanupRef.current?.(); };
  }, [open, authorId, username]);

  // Cleanup khi đóng
  const handleClose = () => {
    cleanupRef.current?.();
    setProgress(null);
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
    onClose();
  };

  const handleExport = async () => {
    if (!result?.id) return;
    await window.electronAPI.exportKOCReport(result.id);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full w-[480px] z-50 flex flex-col bg-[#0f172a] border-l border-white/10 shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center">
              <Star className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">AI Phân Tích KOC</h2>
              <p className="text-xs text-white/40">@{username} • Claude Haiku 4.5</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-hidden">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full px-8 gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-medium mb-1">Phân tích thất bại</p>
                <p className="text-sm text-white/50">{error}</p>
              </div>
              <button onClick={handleClose} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors">
                Đóng
              </button>
            </div>
          ) : result ? (
            <ResultView result={result} onExport={handleExport} />
          ) : (
            <ProgressView progress={progress} />
          )}
        </div>
      </div>
    </>
  );
}
