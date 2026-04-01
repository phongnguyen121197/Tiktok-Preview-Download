import { useLocation } from 'react-router-dom';
import { 
  Home, 
  Users, 
  History, 
  Download, 
  Settings,
  Bell
} from 'lucide-react';

const pageTitles: Record<string, { title: string; description: string; icon: typeof Home }> = {
  '/': { 
    title: 'Dashboard', 
    description: 'Preview and download TikTok videos',
    icon: Home
  },
  '/channel': { 
    title: 'Channel Explorer', 
    description: 'Browse videos from any TikTok profile',
    icon: Users
  },
  '/history': { 
    title: 'History', 
    description: 'View your browsing and download history',
    icon: History
  },
  '/downloads': { 
    title: 'Downloads', 
    description: 'Manage your active and completed downloads',
    icon: Download
  },
  '/settings': { 
    title: 'Settings', 
    description: 'Configure app preferences',
    icon: Settings
  },
};

function Header() {
  const location = useLocation();
  const currentPage = pageTitles[location.pathname] || pageTitles['/'];
  const Icon = currentPage.icon;

  return (
    <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 titlebar-drag">
      <div className="flex items-center gap-4 titlebar-no-drag">
        <div className="w-10 h-10 rounded-xl glass flex items-center justify-center">
          <Icon className="w-5 h-5 text-tiktok-red" />
        </div>
        <div>
          <h2 className="font-display font-semibold text-white">{currentPage.title}</h2>
          <p className="text-sm text-white/50">{currentPage.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 titlebar-no-drag">
        <button className="btn btn-ghost p-2 rounded-xl">
          <Bell className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

export default Header;
