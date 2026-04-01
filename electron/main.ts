import { app, BrowserWindow, ipcMain, dialog, shell, net, session } from 'electron';
import { join } from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import * as zlib from 'zlib';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, format, transports } from 'winston';
import initSqlJs, { Database } from 'sql.js';
import { getShopScraper, ProductInfo } from './tiktok-shop-scraper';
import { AIService, validateLicenseKey, VideoMetadataForAI, KOCDataForAI } from './services/aiService';
// Removed @tobyg74/tiktok-api-dl due to native module issues - using direct API calls instead

// TikTok API Configuration
const TIKTOK_API_URL = 'https://www.tikwm.com/api/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ============================================================================
// LOGGER SETUP
// ============================================================================
const logsDir = join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const today = new Date().toISOString().split('T')[0];
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message, jobId }) => {
      return `[${timestamp}] [${level.toUpperCase()}] ${jobId ? `[${jobId}] ` : ''}${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: join(logsDir, `app-${today}.log`) })
  ]
});

// ============================================================================
// DATABASE SETUP (sql.js)
// ============================================================================
let db: Database | null = null;
const dbPath = join(app.getPath('userData'), 'tiktok-research.db');

async function initDatabase() {
  try {
    const SQL = await initSqlJs();
    
    // Load existing database or create new
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
    
    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS video_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        video_id TEXT,
        caption TEXT,
        creator TEXT,
        duration INTEGER,
        thumbnail TEXT,
        status TEXT DEFAULT 'pending',
        saved_path TEXT,
        view_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        share_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add missing columns for existing databases
    try {
      db.run('ALTER TABLE video_history ADD COLUMN view_count INTEGER DEFAULT 0');
    } catch (e) { /* Column already exists */ }
    try {
      db.run('ALTER TABLE video_history ADD COLUMN like_count INTEGER DEFAULT 0');
    } catch (e) { /* Column already exists */ }
    try {
      db.run('ALTER TABLE video_history ADD COLUMN comment_count INTEGER DEFAULT 0');
    } catch (e) { /* Column already exists */ }
    try {
      db.run('ALTER TABLE video_history ADD COLUMN share_count INTEGER DEFAULT 0');
    } catch (e) { /* Column already exists */ }
    
    db.run(`
      CREATE TABLE IF NOT EXISTS channel_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_url TEXT NOT NULL,
        channel_name TEXT,
        channel_id TEXT,
        avatar_url TEXT,
        total_videos INTEGER DEFAULT 0,
        last_fetch DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    
    // Initialize default settings
    const defaultDownloadPath = join(app.getPath('downloads'), 'TikTok Preview Download');
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['downloadPath', defaultDownloadPath]);
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['autoPasteClipboard', 'false']);
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['maxConcurrentDownloads', '3']);
    
    // Create download directory if not exists
    if (!fs.existsSync(defaultDownloadPath)) {
      fs.mkdirSync(defaultDownloadPath, { recursive: true });
    }
    
    // Save database
    saveDatabase();
    
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error(`Failed to initialize database: ${error}`);
  }
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// ============================================================================
// WINDOW MANAGEMENT
// ============================================================================
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0f0f0f',
    autoHideMenuBar: true,
    show: false
  });

  // Hide menu bar completely on Windows/Linux
  if (process.platform !== 'darwin') {
    mainWindow.setMenu(null);
  }

  // Graceful show
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // DevTools disabled - uncomment below line if needed for debugging
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  logger.info('Main window created');
}

// Request single instance lock - prevent multiple app instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is running, quit this one
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await initDatabase();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  saveDatabase();
});

// ============================================================================
// URL UTILITIES
// ============================================================================
function normalizeUrl(url: string): string {
  let normalized = url.trim();
  normalized = normalized.split('?')[0].split('#')[0];
  
  if (normalized.includes('vm.tiktok.com') || normalized.includes('vt.tiktok.com')) {
    return normalized;
  }
  
  if (!normalized.startsWith('http')) {
    normalized = 'https://' + normalized;
  }
  
  return normalized;
}

function isValidTikTokUrl(url: string): { valid: boolean; type: 'video' | 'unknown' } {
  const normalized = normalizeUrl(url);
  
  const videoPatterns = [
    /tiktok\.com\/@[\w.-]+\/video\/\d+/,
    /vm\.tiktok\.com\/[\w]+/,
    /vt\.tiktok\.com\/[\w]+/,
    /tiktok\.com\/t\/[\w]+/
  ];
  
  for (const pattern of videoPatterns) {
    if (pattern.test(normalized)) {
      return { valid: true, type: 'video' };
    }
  }
  
  return { valid: false, type: 'unknown' };
}

