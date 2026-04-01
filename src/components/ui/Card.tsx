import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

function Card({ children, className = '', hover = false, onClick }: CardProps) {
  const baseClasses = hover ? 'card-hover' : 'card';
  
  return (
    <div 
      className={`${baseClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export default Card;
