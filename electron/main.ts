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
import { AIService, validateLicenseKey, VideoMetadataForAI } from './services/aiService';
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

// ============================================================================
// KOC AI ANALYSIS — FastMoss Scraper + Claude Haiku 4.5
// ============================================================================

// Script inject vào FastMoss window để scrape dữ liệu
const FASTMOSS_SCRAPER_SCRIPT = `
(function() {
  function getText(labelTexts) {
    const labels = Array.isArray(labelTexts) ? labelTexts : [labelTexts];
    for (const label of labels) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent.trim();
        if (t === label) {
          const parent = node.parentElement;
          if (!parent) continue;
          // Tìm sibling hoặc parent có số liệu
          const grandparent = parent.parentElement;
          if (grandparent) {
            const children = Array.from(grandparent.children);
            for (const child of children) {
              if (child !== parent) {
                const val = child.textContent.trim();
                if (val && val !== label && val.length < 30) return val;
              }
            }
            // Thử tìm element đầu tiên trong grandparent có số
            const numEl = grandparent.querySelector('[class*="value"],[class*="num"],[class*="count"],[class*="gmv"],[class*="data"]');
            if (numEl && numEl.textContent.trim()) return numEl.textContent.trim();
          }
        }
      }
    }
    return '';
  }

  function getAllText() { return document.body.innerText; }

  function extractByPattern(text, pattern) {
    const m = text.match(pattern);
    return m ? m[1].trim() : '';
  }

  function clickTabByText(tabText) {
    const allEls = document.querySelectorAll('div,span,a,li,button');
    for (const el of allEls) {
      if (el.children.length <= 2 && el.textContent.trim() === tabText) {
        el.click();
        return true;
      }
    }
    return false;
  }

  const fullText = getAllText();

  // ── Tổng quan ──
  const overview = {
    gmv_total:          getText(['GMV sản phẩm bán được']),
    gmv_video:          getText(['GMV video bán được']),
    gmv_livestream:     getText(['GMV livestream bán được']),
    gpm_video_28d:      getText(['GPM Video TMĐT (28 ngày qua)','E-com Video GPM (Last 28 days)']),
    total_videos:       getText(['Tổng số video']),
    sales_videos:       getText(['Video bán hàng']),
    non_sales_videos:   getText(['Không phải video bán hàng']),
    total_plays:        getText(['Tổng số lượt phát']),
    median_views:       getText(['Số lượt xem trung vị','Trung vị lượt xem']),
    avg_engagement_rate:getText(['Tỷ lệ tương tác trung bình']),
    livestream_count:   getText(['Số buổi livestream bán hàng']),
    livestream_avg_revenue: getText(['Doanh số trung bình mỗi buổi Live','Doanh số trung bình mỗi buổi'])
  };

  // ── Audience — cố gắng đọc từ text page ──
  const audience = {
    gender_male:    extractByPattern(fullText, /Nam\\s+([\\d.]+%)/),
    gender_female:  extractByPattern(fullText, /Nữ\\s+([\\d.]+%)/),
    age_18_24:      extractByPattern(fullText, /18-24\\s+([\\d.]+%)/),
    age_25_34:      extractByPattern(fullText, /25-34\\s+([\\d.]+%)/),
    age_35_44:      extractByPattern(fullText, /35-44\\s+([\\d.]+%)/),
    age_45_plus:    extractByPattern(fullText, /(?:45-54|45\\+)\\s+([\\d.]+%)/),
    fan_potential:  extractByPattern(fullText, /Người hâm mộ tiềm năng[^\\d]*(\\d[\\d.]+%)/),
    fan_active:     extractByPattern(fullText, /Người hâm mộ tích cực[^\\d]*(\\d[\\d.]+%)/),
    region_top: (function() {
      const regions = [];
      const cities = ['HO CHI MINH','HA NOI','CAN THO','DONG NAI','BINH DUONG','DA NANG','HAI PHONG'];
      for (const city of cities) {
        const pct = extractByPattern(fullText, new RegExp(city + '\\\\s+([\\\\d.]+%)'));
        if (pct) regions.push({ name: city, percent: pct });
      }
      return regions;
    })()
  };

  // ── Sales ──
  const sales = {
    partner_stores:  getText(['Số cửa hàng hợp tác']),
    total_products:  getText(['Số lượng sản phẩm quảng cáo']),
    total_sales:     getText(['Tổng lượt bán LKTT']),
    total_gmv:       getText(['Tổng Gmv','Tổng GMV']),
    top_categories: (function() {
      const cats = [];
      const catNames = ['Chăm sóc sắc đẹp','Trang phục','Sức khỏe','Thực phẩm','Giày dép','Đồ gia dụng','Mẹ và bé','Other'];
      for (const name of catNames) {
        const pct = extractByPattern(fullText, new RegExp(name.replace(/&/g,'\\\\s*&\\\\s*') + '[^\\\\d]*([\\\\d.]+%)'));
        if (pct) cats.push({ name, percent: pct });
      }
      return cats.slice(0, 5);
    })(),
    top_videos: (function() {
      const videos = [];
      const rows = document.querySelectorAll('table tbody tr, [class*="table"] [class*="row"], [class*="video-item"], [class*="VideoItem"]');
      rows.forEach((row, i) => {
        if (i >= 5) return;
        const cells = row.querySelectorAll('td, [class*="cell"], [class*="col"]');
        if (cells.length >= 3) {
          videos.push({
            title:           cells[0]?.textContent?.trim().slice(0,60) || '',
            duration:        cells[0]?.querySelector('[class*="time"],[class*="duration"]')?.textContent?.trim() || '',
            sales_count:     cells[1]?.textContent?.trim() || '',
            revenue:         cells[2]?.textContent?.trim() || '',
            views:           cells[3]?.textContent?.trim() || '',
            engagement_rate: cells[4]?.textContent?.trim() || '',
            product_name:    cells[5]?.textContent?.trim().slice(0,50) || '',
            category:        ''
          });
        }
      });
      return videos;
    })()
  };

  return { overview, audience, sales };
})();
`;

