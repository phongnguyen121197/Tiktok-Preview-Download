interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3'
  };

  return (
    <div 
      className={`${sizeClasses[size]} border-white/20 border-t-tiktok-red rounded-full animate-spin ${className}`}
    />
  );
}

export function LoadingDots() {
  return (
    <span className="inline-flex">
      <span className="animate-pulse">.</span>
      <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>.</span>
      <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>.</span>
    </span>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`bg-white/5 rounded-lg animate-pulse ${className}`}
    />
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="card space-y-4">
      <Skeleton className="aspect-video rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function MetadataSkeleton() {
  return (
    <div className="card space-y-4">
      <div className="flex gap-4">
        <Skeleton className="w-48 aspect-video rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
