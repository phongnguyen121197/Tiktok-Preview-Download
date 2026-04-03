import { useEffect, useRef } from 'react';
import {
  Loader2, CheckCircle, AlertTriangle, Info, Download,
  ChevronRight, TrendingUp, Users, Video, Target,
  BarChart2, Sparkles, RefreshCw
} from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { useKOCStore } from '../stores/kocStore';
import { KOCAnalysisResult, KOCProgressEvent } from '../types/electron.d';
import Card from '../components/ui/Card';

// ─── Constants ─────────────────────────────────────────────────────────────

const STEPS = [
  'Mở FastMoss trong nền',
  'Thu thập GMV & tổng quan',
  'Đọc dữ liệu khán giả',
  'Đọc top video & sản phẩm',
  'AI đang phân tích dữ liệu',
];

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e'];

const scoreColor = (s: number) =>
  s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444';

const scoreBg = (s: number) =>
  s >= 75 ? 'bg-green-500/10 text-green-400 border-green-500/20'
  : s >= 50 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  : 'bg-red-500/10 text-red-400 border-red-500/20';

const recLabel: Record<string, string> = {
  excellent: '🌟 Xuất sắc', good: '✅ Tốt', fair: '⚠️ Trung bình', poor: '❌ Yếu'
};

const tierLabel: Record<string, string> = {
  nano: 'Nano (<10K)', micro: 'Micro (10K-100K)',
  mid: 'Mid (100K-500K)', macro: 'Macro (500K-1M)', mega: 'Mega (>1M)'
};

// ─── Sub components ─────────────────────────────────────────────────────────

function ScoreRing({ score, label, size = 'md' }: { score: number; label: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 120 : size === 'md' ? 88 : 64;
  const fontSize = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-base';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: dim, height: dim }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="62%" outerRadius="100%"
            startAngle={90} endAngle={-270} data={[{ value: score, fill: scoreColor(score) }]}>
            <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#1e293b' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-black text-white ${fontSize}`}>{score}</span>
        </div>
      </div>
      <span className="text-xs text-white/50 text-center">{label}</span>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-xs text-white/40 mb-1">{label}</div>
      <div className="text-sm font-bold text-white truncate">{value || 'N/A'}</div>
      {sub && <div className="text-xs text-white/30 mt-0.5">{sub}</div>}
    </div>
  );
}

function AIComment({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
      <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-white/75 leading-relaxed">{text}</p>
    </div>
  );
}

function SectionCard({ icon, title, score, children }: {
  icon: React.ReactNode; title: string; score?: number; children: React.ReactNode
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">{icon}</div>
          <h3 className="font-display font-semibold text-white">{title}</h3>
        </div>
        {score !== undefined && (
          <span className={`text-sm font-bold px-3 py-1 rounded-full border ${scoreBg(score)}`}>
            {score}/100
          </span>
        )}
      </div>
      {children}
    </Card>
  );
}

// ─── Progress View ───────────────────────────────────────────────────────────