// Helper: inject script vào FastMoss window và lấy kết quả
async function scrapeFastMossSection(win: BrowserWindow, script: string, waitMs = 2000): Promise<any> {
  await new Promise(r => setTimeout(r, waitMs));
  try {
    return await win.webContents.executeJavaScript(script);
  } catch (e) {
    logger.warn(`[KOC Scraper] Script error: ${e}`);
    return null;
  }
}

// Click tab trong FastMoss theo text
async function clickFastMossTab(win: BrowserWindow, tabText: string): Promise<void> {
  const clickScript = `
    (function() {
      const els = document.querySelectorAll('div,span,li,a');
      for (const el of els) {
        if (el.children.length <= 2 && el.textContent.trim() === '${tabText}') {
          el.click(); return true;
        }
      }
      return false;
    })()
  `;
  await win.webContents.executeJavaScript(clickScript).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
}

// Tính toán computed metrics
function computeKOCMetrics(scrapeData: any): any {
  const { overview, sales } = scrapeData;
  const totalVids = parseInt(overview.total_videos?.replace(/[^\d]/g, '') || '0');
  const salesVids = parseInt(overview.sales_videos?.replace(/[^\d]/g, '') || '0');
  const ratio = totalVids > 0 ? ((salesVids / totalVids) * 100).toFixed(1) + '%' : 'N/A';

  // Est. GMV/video: trung vị views * GPM (lấy số nhỏ trong range)
  const medianViews = parseFloat(overview.median_views?.replace(/[^\d.]/g, '') || '0');
  const medianUnit = /Tr/i.test(overview.median_views || '') ? 1000000 : /k/i.test(overview.median_views || '') ? 1000 : 1;
  const medianViewsNum = medianViews * medianUnit;
  const gpmStr = overview.gpm_video_28d || '';
  const gpmMatch = gpmStr.match(/([\d,]+)/);
  const gpmNum = gpmMatch ? parseFloat(gpmMatch[1].replace(/,/g, '')) : 0;
  const estGmv = medianViewsNum > 0 && gpmNum > 0
    ? ((medianViewsNum * gpmNum) / 1000).toLocaleString('vi-VN') + ' đ'
    : 'N/A';

  // TB doanh thu top 5 video
  const top5 = sales.top_videos?.slice(0, 5) || [];
  const avgTop5 = top5.length > 0
    ? top5.map((v: any) => v.revenue || '').filter(Boolean).join(', ')
    : 'N/A';

  return {
    video_sales_ratio: ratio,
    est_gmv_per_video: estGmv,
    avg_revenue_top5: avgTop5
  };
}

