import { NavLink } from 'react-router-dom';
import {
  Home,
  History,
  Download,
  Settings,
  Users,
  Info
} from 'lucide-react';
import { TikTokLogo } from '../ui/TikTokLogo';

const navItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/influencer', icon: Users, label: 'Influencer' },
  { path: '/history', icon: History, label: 'History' },
  { path: '/downloads', icon: Download, label: 'Downloads' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/about', icon: Info, label: 'About' },
];

function Sidebar() {
  return (
    <aside className="w-64 h-full bg-black/30 backdrop-blur-xl border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/5 titlebar-drag">
        <div className="flex items-center gap-3 titlebar-no-drag">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tiktok-cyan via-white to-tiktok-red flex items-center justify-center">
            <TikTokLogo className="text-black" size={22} />
          </div>
          <div>
            <h1 className="font-display font-bold text-white">TikTok</h1>
            <p className="text-xs text-white/50">Preview & Download</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-white/50">v2.0.0 Ready</span>
          </div>
          <p className="text-xs text-white/30">
            Credit by Phongdepzai
          </p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
