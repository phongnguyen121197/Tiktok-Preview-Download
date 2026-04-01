import { useEffect, useState } from 'react';
import { 
  Download,
  CheckCircle,
  XCircle,
  Folder,
  Trash2,
  Clock,
  X
} from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/Loading';
import { useDownloadStore } from '../stores/downloadStore';

function Downloads() {
  const { downloads, clearCompleted, removeDownload } = useDownloadStore();
  const [downloadPath, setDownloadPath] = useState('');

  // Get download path from settings
  useEffect(() => {
    const fetchSettings = async () => {
      const result = await window.electronAPI.getSettings();
      if (result.success && result.data) {
        setDownloadPath(result.data.downloadPath);
      }
    };
    fetchSettings();
  }, []);

  // Get downloads as array
  const downloadsArray = Array.from(downloads.values());
  const activeDownloads = downloadsArray.filter(d => d.status === 'downloading');
  const completedDownloads = downloadsArray.filter(d => d.status === 'completed');
  const failedDownloads = downloadsArray.filter(d => d.status === 'error');

  // Cancel download
  const handleCancel = async (jobId: string) => {
    await window.electronAPI.cancelDownload(jobId);
    removeDownload(jobId);
  };

  // Open download folder
  const handleOpenFolder = () => {
    if (downloadPath) {
      window.electronAPI.openFolder(downloadPath);
    }
  };

  // Open file
  const handleOpenFile = (path: string) => {
    window.electronAPI.openFile(path);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
            <Download className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-white">Downloads</h3>
            <p className="text-sm text-white/50">{downloadsArray.length} total downloads</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleOpenFolder}
            className="btn btn-secondary"
          >
            <Folder className="w-4 h-4" />
            Open Folder
          </button>
          {completedDownloads.length > 0 && (
            <button 
              onClick={clearCompleted}
              className="btn btn-ghost"
            >
              <Trash2 className="w-4 h-4" />
              Clear Completed
            </button>
          )}
        </div>
      </Card>

      {/* Active Downloads */}
      {activeDownloads.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-display font-medium text-white flex items-center gap-2">
            <LoadingSpinner size="sm" />
            Active Downloads ({activeDownloads.length})
          </h4>
          {activeDownloads.map((download) => (
            <Card key={download.jobId} className="p-4">
              <div className="flex gap-4">
                {/* Thumbnail */}
                <div className="w-20 flex-shrink-0">
                  {download.thumbnail ? (
                    <img 
                      src={download.thumbnail}
                      alt={download.title}
                      className="w-full aspect-video object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-white/5 rounded-lg flex items-center justify-center">
                      <Download className="w-6 h-6 text-white/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium line-clamp-1 mb-2">{download.title}</p>
                  
                  {/* Progress bar */}
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-gradient-to-r from-tiktok-red to-tiktok-cyan transition-all duration-300"
                      style={{ width: `${download.percent}%` }}
                    />
                  </div>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-white/50">
                    <span className="font-mono">{download.percent.toFixed(1)}%</span>
                    {download.speed && <span>{download.speed}</span>}
                    {download.eta && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {download.eta}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cancel button */}
                <button 
                  onClick={() => handleCancel(download.jobId)}
                  className="btn btn-ghost p-2 text-red-400 hover:bg-red-400/10"
                  title="Cancel download"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Completed Downloads */}
      {completedDownloads.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-display font-medium text-white flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            Completed ({completedDownloads.length})
          </h4>
          {completedDownloads.map((download) => (
            <Card key={download.jobId} hover className="p-4" onClick={() => download.savedPath && handleOpenFile(download.savedPath)}>
              <div className="flex gap-4 items-center">
                {/* Thumbnail */}
                <div className="w-16 flex-shrink-0">
                  {download.thumbnail ? (
                    <img 
                      src={download.thumbnail}
                      alt={download.title}
                      className="w-full aspect-video object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-white/5 rounded-lg flex items-center justify-center">
                      <Download className="w-5 h-5 text-white/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium line-clamp-1">{download.title}</p>
                  <p className="text-xs text-white/40 truncate">{download.savedPath}</p>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="badge badge-cyan">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Complete
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Failed Downloads */}
      {failedDownloads.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-display font-medium text-white flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400" />
            Failed ({failedDownloads.length})
          </h4>
          {failedDownloads.map((download) => (
            <Card key={download.jobId} className="p-4 border-red-500/20">
              <div className="flex gap-4 items-center">
                {/* Thumbnail */}
                <div className="w-16 flex-shrink-0">
                  {download.thumbnail ? (
                    <img 
                      src={download.thumbnail}
                      alt={download.title}
                      className="w-full aspect-video object-cover rounded-lg opacity-50"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-white/5 rounded-lg flex items-center justify-center">
                      <Download className="w-5 h-5 text-white/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium line-clamp-1">{download.title}</p>
                  <p className="text-xs text-red-400">{download.error || 'Download failed'}</p>
                </div>

                {/* Actions */}
                <button 
                  onClick={() => removeDownload(download.jobId)}
                  className="btn btn-ghost p-2"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {downloadsArray.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Download className="w-10 h-10 text-white/50" />
          </div>
          <h3 className="font-display font-semibold text-white/70 text-xl mb-2">
            No Downloads Yet
          </h3>
          <p className="text-white/40 max-w-md mx-auto">
            Start downloading videos from the Dashboard or Channel page.
            Your downloads will appear here.
          </p>
        </div>
      )}
    </div>
  );
}

export default Downloads;
