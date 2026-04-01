import { useState, useEffect } from 'react';
import { 
  History as HistoryIcon,
  Video,
  Clock,
  ExternalLink,
  CheckCircle,
  Eye,
  Trash2,
  Heart,
  MessageCircle,
  Share2,
  Play,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react';
import Card from '../components/ui/Card';
import { Skeleton } from '../components/ui/Loading';
import { VideoHistoryItem } from '../types/electron.d';
import { formatDistanceToNow } from 'date-fns';

function History() {
  const [loading, setLoading] = useState(true);
  const [videoHistory, setVideoHistory] = useState<VideoHistoryItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Fetch history
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getHistory('video', 100);
      if (result.success && result.data) {
        setVideoHistory(result.data as VideoHistoryItem[]);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format number
  const formatNumber = (num: number | undefined) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'downloaded':
        return <span className="badge badge-cyan"><CheckCircle className="w-3 h-3 mr-1" /> Downloaded</span>;
      case 'previewed':
        return <span className="badge badge-gray"><Eye className="w-3 h-3 mr-1" /> Previewed</span>;
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  // Toggle expand item
  const toggleExpand = (id: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Clear all history
  const handleClearAll = async () => {
    setClearing(true);
    try {
      await window.electronAPI.clearHistory?.('video');
      setVideoHistory([]);
      setShowClearConfirm(false);
    } catch (err) {
      console.error('Failed to clear history:', err);
    } finally {
      setClearing(false);
    }
  };

  // Delete single item
  const handleDeleteItem = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.electronAPI.deleteHistoryItem?.(id);
      setVideoHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <HistoryIcon className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">Browsing History</h3>
              <p className="text-sm text-white/50">Your recent videos</p>
            </div>
          </div>
          
          {/* Clear All Button */}
          {videoHistory.length > 0 && !showClearConfirm && (
            <button 
              onClick={() => setShowClearConfirm(true)}
              className="btn btn-ghost text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
              Xóa tất cả
            </button>
          )}
        </div>

        {/* Confirm Clear Dialog */}
        {showClearConfirm && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-white font-medium">Xác nhận xóa tất cả lịch sử?</p>
                <p className="text-sm text-white/50 mt-1">Hành động này không thể hoàn tác.</p>
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={handleClearAll}
                    disabled={clearing}
                    className="btn btn-sm bg-red-500 hover:bg-red-600 text-white"
                  >
                    {clearing ? 'Đang xóa...' : 'Xóa tất cả'}
                  </button>
                  <button 
                    onClick={() => setShowClearConfirm(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="flex gap-2">
        <div className="btn btn-secondary cursor-default">
          <Video className="w-4 h-4" />
          {videoHistory.length} Videos
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="flex gap-4">
              <Skeleton className="w-24 h-16 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Videos History */}
      {!loading && (
        <>
          {videoHistory.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-white/30" />
              </div>
              <p className="text-white/50">No video history yet</p>
              <p className="text-sm text-white/30 mt-2">Videos you preview will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {videoHistory.map((item) => (
                <Card 
                  key={item.id} 
                  className="hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="relative w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                      {item.thumbnail ? (
                        <img 
                          src={item.thumbnail} 
                          alt={item.caption} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-6 h-6 text-white/20" />
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-xs text-white">
                        {formatDuration(item.duration)}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">
                        {item.caption || 'Untitled Video'}
                      </h4>
                      <p className="text-sm text-white/50 truncate">@{item.creator}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {getStatusBadge(item.status)}
                        <span className="text-xs text-white/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        className="btn btn-ghost btn-sm text-red-400 hover:bg-red-500/10"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button className="btn btn-ghost btn-sm">
                        {expandedItems.has(item.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Data */}
                  {expandedItems.has(item.id) && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="glass rounded-xl p-3 text-center">
                          <Play className="w-4 h-4 text-tiktok-cyan mx-auto mb-1" />
                          <p className="text-lg font-bold text-white">
                            {formatNumber((item as any).view_count || (item as any).play_count)}
                          </p>
                          <p className="text-xs text-white/50">Views</p>
                        </div>
                        <div className="glass rounded-xl p-3 text-center">
                          <Heart className="w-4 h-4 text-red-400 mx-auto mb-1" />
                          <p className="text-lg font-bold text-white">
                            {formatNumber((item as any).like_count || (item as any).digg_count)}
                          </p>
                          <p className="text-xs text-white/50">Likes</p>
                        </div>
                        <div className="glass rounded-xl p-3 text-center">
                          <MessageCircle className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                          <p className="text-lg font-bold text-white">
                            {formatNumber((item as any).comment_count)}
                          </p>
                          <p className="text-xs text-white/50">Comments</p>
                        </div>
                        <div className="glass rounded-xl p-3 text-center">
                          <Share2 className="w-4 h-4 text-green-400 mx-auto mb-1" />
                          <p className="text-lg font-bold text-white">
                            {formatNumber((item as any).share_count)}
                          </p>
                          <p className="text-xs text-white/50">Shares</p>
                        </div>
                      </div>
                      
                      {/* Video ID */}
                      <div className="mt-3 flex items-center gap-2 text-xs text-white/30">
                        <span>Video ID:</span>
                        <code className="bg-white/10 px-2 py-1 rounded font-mono">
                          {item.video_id || 'N/A'}
                        </code>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default History;