// ============================================================================
// YT-DLP HANDLERS
// ============================================================================
interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  uploader: string;
  uploaderId: string;
  duration: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  thumbnail: string;
  url: string;
  uploadDate: string;
}

// TikWM API response interface
interface TikWMResponse {
  code: number;
  msg: string;
  data: {
    id: string;
    title: string;
    play: string;           // Video URL (no watermark)
    wmplay: string;         // Video URL (with watermark)
    hdplay: string;         // HD Video URL
    music: string;          // Audio URL
    music_info?: {
      title: string;
      author: string;
    };
    play_count: number;
    digg_count: number;
    comment_count: number;
    share_count: number;
    download_count: number;
    create_time: number;
    duration: number;
    cover: string;
    origin_cover: string;
    images?: string[];      // For slideshow posts
    author: {
      id: string;
      unique_id: string;
      nickname: string;
      avatar: string;
    };
  };
}

// Fetch video info using TikWM API
async function fetchTikWMApi(videoUrl: string): Promise<TikWMResponse> {
  return new Promise((resolve, reject) => {
    const jobId = uuidv4().slice(0, 8);
    logger.info(`Fetching from TikWM API: ${videoUrl}`, { jobId });
    
    const postData = `url=${encodeURIComponent(videoUrl)}&hd=1`;
    
    const options = {
      hostname: 'www.tikwm.com',
      port: 443,
      path: '/api/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data) as TikWMResponse;
          if (response.code === 0 || response.code === -1 && response.data) {
            logger.info(`TikWM API success`, { jobId });
            resolve(response);
          } else {
            logger.error(`TikWM API error: ${response.msg}`, { jobId });
            reject(new Error(response.msg || 'TikWM API error'));
          }
        } catch (e) {
          logger.error(`Failed to parse TikWM response: ${e}`, { jobId });
          reject(new Error('Failed to parse API response'));
        }
      });
    });
    
    req.on('error', (e) => {
      logger.error(`TikWM request error: ${e}`, { jobId });
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

async function getVideoMetadata(url: string): Promise<VideoMetadata & { downloadUrl?: string; hdDownloadUrl?: string; audioUrl?: string; images?: string[] }> {
  const jobId = uuidv4().slice(0, 8);
  logger.info(`Fetching metadata for: ${url}`, { jobId });
  
  try {
    const response = await fetchTikWMApi(url);
    const data = response.data;
    
    const metadata = {
      id: data.id || '',
      title: data.title || 'Untitled',
      description: data.title || '',
      uploader: data.author?.nickname || 'Unknown',
      uploaderId: data.author?.unique_id || '',
      authorId: data.author?.id || '',
      duration: data.duration || 0,
      viewCount: data.play_count || 0,
      likeCount: data.digg_count || 0,
      commentCount: data.comment_count || 0,
      shareCount: data.share_count || 0,
      thumbnail: data.cover || data.origin_cover || '',
      url: url,
      uploadDate: data.create_time ? new Date(data.create_time * 1000).toISOString().split('T')[0].replace(/-/g, '') : '',
      // Extra fields for download
      downloadUrl: data.play || '',
      hdDownloadUrl: data.hdplay || data.play || '',
      audioUrl: data.music || '',
      images: data.images || [],
      avatarUrl: data.author?.avatar || ''
    };
    
    logger.info(`Metadata fetched successfully via TikWM API`, { jobId });
    return metadata;
  } catch (error) {
    logger.error(`TikWM API failed: ${error}`, { jobId });
    throw error;
  }
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

ipcMain.handle('validate-url', async (_event, url: string) => {
  const jobId = uuidv4().slice(0, 8);
  logger.info(`Validating URL: ${url}`, { jobId });
  const result = isValidTikTokUrl(url);
  logger.info(`Validation result: ${JSON.stringify(result)}`, { jobId });
  return result;
});

ipcMain.handle('get-video-metadata', async (_event, url: string) => {
  try {
    const metadata = await getVideoMetadata(url);
    if (db) {
      db.run(
        `INSERT INTO video_history (url, video_id, caption, creator, duration, thumbnail, view_count, like_count, comment_count, share_count, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'previewed')`,
        [
          url, 
          metadata.id, 
          metadata.title, 
          metadata.uploader, 
          metadata.duration, 
          metadata.thumbnail,
          metadata.viewCount || 0,
          metadata.likeCount || 0,
          metadata.commentCount || 0,
          metadata.shareCount || 0
        ]
      );
      saveDatabase();
    }
    return { success: true, data: metadata };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('download-video', async (event, url: string, outputPath?: string) => {
  const jobId = uuidv4().slice(0, 8);
  
  try {
    if (!outputPath && db) {
      const result = db.exec('SELECT value FROM settings WHERE key = ?', ['downloadPath']);
      if (result.length > 0 && result[0].values.length > 0) {
        outputPath = result[0].values[0][0] as string;
      }
    }
    
    if (!outputPath) {
      outputPath = join(app.getPath('downloads'), 'TikTok Preview Download');
    }
    
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    
    logger.info(`Starting download: ${url}`, { jobId });
    
    // Send initial event with jobId immediately so frontend can track
    event.sender.send('download-progress', { 
      jobId, 
      percent: 0, 
      status: 'fetching', 
      message: 'Getting video info...',
      url: url
    });
    
    // Get metadata from TikWM API directly to access all URLs
    const response = await fetchTikWMApi(url);
    const data = response.data;
    
    // Send metadata to frontend so it can display title/thumbnail
    const title = data.title || 'Untitled';
    const thumbnail = data.cover || data.origin_cover || '';
    
    event.sender.send('download-progress', { 
      jobId, 
      percent: 5, 
      status: 'fetching', 
      message: 'Preparing download...',
      title: title,
      thumbnail: thumbnail,
      url: url
    });
    
    // Priority: wmplay (with watermark but HAS AUDIO) > hdplay > play
    // wmplay usually has audio, while play/hdplay are video-only
    let downloadUrl = data.wmplay || data.hdplay || data.play;
    let hasAudio = !!data.wmplay;
    
    if (!downloadUrl) {
      throw new Error('No download URL available');
    }
    
    // Generate filename
    const uploader = data.author?.unique_id || 'unknown';
    const videoId = data.id || Date.now().toString();
    const suffix = hasAudio ? '' : '_noaudio';
    const filename = `${uploader}_${videoId}${suffix}.mp4`;
    const savedPath = join(outputPath, filename);
    
    logger.info(`Downloading from: ${downloadUrl} (has audio: ${hasAudio})`, { jobId });
    event.sender.send('download-progress', { 
      jobId, 
      percent: 10, 
      status: 'downloading', 
      message: hasAudio ? 'Downloading video with audio...' : 'Downloading video (no audio)...',
      title: title,
      thumbnail: thumbnail
    });
    
    // Download file using https with progress tracking
    return new Promise((resolve) => {
      const downloadFile = (downloadUrl: string, redirectCount: number = 0) => {
        if (redirectCount > 5) {
          logger.error(`Too many redirects`, { jobId });
          event.sender.send('download-progress', { jobId, percent: 0, status: 'error', error: 'Too many redirects' });
          resolve({ success: false, jobId, error: 'Too many redirects' });
          return;
        }
        
        const urlObj = new URL(downloadUrl);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const req = protocol.get(downloadUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Referer': 'https://www.tiktok.com/',
            'Accept': '*/*',
          }
        }, (response: any) => {
          // Handle redirects
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            logger.info(`Redirecting to: ${response.headers.location}`, { jobId });
            downloadFile(response.headers.location, redirectCount + 1);
            return;
          }
          
          if (response.statusCode !== 200) {
            logger.error(`HTTP error: ${response.statusCode}`, { jobId });
            event.sender.send('download-progress', { jobId, percent: 0, status: 'error', error: `HTTP ${response.statusCode}` });
            resolve({ success: false, jobId, error: `HTTP ${response.statusCode}` });
            return;
          }
          
          const totalSize = parseInt(response.headers['content-length'] || '0', 10);
          let downloadedSize = 0;
          let lastProgressUpdate = Date.now();
          
          const file = fs.createWriteStream(savedPath);
          
          response.on('data', (chunk: Buffer) => {
            downloadedSize += chunk.length;
            file.write(chunk);
            
            // Update progress every 200ms to avoid flooding
            const now = Date.now();
            if (now - lastProgressUpdate > 200) {
              lastProgressUpdate = now;
              
              let percent: number;
              let speedText: string;
              
              if (totalSize > 0) {
                // Real progress
                percent = Math.min(95, Math.round((downloadedSize / totalSize) * 90) + 10);
                speedText = `${(downloadedSize / 1024 / 1024).toFixed(1)} / ${(totalSize / 1024 / 1024).toFixed(1)} MB`;
              } else {
                // Fake progress based on downloaded size (assume ~10MB video)
                const estimatedTotal = 10 * 1024 * 1024; // 10MB estimate
                percent = Math.min(95, Math.round((downloadedSize / estimatedTotal) * 85) + 10);
                speedText = `${(downloadedSize / 1024 / 1024).toFixed(1)} MB`;
              }
              
              event.sender.send('download-progress', {
                jobId,
                percent,
                speed: speedText,
                status: 'downloading'
              });
            }
          });
          
          response.on('end', () => {
            file.end();
            logger.info(`Download completed: ${savedPath} (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`, { jobId });
            
            if (db) {
              db.run(`UPDATE video_history SET status = 'downloaded', saved_path = ?, updated_at = CURRENT_TIMESTAMP WHERE url = ?`, [savedPath, url]);
              saveDatabase();
            }
            
            event.sender.send('download-progress', { jobId, percent: 100, status: 'completed', savedPath });
            resolve({ success: true, jobId, savedPath, hasAudio });
          });
          
          response.on('error', (err: Error) => {
            file.end();
            try { fs.unlinkSync(savedPath); } catch (e) {}
            logger.error(`Download stream error: ${err}`, { jobId });
            event.sender.send('download-progress', { jobId, percent: 0, status: 'error', error: err.message });
            resolve({ success: false, jobId, error: err.message });
          });
        });
        
        req.on('error', (err: Error) => {
          logger.error(`Download request error: ${err}`, { jobId });
          event.sender.send('download-progress', { jobId, percent: 0, status: 'error', error: err.message });
          resolve({ success: false, jobId, error: err.message });
        });
        
        req.setTimeout(60000, () => {
          req.destroy();
          logger.error(`Download timeout`, { jobId });
          event.sender.send('download-progress', { jobId, percent: 0, status: 'error', error: 'Download timeout' });
          resolve({ success: false, jobId, error: 'Download timeout' });
        });
      };
      
      downloadFile(downloadUrl);
    });
    
  } catch (error) {
    logger.error(`Download error: ${error}`, { jobId });
    event.sender.send('download-progress', { jobId, percent: 0, status: 'error', error: (error as Error).message });
    return { success: false, jobId, error: (error as Error).message };
  }
});

ipcMain.handle('cancel-download', async (_event, jobId: string) => {
  // Note: Current implementation doesn't support canceling HTTP downloads
  // This would require AbortController implementation
  logger.info(`Cancel requested for download`, { jobId });
  return { success: false, error: 'Cancel not supported in API mode' };
});

ipcMain.handle('get-history', async (_event, type: 'video' | 'channel', limit: number = 50) => {
  try {
    if (!db) return { success: false, error: 'Database not initialized' };
    
    const table = type === 'video' ? 'video_history' : 'channel_history';
    const result = db.exec(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT ${limit}`);
    const rows = result.length > 0 ? result[0].values.map((row) => {
      const columns = result[0].columns;
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    }) : [];
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// Clear all history
ipcMain.handle('clear-history', async (_event, type: 'video' | 'channel') => {
  try {
    if (!db) return { success: false, error: 'Database not initialized' };
    
    const table = type === 'video' ? 'video_history' : 'channel_history';
    db.run(`DELETE FROM ${table}`);
    saveDatabase();
    logger.info(`Cleared all ${type} history`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to clear history: ${error}`);
    return { success: false, error: (error as Error).message };
  }
});

// Delete single history item
ipcMain.handle('delete-history-item', async (_event, id: number) => {
  try {
    if (!db) return { success: false, error: 'Database not initialized' };
    
    db.run('DELETE FROM video_history WHERE id = ?', [id]);
    saveDatabase();
    logger.info(`Deleted history item ${id}`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to delete history item: ${error}`);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-settings', async () => {
  try {
    if (!db) return { success: false, error: 'Database not initialized' };
    const result = db.exec('SELECT * FROM settings');
    const settings: Record<string, string> = {};
    if (result.length > 0) {
      result[0].values.forEach((row) => {
        settings[row[0] as string] = row[1] as string;
      });
    }
    return { success: true, data: settings };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('set-setting', async (_event, key: string, value: string) => {
  try {
    if (!db) return { success: false, error: 'Database not initialized' };
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    saveDatabase();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('open-folder', async (_event, path: string) => {
  shell.showItemInFolder(path);
  return { success: true };
});

ipcMain.handle('open-file', async (_event, path: string) => {
  shell.openPath(path);
  return { success: true };
});

ipcMain.handle('check-ytdlp', async () => {
  // Check TikWM API availability instead of yt-dlp
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.tikwm.com',
      port: 443,
      path: '/api/',
      method: 'HEAD',
      timeout: 5000
    };
    
    const req = https.request(options, (res) => {
      resolve({ 
        available: res.statusCode === 200 || res.statusCode === 405, // 405 is expected for HEAD
        version: 'TikWM API v1' 
      });
    });
    
    req.on('error', () => {
      resolve({ available: false, version: null });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ available: false, version: null });
    });
    
    req.end();
  });
});

ipcMain.handle('get-app-info', async () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node
  };
});

// ============================================================================
// FASTMOSS - Open in Browser Window with SINGLE WINDOW MODE
// ============================================================================

// Shared session partition - tất cả FastMoss windows share cùng session
const FASTMOSS_PARTITION = 'persist:fastmoss-shared';

let fastMossWindow: BrowserWindow | null = null;
let fastMossCookiesLoaded = false;

// Parse cookies from JSON format (EditThisCookie export)
function parseFastMossCookies(cookieString: string): { name: string; value: string; domain: string; path: string; secure: boolean; httpOnly: boolean; expirationDate?: number }[] {
  const cookies: any[] = [];
  
  if (!cookieString || !cookieString.trim()) return cookies;
  
  // Try JSON format (EditThisCookie export)
  try {
    const jsonCookies = JSON.parse(cookieString);
    if (Array.isArray(jsonCookies)) {
      return jsonCookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain || '.fastmoss.com',
        path: c.path || '/',
        secure: c.secure !== false,
        httpOnly: c.httpOnly || false,
        expirationDate: c.expirationDate
      }));
    }
  } catch {
    // Not JSON, try Netscape format
  }
  
  // Netscape format
  const lines = cookieString.split('\n');
  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue;
    
    const parts = line.split('\t');
    if (parts.length >= 7) {
      cookies.push({
        name: parts[5].trim(),
        value: parts[6].trim(),
        domain: parts[0].trim(),
        path: parts[2].trim() || '/',
        secure: true,
        httpOnly: parts[1].toLowerCase() === 'true',
        expirationDate: parseInt(parts[4]) || undefined
      });
    }
  }
  
  return cookies;
}

// Load cookies vào shared session partition
async function loadFastMossCookiesToSession(cookies: any[]): Promise<void> {
  const ses = session.fromPartition(FASTMOSS_PARTITION);
  
  // Clear old cookies first
  try {
    const existingCookies = await ses.cookies.get({ domain: 'fastmoss.com' });
    for (const cookie of existingCookies) {
      try {
        await ses.cookies.remove('https://www.fastmoss.com', cookie.name);
      } catch (e) {
        // Ignore
      }
    }
  } catch (e) {
    // Ignore
  }
  
  // Set new cookies
  for (const cookie of cookies) {
    try {
      await ses.cookies.set({
        url: 'https://www.fastmoss.com',
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '.fastmoss.com',
        path: cookie.path || '/',
        secure: cookie.secure ?? true,
        httpOnly: cookie.httpOnly ?? false,
        expirationDate: cookie.expirationDate
      });
    } catch (err) {
      logger.warn(`Failed to set cookie ${cookie.name}: ${err}`);
    }
  }
  
  fastMossCookiesLoaded = true;
  logger.info(`Loaded ${cookies.length} cookies into FastMoss shared session`);
}

// Check FastMoss cookies validity
ipcMain.handle('check-fastmoss-cookies', async () => {
  try {
    if (!db) return { valid: false, message: 'Database not initialized' };
    
    const result = db.exec('SELECT value FROM settings WHERE key = ?', ['fastmossCookies']);
    if (!result.length || !result[0].values.length || !result[0].values[0][0]) {
      return { valid: false, message: 'Chưa cấu hình cookies FastMoss' };
    }
    
    const cookieString = result[0].values[0][0] as string;
    const cookies = parseFastMossCookies(cookieString);
    
    if (cookies.length === 0) {
      return { valid: false, message: 'Cookies không hợp lệ' };
    }
    
    // Load cookies vào shared session
    await loadFastMossCookiesToSession(cookies);
    
    return { valid: true, message: `Đã tải ${cookies.length} cookies vào session` };
  } catch (err) {
    return { valid: false, message: (err as Error).message };
  }
});

// Helper: inject search keyword vào FastMoss (React-compatible)
async function injectFastMossSearch(webContents: Electron.WebContents, keyword: string) {
  await new Promise(resolve => setTimeout(resolve, 1800));
  const script = `
    (function() {
      try {
        const input = document.querySelector('input.ant-input') ||
                      document.querySelector('.ant-input-affix-wrapper input') ||
                      document.querySelector('[placeholder*="Biệt danh"]') ||
                      document.querySelector('[placeholder*="ID"]');
        if (!input) { console.warn('[FM] Input not found'); return false; }

        // React-compatible value setter
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, ${JSON.stringify(keyword)});
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.focus();

        // Click search button after short delay
        setTimeout(() => {
          const btn = document.querySelector('.ant-input-search-button') ||
                      document.querySelector('.ant-input-group-addon button') ||
                      document.querySelector('button.ant-btn-primary');
          if (btn) { btn.click(); console.log('[FM] Search clicked'); }
          else {
            input.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
            }));
            input.dispatchEvent(new KeyboardEvent('keyup', {
              key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
            }));
            console.log('[FM] Enter dispatched as fallback');
          }
        }, 600);
        return true;
      } catch(e) { console.error('[FM] inject error:', e); return false; }
    })();
  `;
  try {
    await webContents.executeJavaScript(script);
    logger.info(`[FastMoss] Search injected for: ${keyword}`);
  } catch (err) {
    logger.error(`[FastMoss] Inject error: ${err}`);
  }
}

// Open FastMoss in a new window with cookies - SINGLE WINDOW MODE
ipcMain.handle('open-fastmoss', async (_event, tiktokUrl: string, displayName?: string) => {
  logger.info(`Opening FastMoss for: ${tiktokUrl}, displayName: ${displayName}`);

  try {
    if (!db) {
      return { success: false, error: 'Database not initialized' };
    }

    // Get cookies from settings
    const result = db.exec('SELECT value FROM settings WHERE key = ?', ['fastmossCookies']);
    if (!result.length || !result[0].values.length || !result[0].values[0][0]) {
      return { success: false, error: 'Chưa cấu hình cookies FastMoss. Vui lòng vào Settings để cấu hình.' };
    }

    const cookieString = result[0].values[0][0] as string;
    const cookies = parseFastMossCookies(cookieString);

    if (cookies.length === 0) {
      return { success: false, error: 'Cookies FastMoss không hợp lệ. Vui lòng kiểm tra lại.' };
    }

    // Ưu tiên displayName (tên hiển thị) nếu có, fallback về unique_id từ URL
    const match = tiktokUrl.match(/@([^\/\?]+)/);
    const uniqueId = match ? match[1] : tiktokUrl.replace(/^@/, '');
    const searchKeyword = displayName || uniqueId;

    logger.info(`Search keyword: "${searchKeyword}"`);

    // Load cookies vào shared session
    await loadFastMossCookiesToSession(cookies);

    // Mở trang search với keyword trong URL (pre-fill)
    const searchUrl = `https://www.fastmoss.com/vi/influencer/search?shop_window=1&keyword=${encodeURIComponent(searchKeyword)}`;

    // ⭐ SINGLE WINDOW MODE: Reuse existing window if available
    if (fastMossWindow && !fastMossWindow.isDestroyed()) {
      logger.info('Reusing existing FastMoss window');
      fastMossWindow.setTitle(`FastMoss - ${searchKeyword}`);
      fastMossWindow.show();
      fastMossWindow.focus();
      await fastMossWindow.loadURL(searchUrl);
      // Inject auto-search sau khi page load
      fastMossWindow.webContents.once('did-finish-load', async () => {
        await injectFastMossSearch(fastMossWindow!.webContents, searchKeyword);
      });
      return { success: true };
    }
    
    // Create new browser window with shared session partition
    const newWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      title: `FastMoss - @${uniqueId}`,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        partition: FASTMOSS_PARTITION // ⭐ Shared session for all users
      },
      backgroundColor: '#ffffff',
      show: false
    });
    
    fastMossWindow = newWindow;
    
    // ⭐ PREVENT NEW TABS: All links open in same window
    newWindow.webContents.setWindowOpenHandler(({ url }) => {
      logger.info(`FastMoss: Intercepted new window/tab request: ${url}`);
      
      // FastMoss links stay in same window
      if (url.includes('fastmoss.com')) {
        newWindow.loadURL(url);
      } else {
        // External links open in default browser
        shell.openExternal(url);
      }
      
      return { action: 'deny' }; // Deny opening new window
    });
    
    // Handle navigation within same window
    newWindow.webContents.on('will-navigate', (event, url) => {
      logger.info(`FastMoss: Navigating to: ${url}`);
      // Allow all navigation in same window
    });
    
    // Update title when page changes
    newWindow.webContents.on('page-title-updated', (event, title) => {
      if (!title.startsWith('FastMoss -')) {
        newWindow.setTitle(`FastMoss - ${title}`);
      }
    });
    
    // Show when ready
    newWindow.once('ready-to-show', () => {
      newWindow.show();
    });
    
    // Handle window close
    newWindow.on('closed', () => {
      fastMossWindow = null;
    });
    
    // After page loads, auto-fill + auto-search
    newWindow.webContents.on('did-finish-load', async () => {
      const currentUrl = newWindow.webContents.getURL();
      logger.info(`FastMoss page loaded: ${currentUrl}`);
      if (!currentUrl.includes('/influencer/search')) return;
      await injectFastMossSearch(newWindow.webContents, searchKeyword);
    });
    
    await newWindow.loadURL(searchUrl);
    
    logger.info(`FastMoss window opened for: ${searchKeyword}`);
    
    return { success: true };
    
  } catch (err) {
    logger.error(`Failed to open FastMoss: ${err}`);
    return { success: false, error: (err as Error).message };
  }
});

