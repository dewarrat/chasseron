interface BadgeProps {
  className?: string;
  children: React.ReactNode;
}

export default function Badge({ className = '', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}
