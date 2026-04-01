# TikTok Preview & Download

Desktop application for TikTok content - Preview, download TikTok videos & Influencer Analytics.

**Credit by Phongdepzai**

## 🌟 Features

### 📹 Dashboard - Preview & Download
- Paste TikTok video URL to preview
- View video info: views, likes, comments, shares
- Download video without watermark (HD quality)
- Quick download buttons

### 👥 Influencer Analytics
- Search TikTok influencers via FastMoss
- View GMV, followers, engagement metrics
- Auto-fill search with TikTok URL
- Direct access to FastMoss dashboard

### 📜 History
- Track all previewed videos
- Search and filter history
- Re-preview or re-download easily

### 📥 Downloads
- Manage all downloaded videos
- Open file location
- Delete downloads

### ⚙️ Settings
- Configure RapidAPI key for video info
- Configure FastMoss cookies for influencer analytics
- Customize download path

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Development
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev:electron
```

### Build for Production

**Windows:**
```bash
npm run build:win
```
Output: `release/TikTok Preview & Download Setup x.x.x.exe`

**macOS:**
```bash
npm run build:mac
```
Output: `release/TikTok Preview & Download-x.x.x.dmg`

**Linux:**
```bash
npm run build
```
Output: `release/TikTok Preview & Download-x.x.x.AppImage`

## 📋 Configuration

### RapidAPI Key (for video preview)
1. Go to [RapidAPI](https://rapidapi.com)
2. Subscribe to a TikTok Scraper API
3. Copy your API key
4. Paste in Settings → RapidAPI Key

### FastMoss Cookies (for influencer analytics)
1. Login to [FastMoss](https://www.fastmoss.com) in your browser
2. Open DevTools (F12) → Application → Cookies
3. Copy all cookies
4. Paste in Settings → FastMoss Cookies

## 🎯 Usage

### Preview TikTok Video
1. Copy a TikTok video URL
2. Paste in Dashboard search box
3. Click "Tìm kiếm" (Search)
4. View video preview and info
5. Click download button to save

### Search Influencer
1. Go to Influencer tab
2. Enter TikTok username (e.g., @username)
3. Click "Mở FastMoss"
4. FastMoss window opens with auto-search

## 📁 Project Structure

```
tiktok-preview-download/
├── electron/           # Electron main process
│   ├── main.ts        # Main entry point
│   └── preload.ts     # Preload script
├── src/               # React frontend
│   ├── components/    # UI components
│   ├── pages/         # Page components
│   ├── stores/        # Zustand stores
│   └── types/         # TypeScript types
├── dist/              # Built frontend
├── dist-electron/     # Built electron
└── release/           # Packaged app
```

## 🔧 Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS
- **Desktop:** Electron 28
- **State:** Zustand
- **Database:** SQLite (sql.js)
- **Build:** Vite, electron-builder

## 📄 License

MIT License - Credit by Phongdepzai

## 🐛 Troubleshooting

### Video không load được
- Kiểm tra RapidAPI key đã đúng chưa
- Kiểm tra kết nối internet
- Thử lại sau vài giây

### FastMoss không hoạt động
- Kiểm tra cookies đã hết hạn chưa
- Đăng nhập lại FastMoss và copy cookies mới
- Đảm bảo tài khoản FastMoss còn hiệu lực

### App bị crash
- Xóa folder `%APPDATA%/tiktok-preview-download` (Windows)
- Xóa folder `~/Library/Application Support/tiktok-preview-download` (macOS)
- Cài đặt lại app

---

**Version:** 1.0.0  
**Author:** Phongdepzai  
**Copyright:** © 2024 Phongdepzai