// ── IPC: analyze-koc ────────────────────────────────────────────────────────
ipcMain.handle('analyze-koc', async (event, authorId: string, username: string) => {
  const sender = event.sender;
  const sendProgress = (step: number, total: number, label: string, percent: number, status = 'running') => {
    sender.send('koc-progress', { step, totalSteps: total, label, percent, status });
  };

  try {
    // Kiểm tra API key
    const apiKey = getSettingValue('anthropicApiKey');
    if (!apiKey) return { success: false, error: 'Chưa cấu hình Anthropic API Key. Vào Settings để thêm.' };

    // Kiểm tra cookies
    const cookieResult = db?.exec('SELECT value FROM settings WHERE key = ?', ['fastmossCookies']);
    if (!cookieResult?.length || !cookieResult[0].values[0][0]) {
      return { success: false, error: 'Chưa cấu hình FastMoss cookies. Vào Settings để thêm.' };
    }
    const cookies = parseFastMossCookies(cookieResult[0].values[0][0] as string);
    await loadFastMossCookiesToSession(cookies);

    // ── Bước 1: Mở FastMoss detail page (cửa sổ riêng — app vẫn ở trang KOC) ─
    sendProgress(1, 5, 'Đang mở trang KOC trên FastMoss...', 5);
    const detailUrl = `https://www.fastmoss.com/vi/influencer/detail/${authorId}`;

    // Tạo hoặc tái sử dụng FastMoss window
    if (!fastMossWindow || fastMossWindow.isDestroyed()) {
      const win = new BrowserWindow({
        width: 1400, height: 900, minWidth: 1000, minHeight: 700,
        title: `FastMoss - @${username}`,
        webPreferences: {
          nodeIntegration: false, contextIsolation: true,
          sandbox: false, partition: FASTMOSS_PARTITION
        },
        backgroundColor: '#ffffff',
        show: false  // Hiện sau khi load xong để tránh flash
      });
      fastMossWindow = win;
      win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('fastmoss.com')) win.loadURL(url);
        else shell.openExternal(url);
        return { action: 'deny' };
      });
      win.on('closed', () => { fastMossWindow = null; });
      // Load URL rồi show — window nổi lên độc lập, app renderer không bị ảnh hưởng
      win.loadURL(detailUrl);
      win.once('ready-to-show', () => win.show());
    } else {
      // Đã có window: navigate đến trang mới rồi focus
      fastMossWindow.loadURL(detailUrl);
      fastMossWindow.show();
      fastMossWindow.focus();
    }

    // Chờ FastMoss page load (timeout 10s, không block nếu chậm)
    await new Promise<void>((resolve) => {
      if (!fastMossWindow || fastMossWindow.isDestroyed()) { resolve(); return; }
      const timeout = setTimeout(resolve, 10000);
      fastMossWindow.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        // Thêm 2.5s cho React hydrate & dữ liệu async FastMoss render
        setTimeout(resolve, 2500);
      });
    });

    // ── Bước 2: Scrape tổng quan + audience ──────────────────────────────────
    sendProgress(2, 5, 'Đang thu thập GMV & tổng quan...', 25);
    const rawData = await scrapeFastMossSection(fastMossWindow!, FASTMOSS_SCRAPER_SCRIPT, 1000);

    // ── Bước 3: Click tab Phân tích người theo dõi ───────────────────────────
    sendProgress(3, 5, 'Đang đọc dữ liệu khán giả...', 50);
    await clickFastMossTab(fastMossWindow!, 'Phân tích người theo dõi');
    const audienceData = await scrapeFastMossSection(fastMossWindow!, FASTMOSS_SCRAPER_SCRIPT, 1000);

    // ── Bước 4: Click tab Phân tích bán hàng ─────────────────────────────────
    sendProgress(4, 5, 'Đang đọc top video & sản phẩm...', 70);
    await clickFastMossTab(fastMossWindow!, 'Phân tích bán hàng');
    const salesData = await scrapeFastMossSection(fastMossWindow!, FASTMOSS_SCRAPER_SCRIPT, 1500);

    // Merge dữ liệu từ các lần scrape
    const mergedData = {
      username,
      authorId,
      scrapedAt: new Date().toISOString(),
      overview: {
        ...(rawData?.overview || {}),
        ...(audienceData?.overview || {}),
        ...(salesData?.overview || {})
      },
      audience: {
        ...(rawData?.audience || {}),
        ...(audienceData?.audience || {}),
        region_top: audienceData?.audience?.region_top?.length
          ? audienceData.audience.region_top
          : rawData?.audience?.region_top || []
      },
      sales: {
        ...(rawData?.sales || {}),
        ...(salesData?.sales || {}),
        top_videos: salesData?.sales?.top_videos?.length
          ? salesData.sales.top_videos
          : rawData?.sales?.top_videos || []
      }
    };

    const computed = computeKOCMetrics(mergedData);

    // ── Bước 5: AI phân tích ──────────────────────────────────────────────────
    sendProgress(5, 5, 'AI đang phân tích dữ liệu...', 85);
    const aiService = new AIService(apiKey);
    const aiResult = await aiService.analyzeKOCFromFastMoss(mergedData, computed);

    // Build final result
    const reportId = uuidv4();
    const result = {
      id: reportId,
      username,
      authorId,
      createdAt: new Date().toISOString(),
      scrapeData: mergedData,
      computed,
      analysis: aiResult
    };

    // Lưu vào DB
    if (db) {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [`koc_report_${reportId}`, JSON.stringify(result)]
      );
      saveDatabase();
    }

    sendProgress(5, 5, 'Phân tích hoàn tất!', 100, 'done');
    return { success: true, data: result };

  } catch (err) {
    logger.error(`[KOC] Analysis error: ${err}`);
    sendProgress(0, 5, `Lỗi: ${(err as Error).message}`, 0, 'error');
    return { success: false, error: (err as Error).message };
  }
});

