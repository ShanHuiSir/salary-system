import logoDark from '@/assets/brand/logo-dark.png';
import { cn } from '@/lib/utils';

interface CompanyLogoProps {
  className?: string;
  imageClassName?: string;
}

export function CompanyLogo({ className, imageClassName }: CompanyLogoProps) {
  return (
    <div className={cn('flex items-center', className)}>
      <img
        src={logoDark}
        alt="EXCEPTION de MIXMIND 例外"
        className={cn('block h-auto w-full object-contain', imageClassName)}
        draggable={false}
      />
    </div>
  );
}