function ProgressView({ progress, username }: { progress: KOCProgressEvent | null; username: string }) {
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-white">AI đang phân tích @{username}</h2>
            <p className="text-sm text-white/50">
              Đang thu thập dữ liệu từ FastMoss và phân tích, vui lòng chờ...
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-6">
          {STEPS.map((step, i) => {
            const n = i + 1;
            const cur = progress?.step ?? 0;
            const done = n < cur || (n === cur && progress?.status === 'done');
            const active = n === cur && progress?.status === 'running';
            return (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all ${
                  done ? 'bg-green-500 text-white' : active ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/30'
                }`}>
                  {done ? <CheckCircle className="w-4 h-4" /> : n}
                </div>
                <div className="flex-1">
                  <span className={`text-sm ${done ? 'text-green-400' : active ? 'text-white font-medium' : 'text-white/30'}`}>
                    {active ? (progress?.label || step) : step}
                  </span>
                </div>
                {active && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                {done && <CheckCircle className="w-4 h-4 text-green-400" />}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
            style={{ width: `${progress?.percent ?? 0}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-white/40">{progress?.label || 'Đang khởi động...'}</span>
          <span className="text-xs text-white/40">{progress?.percent ?? 0}%</span>
        </div>
      </Card>
    </div>
  );
}

// ─── Result View ─────────────────────────────────────────────────────────────

function ResultView({ result, onExport, onReAnalyze }: {
  result: KOCAnalysisResult;
  onExport: () => void;
  onReAnalyze: () => void;
}) {
  const { scrapeData, computed, analysis } = result;
  const { overview, audience, sales } = scrapeData;
  const brand = analysis?.brand_recommendation;

  const scoreData = [
    { name: 'Bán hàng', value: analysis?.sales_capability?.score ?? 0 },
    { name: 'Khán giả', value: analysis?.audience_quality?.score ?? 0 },
    { name: 'Nội dung', value: analysis?.content_quality?.score ?? 0 },
  ];

  const genderData = [
    { name: 'Nam', value: parseFloat(audience?.gender_male?.replace('%', '') || '0') },
    { name: 'Nữ', value: parseFloat(audience?.gender_female?.replace('%', '') || '0') },
  ];

  const catData = (sales?.top_categories || []).slice(0, 5).map((c: any) => ({
    name: c.name?.length > 16 ? c.name.slice(0, 16) + '…' : c.name,
    value: parseFloat(c.percent?.replace('%', '') || '0'),
  }));

  return (
    <div className="space-y-6">

      {/* ── Header tổng quan ── */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Left: tổng điểm */}
          <div className="flex flex-col items-center lg:items-start gap-2">
            <div className="text-6xl font-black" style={{ color: scoreColor(brand?.overall_score ?? 0) }}>
              {brand?.overall_score ?? '--'}
              <span className="text-2xl text-white/30">/100</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {tierLabel[brand?.tier || ''] || brand?.tier}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${scoreBg(brand?.overall_score ?? 0)}`}>
                {recLabel[brand?.recommendation || ''] || brand?.recommendation}
              </span>
            </div>
            <p className="text-xs text-white/40">@{result.username} • {new Date(result.createdAt).toLocaleString('vi-VN')}</p>
          </div>

          {/* Middle: 3 score rings */}
          <div className="flex gap-6 justify-center lg:justify-start">
            <ScoreRing score={analysis?.sales_capability?.score ?? 0} label="Bán hàng" size="md" />
            <ScoreRing score={analysis?.audience_quality?.score ?? 0} label="Khán giả" size="md" />
            <ScoreRing score={analysis?.content_quality?.score ?? 0} label="Nội dung" size="md" />
          </div>

          {/* Right: score bar chart */}
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={scoreData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="name" width={60} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v}/100`]} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={6}>
                  {scoreData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button onClick={onExport} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white text-sm font-medium transition-all whitespace-nowrap">
              <Download className="w-4 h-4" /> Tải báo cáo HTML
            </button>
            <button onClick={onReAnalyze} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-white/60 hover:text-white text-sm transition-all whitespace-nowrap">
              <RefreshCw className="w-4 h-4" /> Phân tích lại
            </button>
          </div>
        </div>
      </Card>

      {/* ── 2 columns layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Col 1 */}
        <div className="space-y-6">

          {/* Năng lực bán hàng */}
          <SectionCard icon={<TrendingUp className="w-4 h-4 text-indigo-400" />} title="Năng lực bán hàng" score={analysis?.sales_capability?.score}>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <MetricCard label="GMV Video" value={overview?.gmv_video} />
              <MetricCard label="GMV Livestream" value={overview?.gmv_livestream} />
              <MetricCard label="Video bán hàng" value={overview?.sales_videos} sub={`Tỷ lệ: ${computed?.video_sales_ratio}`} />
              <MetricCard label="Est. GMV/video" value={computed?.est_gmv_per_video} />
              <MetricCard label="GPM Video 28 ngày" value={overview?.gpm_video_28d} />
              <MetricCard label="Cửa hàng hợp tác" value={sales?.partner_stores} />
            </div>
            {catData.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-white/40 mb-2">Ngành hàng chính</p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={catData} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" radius={4}>
                      {catData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % 5]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <AIComment text={analysis?.sales_capability?.ai_comment} />
            {(analysis?.sales_capability?.highlights || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {analysis.sales_capability.highlights.map((h: string, i: number) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">{h}</span>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Top 5 videos */}
          {(sales?.top_videos || []).length > 0 && (
            <SectionCard icon={<Video className="w-4 h-4 text-pink-400" />} title="Top 5 Video Doanh Thu Cao Nhất">
              <div className="space-y-2">
                {sales.top_videos.slice(0, 5).map((v: any, i: number) => (
                  <div key={i} className="glass rounded-xl p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="text-xs font-black text-white/30 w-5 flex-shrink-0 mt-0.5">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{v.title || 'N/A'}</p>
                        <div className="flex gap-3 mt-1 text-xs flex-wrap">
                          <span className="text-indigo-400 font-bold">{v.revenue || '-'}</span>
                          <span className="text-white/50">{v.views || '-'} views</span>
                          <span className="text-white/50">ER: {v.engagement_rate || '-'}</span>
                        </div>
                        {v.product_name && (
                          <p className="text-xs text-white/35 mt-0.5 truncate">📦 {v.product_name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {/* Col 2 */}
        <div className="space-y-6">

          {/* Chất lượng khán giả */}
          <SectionCard icon={<Users className="w-4 h-4 text-cyan-400" />} title="Chất lượng khán giả" score={analysis?.audience_quality?.score}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-white/40 mb-2">Giới tính</p>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie data={genderData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value" paddingAngle={3}>
                      {genderData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                    </Pie>
                    <Legend iconSize={8} iconType="circle" formatter={(v) => <span style={{ fontSize: 11, color: '#94a3b8' }}>{v}</span>} />
                    <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-2">Độ tuổi</p>
                {[['18-24', audience?.age_18_24], ['25-34', audience?.age_25_34], ['35-44', audience?.age_35_44], ['45+', audience?.age_45_plus]].map(([l, v]) =>
                  v ? (
                    <div key={l} className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-white/50 w-12">{l}</span>
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full" style={{ width: v }} />
                      </div>
                      <span className="text-xs font-semibold text-white w-10 text-right">{v}</span>
                    </div>
                  ) : null
                )}
              </div>
            </div>

            {(audience?.region_top || []).length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-white/40 mb-2">Khu vực top</p>
                {audience.region_top.slice(0, 4).map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs text-white/50 w-28 truncate">{r.name}</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full">
                      <div className="h-full rounded-full" style={{ width: r.percent, background: CHART_COLORS[i % 5] }} />
                    </div>
                    <span className="text-xs font-semibold text-white w-10 text-right">{r.percent}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4">
              <MetricCard label="Fan tích cực" value={audience?.fan_active || 'N/A'} />
              <MetricCard label="Fan tiềm năng" value={audience?.fan_potential || 'N/A'} />
            </div>
            <AIComment text={analysis?.audience_quality?.ai_comment} />
          </SectionCard>

          {/* Chất lượng nội dung */}
          <SectionCard icon={<BarChart2 className="w-4 h-4 text-amber-400" />} title="Chất lượng nội dung" score={analysis?.content_quality?.score}>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <MetricCard label="Trung vị views" value={overview?.median_views} />
              <MetricCard label="ER trung bình" value={overview?.avg_engagement_rate} />
              <MetricCard label="Est. GMV/video BH" value={computed?.est_gmv_per_video} />
              <MetricCard label="GPM Video 28 ngày" value={overview?.gpm_video_28d} />
            </div>
            <AIComment text={analysis?.content_quality?.ai_comment} />
            {(analysis?.content_quality?.highlights || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {analysis.content_quality.highlights.map((h: string, i: number) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">{h}</span>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Đề xuất Brand */}
          <SectionCard icon={<Target className="w-4 h-4 text-rose-400" />} title="Đề xuất cho Brand">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-white/40 mb-2">Ngành hàng phù hợp</p>
                <div className="flex flex-wrap gap-1.5">
                  {(brand?.fit_categories || []).map((c: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/20">{c}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-2">Chiến lược nội dung</p>
                <ul className="space-y-1.5">
                  {(brand?.content_strategy || []).map((s: string, i: number) => (
                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-2">Gợi ý</p>
                <ul className="space-y-1.5">
                  {(brand?.suggestions || []).map((s: string, i: number) => (
                    <li key={i} className="text-sm text-green-400/80 flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              {(brand?.risks || []).length > 0 && (
                <div>
                  <p className="text-xs text-white/40 mb-2">Rủi ro / Lưu ý</p>
                  <ul className="space-y-1.5">
                    {brand.risks.map((r: string, i: number) => (
                      <li key={i} className="text-sm text-red-400/80 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
        <Sparkles className="w-10 h-10 text-indigo-400/50" />
      </div>
      <h3 className="font-display font-semibold text-white/70 text-xl mb-2">Chưa có KOC nào được phân tích</h3>
      <p className="text-white/40 max-w-md">
        Vào <strong>Dashboard</strong>, paste link video TikTok, nhấn Preview rồi bấm nút{' '}
        <span className="text-indigo-400 font-medium">🤖 AI Phân tích</span> để bắt đầu.
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KOCAnalysis() {
  const { target, isAnalyzing, progress, result, error, setProgress, setResult, setError, setAnalyzing, reset } = useKOCStore();
  const unsubRef = useRef<(() => void) | null>(null);
  const didStartRef = useRef(false);

  // Bắt đầu phân tích khi có target mới và chưa có result
  useEffect(() => {
    if (!target || isAnalyzing || result || didStartRef.current) return;
    didStartRef.current = true;
    setAnalyzing(true);

    // Subscribe progress
    unsubRef.current = window.electronAPI.onKOCProgress((p: KOCProgressEvent) => {
      setProgress(p);
    });

    window.electronAPI.analyzeKOC(target.authorId, target.username)
      .then((res) => {
        if (res.success && res.data) {
          setResult(res.data as any);
        } else {
          setError(res.error || 'Phân tích thất bại');
        }
      })
      .catch((err: any) => setError(err.message))
      .finally(() => {
        setAnalyzing(false);
        unsubRef.current?.();
      });

    return () => { unsubRef.current?.(); };
  }, [target]);

  // Reset didStart khi target thay đổi
  useEffect(() => { didStartRef.current = false; }, [target?.authorId]);

  const handleExport = async () => {
    if (!result?.id) return;
    await window.electronAPI.exportKOCReport(result.id);
  };

  const handleReAnalyze = () => {
    if (!target) return;
    reset();
    // trigger lại bằng cách set target mới
    useKOCStore.getState().setTarget(target.authorId, target.username);
    didStartRef.current = false;
  };

  return (
    <div className="space-y-6 stagger-children">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="font-display font-bold text-white text-xl">Phân tích KOC cùng AI</h2>
        </div>
      </div>

      {/* Content */}
      {error ? (
        <Card>
          <div className="flex flex-col items-center py-8 gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold mb-1">Phân tích thất bại</p>
              <p className="text-sm text-white/50 max-w-md">{error}</p>
            </div>
            <button onClick={reset} className="btn btn-secondary">Thử lại</button>
          </div>
        </Card>
      ) : result ? (
        <ResultView result={result} onExport={handleExport} onReAnalyze={handleReAnalyze} />
      ) : isAnalyzing ? (
        <ProgressView progress={progress} username={target?.username || ''} />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
