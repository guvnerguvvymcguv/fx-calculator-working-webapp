import React, { ReactNode } from 'react';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedCard({ children, className = '' }: AnimatedCardProps) {
  return (
    <div className={`animated-gradient-card ${className}`}>
      <div className="animated-gradient-card-content">
        {children}
      </div>
    </div>
  );
}