// Open FastMoss detail page - USES SAME WINDOW
ipcMain.handle('open-fastmoss-detail', async (_event, detailUrl: string) => {
  logger.info(`Opening FastMoss detail: ${detailUrl}`);
  
  try {
    // ⭐ SINGLE WINDOW: Reuse existing FastMoss window
    if (fastMossWindow && !fastMossWindow.isDestroyed()) {
      logger.info('Using existing FastMoss window for detail page');
      await fastMossWindow.loadURL(detailUrl);
      fastMossWindow.show();
      fastMossWindow.focus();
      return { success: true };
    }
    
    // No existing window - create new one
    if (!db) {
      await shell.openExternal(detailUrl);
      return { success: true };
    }
    
    // Get cookies
    const result = db.exec('SELECT value FROM settings WHERE key = ?', ['fastmossCookies']);
    if (!result.length || !result[0].values.length || !result[0].values[0][0]) {
      await shell.openExternal(detailUrl);
      return { success: true };
    }
    
    const cookieString = result[0].values[0][0] as string;
    const cookies = parseFastMossCookies(cookieString);
    
    // Load cookies into shared session
    await loadFastMossCookiesToSession(cookies);
    
    // Create new window with shared session
    const newWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      title: 'FastMoss',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        partition: FASTMOSS_PARTITION
      },
      backgroundColor: '#ffffff',
      show: false
    });
    
    fastMossWindow = newWindow;
    
    // Single window mode handlers
    newWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.includes('fastmoss.com')) {
        newWindow.loadURL(url);
      } else {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });
    
    newWindow.webContents.on('page-title-updated', (event, title) => {
      if (!title.startsWith('FastMoss -')) {
        newWindow.setTitle(`FastMoss - ${title}`);
      }
    });
    
    newWindow.once('ready-to-show', () => {
      newWindow.show();
    });
    
    newWindow.on('closed', () => {
      fastMossWindow = null;
    });
    
    await newWindow.loadURL(detailUrl);
    
    return { success: true };
    
  } catch (err) {
    logger.error(`Failed to open FastMoss detail: ${err}`);
    return { success: false, error: (err as Error).message };
  }
});

