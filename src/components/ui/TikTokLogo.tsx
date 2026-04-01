/**
 * TikTok Logo Icon Component
 * 
 * @author Phongdepzai
 * @version 2.0.0
 */

import React from 'react';

interface TikTokLogoProps {
  className?: string;
  size?: number;
}

export function TikTokLogo({ className = '', size = 24 }: TikTokLogoProps) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      width={size} 
      height={size}
      className={className}
      fill="none"
    >
      {/* TikTok musical note icon */}
      <path
        d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"
        fill="currentColor"
      />
    </svg>
  );
}

export function TikTokLogoGradient({ className = '', size = 24 }: TikTokLogoProps) {
  const id = React.useId();
  
  return (
    <svg 
      viewBox="0 0 24 24" 
      width={size} 
      height={size}
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id={`tiktok-gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#25F4EE" />
          <stop offset="50%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FE2C55" />
        </linearGradient>
      </defs>
      {/* TikTok musical note icon with gradient */}
      <path
        d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"
        fill={`url(#tiktok-gradient-${id})`}
      />
    </svg>
  );
}

export default TikTokLogo;
