import { useState, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  thumbnail?: string;
  className?: string;
}

function VideoPlayer({ url, thumbnail, className = '' }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;
    
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const handleThumbnailClick = () => {
    setShowVideo(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play();
        setPlaying(true);
      }
    }, 100);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration;
    setCurrentTime(current);
    setProgress((current / total) * 100);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  // Seek video when clicking on progress bar
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!videoRef.current || !progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percent = clickX / width;
    const newTime = percent * videoRef.current.duration;
    
    videoRef.current.currentTime = newTime;
    setProgress(percent * 100);
    setCurrentTime(newTime);
  }, []);

  const handleFullscreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  }, []);

  const handleMuteToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMuted(!muted);
  }, [muted]);

  // If no URL, show thumbnail only
  if (!url) {
    return (
      <div className={`relative group rounded-xl overflow-hidden bg-black ${className}`}>
        {thumbnail && (
          <img 
            src={thumbnail} 
            alt="Video thumbnail" 
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="text-white/70 text-sm text-center px-4">
            Video preview not available
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl overflow-hidden bg-black ${className}`}>
      {/* Thumbnail with play button (before video loads) */}
      {!showVideo && thumbnail && (
        <div 
          className="absolute inset-0 cursor-pointer z-10"
          onClick={handleThumbnailClick}
        >
          <img 
            src={thumbnail} 
            alt="Video thumbnail" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-8 h-8 text-black ml-1" />
            </div>
          </div>
        </div>
      )}

      {/* HTML5 Video */}
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-contain"
        muted={muted}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {/* Controls - Always visible when video is shown */}
      {showVideo && (
        <div className="absolute inset-0 flex flex-col justify-end pointer-events-none">
          {/* Click area for play/pause - covers video but not controls */}
          <div 
            className="absolute inset-0 bottom-16 cursor-pointer pointer-events-auto"
            onClick={handlePlayPause}
          />
          
          {/* Gradient background for controls */}
          <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 pb-2 px-3 pointer-events-auto">
            {/* Progress bar - Clickable to seek */}
            <div 
              ref={progressRef}
              className="relative h-1.5 bg-white/30 rounded-full cursor-pointer mb-3 group/progress"
              onClick={handleSeek}
            >
              {/* Buffered/Progress */}
              <div 
                className="absolute top-0 left-0 h-full bg-tiktok-red rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
              {/* Seek handle */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Play/Pause button */}
                <button 
                  onClick={handlePlayPause}
                  className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  {playing ? (
                    <Pause className="w-4 h-4 text-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  )}
                </button>
                
                {/* Mute/Unmute button */}
                <button 
                  onClick={handleMuteToggle}
                  className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  {muted ? (
                    <VolumeX className="w-4 h-4 text-white" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white" />
                  )}
                </button>
                
                {/* Time display */}
                <span className="text-white/80 text-xs font-medium ml-1">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              
              {/* Fullscreen button */}
              <button 
                onClick={handleFullscreen}
                className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <Maximize className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