// Refresh FastMoss session (can be called from UI to reload cookies)
ipcMain.handle('refresh-fastmoss-session', async () => {
  try {
    if (!db) {
      return { success: false, error: 'Database not initialized' };
    }
    
    const result = db.exec('SELECT value FROM settings WHERE key = ?', ['fastmossCookies']);
    if (!result.length || !result[0].values.length || !result[0].values[0][0]) {
      return { success: false, error: 'Chưa cấu hình cookies' };
    }
    
    const cookieString = result[0].values[0][0] as string;
    const cookies = parseFastMossCookies(cookieString);
    
    await loadFastMossCookiesToSession(cookies);
    
    // Reload current page if window exists
    if (fastMossWindow && !fastMossWindow.isDestroyed()) {
      fastMossWindow.webContents.reload();
    }
    
    return { success: true, message: `Refreshed ${cookies.length} cookies` };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

// ============================================================================
// AI ANALYSIS + LICENSE
// ============================================================================

// Helper: lấy setting từ DB
function getSettingValue(key: string): string {
  if (!db) return '';
  try {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    stmt.bind([key]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as { value: string };
      stmt.free();
      return row.value || '';
    }
    stmt.free();
  } catch { /* ignore */ }
  return '';
}

// Validate license key
ipcMain.handle('validate-license', async (_event, key: string) => {
  const isValid = validateLicenseKey(key);
  if (isValid) {
    // Lưu license key vào settings
    if (db) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['licenseKey', key]);
      saveDatabase();
    }
  }
  return { valid: isValid };
});

// Kiểm tra license đã activate chưa
ipcMain.handle('check-license', async () => {
  const key = getSettingValue('licenseKey');
  return { active: validateLicenseKey(key), key };
});

// Phân tích AI nội dung video
ipcMain.handle('analyze-video-ai', async (_event, metadata: VideoMetadataForAI) => {
  try {
    const apiKey = getSettingValue('anthropicApiKey');
    if (!apiKey) {
      return { success: false, error: 'Chưa cấu hình Anthropic API Key trong Settings' };
    }
    const licenseKey = getSettingValue('licenseKey');
    if (!validateLicenseKey(licenseKey)) {
      return { success: false, error: 'License key không hợp lệ hoặc chưa được kích hoạt' };
    }
    logger.info(`[AI] Analyzing video content for: ${metadata.uploader}`);
    const service = new AIService(apiKey);
    const result = await service.analyzeVideoContent(metadata);
    logger.info(`[AI] Video analysis complete: score=${result.viralityScore}`);
    return { success: true, data: result };
  } catch (err: any) {
    logger.error(`[AI] Video analysis error: ${err}`);
    return { success: false, error: err?.message || 'Lỗi phân tích AI' };
  }
});

// Phân tích AI KOC
ipcMain.handle('analyze-koc-ai', async (_event, data: KOCDataForAI) => {
  try {
    const apiKey = getSettingValue('anthropicApiKey');
    if (!apiKey) {
      return { success: false, error: 'Chưa cấu hình Anthropic API Key trong Settings' };
    }
    const licenseKey = getSettingValue('licenseKey');
    if (!validateLicenseKey(licenseKey)) {
      return { success: false, error: 'License key không hợp lệ hoặc chưa được kích hoạt' };
    }
    logger.info(`[AI] Analyzing KOC: @${data.username}`);
    const service = new AIService(apiKey);
    const result = await service.analyzeKOC(data);
    logger.info(`[AI] KOC analysis complete: score=${result.overallScore}`);
    return { success: true, data: result };
  } catch (err: any) {
    logger.error(`[AI] KOC analysis error: ${err}`);
    return { success: false, error: err?.message || 'Lỗi phân tích KOC' };
  }
});

// ============================================================================
// TIKTOK SHOP PRODUCT INFO
// ============================================================================
ipcMain.handle('get-product-info', async (_event, videoUrl: string): Promise<ProductInfo> => {
  logger.info(`[SHOP] Getting product info for: ${videoUrl}`);
  
  try {
    const scraper = getShopScraper(mainWindow);
    const productInfo = await scraper.getProductInfo(videoUrl);
    
    logger.info(`[SHOP] Product result: hasProduct=${productInfo.hasProduct}, title=${productInfo.productTitle || 'N/A'}`);
    
    return productInfo;
  } catch (err) {
    logger.error(`[SHOP] Error getting product info: ${err}`);
    return { hasProduct: false };
  }
});