// ── IPC: get-koc-history ────────────────────────────────────────────────────
ipcMain.handle('get-koc-history', async (_event, limit = 20) => {
  try {
    if (!db) return { success: false, error: 'DB not ready' };
    const result = db.exec("SELECT key, value FROM settings WHERE key LIKE 'koc_report_%' ORDER BY key DESC LIMIT ?", [limit]);
    const reports = result.length > 0
      ? result[0].values.map((row: any) => JSON.parse(row[1] as string))
      : [];
    return { success: true, data: reports };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

// ── IPC: export-koc-report ──────────────────────────────────────────────────
ipcMain.handle('export-koc-report', async (_event, reportId: string) => {
  try {
    if (!db) return { success: false, error: 'DB not ready' };
    const result = db.exec('SELECT value FROM settings WHERE key = ?', [`koc_report_${reportId}`]);
    if (!result.length || !result[0].values[0][0]) return { success: false, error: 'Không tìm thấy báo cáo' };

    const report = JSON.parse(result[0].values[0][0] as string);
    const { data: savePath } = await dialog.showSaveDialog({
      defaultPath: `KOC_Report_${report.username}_${new Date().toISOString().slice(0, 10)}.html`,
      filters: [{ name: 'HTML Report', extensions: ['html'] }]
    });
    if (!savePath) return { success: false, error: 'Cancelled' };

    const html = generateKOCReportHTML(report);
    fs.writeFileSync(savePath, html, 'utf-8');
    shell.openPath(savePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

// Tạo HTML report đẹp
function generateKOCReportHTML(report: any): string {
  const { username, createdAt, scrapeData, computed, analysis } = report;
  const { overview, audience, sales } = scrapeData;
  const scoreColor = (s: number) => s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444';
  const recLabel: Record<string, string> = { excellent: 'Xuất sắc', good: 'Tốt', fair: 'Trung bình', poor: 'Yếu' };

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KOC Report — @${username}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
  .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 32px 40px; }
  .header h1 { font-size: 28px; font-weight: 700; }
  .header p { opacity: 0.8; margin-top: 4px; }
  .container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
  .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .card-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin-bottom: 16px; }
  .score-circle { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: white; margin-bottom: 8px; }
  .metric { margin-bottom: 12px; }
  .metric-label { font-size: 12px; color: #94a3b8; margin-bottom: 2px; }
  .metric-value { font-size: 18px; font-weight: 700; color: #1e293b; }
  .tag { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 500; margin: 3px; }
  .tag-green { background: #dcfce7; color: #166534; }
  .tag-blue { background: #dbeafe; color: #1e40af; }
  .tag-red { background: #fee2e2; color: #991b1b; }
  .tag-yellow { background: #fef9c3; color: #854d0e; }
  ul { list-style: none; padding: 0; }
  ul li { padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; display: flex; align-items: flex-start; gap: 8px; }
  ul li:before { content: "•"; color: #6366f1; font-weight: bold; flex-shrink: 0; }
  .bar-wrap { background: #f1f5f9; border-radius: 4px; height: 8px; margin-top: 4px; }
  .bar-fill { height: 8px; border-radius: 4px; background: linear-gradient(90deg, #6366f1, #8b5cf6); }
  .section-title { font-size: 20px; font-weight: 700; margin: 28px 0 16px; color: #1e293b; display: flex; align-items: center; gap: 8px; }
  .overall-score { font-size: 48px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
  .footer { text-align: center; padding: 24px; color: #94a3b8; font-size: 12px; }
</style>
</head>
<body>
<div class="header">
  <h1>📊 KOC Report — @${username}</h1>
  <p>Phân tích bởi AI • ${new Date(createdAt).toLocaleString('vi-VN')} • Dữ liệu từ FastMoss</p>
</div>
<div class="container">

  <!-- Overall Score -->
  <div class="card" style="margin-bottom:20px; display:flex; align-items:center; gap:32px;">
    <div>
      <div class="metric-label">Điểm tổng thể</div>
      <div class="overall-score" style="color:${scoreColor(analysis?.brand_recommendation?.overall_score || 0)}">
        ${analysis?.brand_recommendation?.overall_score || '--'}<span style="font-size:24px">/100</span>
      </div>
      <div style="margin-top:8px">
        <span class="tag tag-blue">${analysis?.brand_recommendation?.tier?.toUpperCase() || 'N/A'}</span>
        <span class="tag tag-green">${recLabel[analysis?.brand_recommendation?.recommendation] || ''}</span>
      </div>
    </div>
    <div style="flex:1">
      ${['sales_capability','audience_quality','content_quality'].map(k => `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span>${k === 'sales_capability' ? '💰 Năng lực bán hàng' : k === 'audience_quality' ? '👥 Chất lượng khán giả' : '🎬 Chất lượng nội dung'}</span>
          <span style="font-weight:700;color:${scoreColor(analysis?.[k]?.score||0)}">${analysis?.[k]?.score||0}/100</span>
        </div>
        <div class="bar-wrap"><div class="bar-fill" style="width:${analysis?.[k]?.score||0}%"></div></div>
      </div>`).join('')}
    </div>
  </div>

  <!-- GMV Summary -->
  <div class="section-title">💰 Năng lực bán hàng</div>
  <div class="grid4">
    <div class="card"><div class="metric-label">GMV Tổng</div><div class="metric-value">${overview.gmv_total||'N/A'}</div></div>
    <div class="card"><div class="metric-label">GMV Video</div><div class="metric-value">${overview.gmv_video||'N/A'}</div></div>
    <div class="card"><div class="metric-label">GMV Livestream</div><div class="metric-value">${overview.gmv_livestream||'N/A'}</div></div>
    <div class="card"><div class="metric-label">GPM Video 28 ngày</div><div class="metric-value" style="font-size:14px">${overview.gpm_video_28d||'N/A'}</div></div>
  </div>
  <div class="grid4">
    <div class="card"><div class="metric-label">Tổng video</div><div class="metric-value">${overview.total_videos||'N/A'}</div></div>
    <div class="card"><div class="metric-label">Video bán hàng</div><div class="metric-value">${overview.sales_videos||'N/A'} <span style="font-size:13px;color:#64748b">(${computed.video_sales_ratio})</span></div></div>
    <div class="card"><div class="metric-label">Cửa hàng hợp tác</div><div class="metric-value">${sales.partner_stores||'N/A'}</div></div>
    <div class="card"><div class="metric-label">Est. GMV/video</div><div class="metric-value" style="font-size:15px">${computed.est_gmv_per_video}</div></div>
  </div>
  <div class="card" style="margin-bottom:20px">
    <div class="card-title">Nhận xét AI</div>
    <p style="font-size:14px;line-height:1.7;color:#374151">${analysis?.sales_capability?.ai_comment||''}</p>
    <div style="margin-top:12px">${(analysis?.sales_capability?.highlights||[]).map((h:string)=>`<span class="tag tag-green">${h}</span>`).join('')}</div>
  </div>

  <!-- Top Videos -->
  ${sales.top_videos?.length ? `
  <div class="section-title">🏆 Top Video Bán Hàng</div>
  <div class="card" style="margin-bottom:20px;overflow-x:auto">
    <table>
      <thead><tr><th>Video</th><th>Doanh thu</th><th>Lượt xem</th><th>ER</th><th>Sản phẩm</th></tr></thead>
      <tbody>
        ${sales.top_videos.slice(0,5).map((v:any,i:number)=>`
        <tr>
          <td><strong>#${i+1}</strong> ${v.title?.slice(0,40)||'N/A'}${v.duration?` <span style="color:#94a3b8">(${v.duration})</span>`:''}</td>
          <td style="font-weight:700;color:#6366f1">${v.revenue||'-'}</td>
          <td>${v.views||'-'}</td>
          <td>${v.engagement_rate||'-'}</td>
          <td style="font-size:12px">${v.product_name?.slice(0,40)||'-'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Audience -->
  <div class="section-title">👥 Chất lượng khán giả</div>
  <div class="grid2">
    <div class="card">
      <div class="card-title">Giới tính & Độ tuổi</div>
      ${[['Nam', audience.gender_male],['Nữ', audience.gender_female]].map(([l,v])=>`
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>${l}</span><span style="font-weight:600">${v||'N/A'}</span></div>
        <div class="bar-wrap"><div class="bar-fill" style="width:${v||'0'}"></div></div>
      </div>`).join('')}
      <div style="margin-top:16px">
        ${[['18-24',audience.age_18_24],['25-34',audience.age_25_34],['35-44',audience.age_35_44],['45+',audience.age_45_plus]].map(([l,v])=>`
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
          <span style="color:#64748b">${l}</span><span style="font-weight:600">${v||'N/A'}</span>
        </div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Khu vực & Fan</div>
      ${(audience.region_top||[]).map((r:any)=>`
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>${r.name}</span><span style="font-weight:600">${r.percent}</span></div>
        <div class="bar-wrap"><div class="bar-fill" style="width:${r.percent}"></div></div>
      </div>`).join('')}
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f1f5f9">
        <div style="font-size:13px;display:flex;justify-content:space-between;margin-bottom:6px">
          <span>Fan tiềm năng</span><span style="font-weight:600;color:#6366f1">${audience.fan_potential||'N/A'}</span>
        </div>
        <div style="font-size:13px;display:flex;justify-content:space-between">
          <span>Fan tích cực</span><span style="font-weight:600;color:#22c55e">${audience.fan_active||'N/A'}</span>
        </div>
      </div>
    </div>
  </div>
  <div class="card" style="margin-bottom:20px">
    <div class="card-title">Nhận xét AI</div>
    <p style="font-size:14px;line-height:1.7;color:#374151">${analysis?.audience_quality?.ai_comment||''}</p>
  </div>

  <!-- Content Quality -->
  <div class="section-title">🎬 Chất lượng nội dung</div>
  <div class="grid4">
    <div class="card"><div class="metric-label">Trung vị views</div><div class="metric-value">${overview.median_views||'N/A'}</div></div>
    <div class="card"><div class="metric-label">ER trung bình</div><div class="metric-value">${overview.avg_engagement_rate||'N/A'}</div></div>
    <div class="card"><div class="metric-label">Est. GMV/video</div><div class="metric-value" style="font-size:15px">${computed.est_gmv_per_video}</div></div>
    <div class="card"><div class="metric-label">GPM Video 28 ngày</div><div class="metric-value" style="font-size:14px">${overview.gpm_video_28d||'N/A'}</div></div>
  </div>
  <div class="card" style="margin-bottom:20px">
    <div class="card-title">Nhận xét AI</div>
    <p style="font-size:14px;line-height:1.7;color:#374151">${analysis?.content_quality?.ai_comment||''}</p>
  </div>

  <!-- Brand Recommendation -->
  <div class="section-title">💡 Đề xuất cho Brand</div>
  <div class="grid2">
    <div class="card">
      <div class="card-title">Ngành hàng phù hợp</div>
      <div>${(analysis?.brand_recommendation?.fit_categories||[]).map((c:string)=>`<span class="tag tag-blue">${c}</span>`).join('')}</div>
      <div class="card-title" style="margin-top:16px">Chiến lược nội dung</div>
      <ul>${(analysis?.brand_recommendation?.content_strategy||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul>
    </div>
    <div class="card">
      <div class="card-title">Gợi ý cho Brand</div>
      <ul>${(analysis?.brand_recommendation?.suggestions||[]).map((s:string)=>`<li>${s}</li>`).join('')}</ul>
      <div class="card-title" style="margin-top:16px">Rủi ro / Lưu ý</div>
      <ul>${(analysis?.brand_recommendation?.risks||[]).map((r:string)=>`<li style="color:#ef4444">${r}</li>`).join('')}</ul>
    </div>
  </div>

</div>
<div class="footer">Báo cáo được tạo bởi TikTok Preview & Download • AI: Claude Haiku 4.5 • Dữ liệu: FastMoss</div>
</body>
</html>`;
}
