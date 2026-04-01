/**
 * About Page Component
 * 
 * @author Phongdepzai
 * @version 2.0.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Info,
  Heart,
  Coffee,
  Github,
  Globe,
  Mail,
  Star,
  Zap,
  Shield,
  Users,
  Download,
  ChevronRight
} from 'lucide-react';
import Card from '../components/ui/Card';
import donateQrImage from '../assets/donate-qr.jpg';

interface AppInfo {
  version: string;
  platform: string;
  arch: string;
  electronVersion: string;
  nodeVersion: string;
}

function About() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    loadAppInfo();
  }, []);

  const loadAppInfo = async () => {
    try {
      const info = await window.electronAPI?.getAppInfo?.();
      if (info) {
        setAppInfo(info);
      }
    } catch (error) {
      console.error('Failed to load app info:', error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-tiktok-cyan via-purple-500 to-tiktok-red flex items-center justify-center">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-white">
              TikTok Preview & Download
            </h2>
            <p className="text-white/50">
              Version {appInfo?.version || '2.0.0'} • FastMoss Integration
            </p>
          </div>
        </div>
      </Card>

      {/* Features */}
      <Card>
        <h3 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          Tính năng chính
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { icon: Download, label: 'Download video TikTok không watermark', color: 'text-green-400' },
            { icon: Users, label: 'FastMoss Influencer Analytics', color: 'text-blue-400' },
            { icon: Shield, label: 'TikTok Shop product detection', color: 'text-purple-400' },
            { icon: Zap, label: 'Fast & lightweight', color: 'text-yellow-400' }
          ].map((feature, idx) => (
            <div key={idx} className="glass rounded-xl p-3 flex items-center gap-3">
              <feature.icon className={`w-5 h-5 ${feature.color}`} />
              <span className="text-sm text-white/80">{feature.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Donate Section */}
      <Card className="border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-purple-500/5">
        <div className="flex flex-col md:flex-row gap-6">
          {/* QR Code */}
          <div className="flex-shrink-0">
            <div className="w-48 h-48 bg-white rounded-xl p-2 mx-auto md:mx-0 overflow-hidden">
              <img 
                src={donateQrImage}
                alt="QR Donate"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          </div>
          
          {/* Donate Info */}
          <div className="flex-1">
            <h3 className="font-display font-semibold text-white mb-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-400" />
              Ủng hộ tác giả
            </h3>
            <p className="text-white/70 mb-4 text-sm leading-relaxed">
              Nếu bạn thấy ứng dụng này hữu ích, hãy mua cho mình một ly cà phê nhé! 
              Mỗi đóng góp của bạn sẽ giúp mình có thêm động lực phát triển nhiều tính năng mới hơn.
            </p>
            
            <div className="space-y-3">
              <div className="glass rounded-xl p-3">
                <p className="text-xs text-white/50 mb-1">Ngân hàng</p>
                <p className="text-white font-medium">Techcombank - Phong Nguyen</p>
              </div>
              <div className="glass rounded-xl p-3">
                <p className="text-xs text-white/50 mb-1">Nội dung chuyển khoản</p>
                <p className="text-tiktok-cyan font-medium">Thankyou</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

    </div>
  );
}

export default About;
