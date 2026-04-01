import { contextBridge, ipcRenderer } from 'electron';

// Types
interface DownloadProgress {
  jobId: string;
  percent: number;
  speed?: string;
  eta?: string;
  status: 'downloading' | 'completed' | 'error' | 'cancelled';
  savedPath?: string;
  error?: string;
}

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // URL validation
  validateUrl: (url: string) => ipcRenderer.invoke('validate-url', url),
  
  // Video operations
  getVideoMetadata: (url: string) => ipcRenderer.invoke('get-video-metadata', url),
  downloadVideo: (url: string, outputPath?: string) => ipcRenderer.invoke('download-video', url, outputPath),
  cancelDownload: (jobId: string) => ipcRenderer.invoke('cancel-download', jobId),
  
  // History
  getHistory: (type: 'video', limit?: number) => ipcRenderer.invoke('get-history', type, limit),
  clearHistory: (type: 'video') => ipcRenderer.invoke('clear-history', type),
  deleteHistoryItem: (id: number) => ipcRenderer.invoke('delete-history-item', id),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('set-setting', key, value),
  
  // File system
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openFolder: (path: string) => ipcRenderer.invoke('open-folder', path),
  openFile: (path: string) => ipcRenderer.invoke('open-file', path),
  
  // System
  checkYtdlp: () => ipcRenderer.invoke('check-ytdlp'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // FastMoss APIs
  openFastMoss: (tiktokUrl: string) => ipcRenderer.invoke('open-fastmoss', tiktokUrl),
  openFastMossDetail: (detailUrl: string) => ipcRenderer.invoke('open-fastmoss-detail', detailUrl),
  checkFastMossCookies: () => ipcRenderer.invoke('check-fastmoss-cookies'),
  refreshFastMossSession: () => ipcRenderer.invoke('refresh-fastmoss-session'),
  
  // TikTok Shop Product Info
  getProductInfo: (videoUrl: string) => ipcRenderer.invoke('get-product-info', videoUrl),
  
  // Event listeners
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) => {
      callback(progress);
    };
    ipcRenderer.on('download-progress', subscription);
    return () => {
      ipcRenderer.removeListener('download-progress', subscription);
    };
  }
});
