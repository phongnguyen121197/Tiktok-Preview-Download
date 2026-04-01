import { create } from 'zustand';
import { DownloadProgress } from '../types/electron.d';

interface DownloadItem extends DownloadProgress {
  url: string;
  title: string;
  thumbnail: string;
  startTime: number;
}

interface ExtendedProgress extends DownloadProgress {
  title?: string;
  thumbnail?: string;
  url?: string;
  message?: string;
}

interface DownloadStore {
  downloads: Map<string, DownloadItem>;
  addDownload: (jobId: string, item: DownloadItem) => void;
  updateDownload: (jobId: string, progress: Partial<DownloadItem>) => void;
  removeDownload: (jobId: string) => void;
  clearCompleted: () => void;
  initListener: () => () => void;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  downloads: new Map(),
  
  addDownload: (jobId, item) => {
    set(state => {
      const newDownloads = new Map(state.downloads);
      newDownloads.set(jobId, item);
      return { downloads: newDownloads };
    });
  },
  
  updateDownload: (jobId, progress) => {
    set(state => {
      const newDownloads = new Map(state.downloads);
      const existing = newDownloads.get(jobId);
      if (existing) {
        // Update existing entry, preserve title/thumbnail if new values not provided
        newDownloads.set(jobId, { 
          ...existing, 
          ...progress,
          title: progress.title || existing.title,
          thumbnail: progress.thumbnail || existing.thumbnail
        });
      } else {
        // Auto-create download entry if it doesn't exist
        newDownloads.set(jobId, {
          jobId,
          url: progress.url || '',
          title: progress.title || progress.message || 'Downloading...',
          thumbnail: progress.thumbnail || '',
          percent: progress.percent || 0,
          status: progress.status || 'downloading',
          startTime: Date.now(),
          speed: progress.speed,
          eta: progress.eta,
          savedPath: progress.savedPath,
          error: progress.error
        } as DownloadItem);
      }
      return { downloads: newDownloads };
    });
  },
  
  removeDownload: (jobId) => {
    set(state => {
      const newDownloads = new Map(state.downloads);
      newDownloads.delete(jobId);
      return { downloads: newDownloads };
    });
  },
  
  clearCompleted: () => {
    set(state => {
      const newDownloads = new Map(state.downloads);
      newDownloads.forEach((download, id) => {
        if (download.status === 'completed' || download.status === 'error') {
          newDownloads.delete(id);
        }
      });
      return { downloads: newDownloads };
    });
  },
  
  initListener: () => {
    const cleanup = window.electronAPI.onDownloadProgress((progress: ExtendedProgress) => {
      console.log('Download progress received:', progress);
      get().updateDownload(progress.jobId, {
        percent: progress.percent,
        speed: progress.speed,
        eta: progress.eta,
        status: progress.status,
        savedPath: progress.savedPath,
        error: progress.error,
        title: progress.title,
        thumbnail: progress.thumbnail,
        url: progress.url
      });
    });
    return cleanup;
  },
}));
