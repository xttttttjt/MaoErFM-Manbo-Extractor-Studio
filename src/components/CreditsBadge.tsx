import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface CreditsBadgeProps {
  className?: string;
  showIcon?: boolean;
}

export const CreditsBadge: React.FC<CreditsBadgeProps> = ({
  className = '',
  showIcon = false,
}) => {
  const { t } = useLanguage();

  return (
    <span className={`inline-flex items-center flex-wrap gap-1 text-slate-400 ${className}`}>
      <span>{t('creditInspiredBy')}</span>
      <a
        href="https://www.threads.com/@celinewang.94"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-sky-400 hover:text-sky-300 underline underline-offset-2 decoration-sky-500/40 hover:decoration-sky-300 inline-flex items-center gap-0.5 transition-colors"
        title="Threads @celinewang.94"
      >
        <span>@celinewang.94</span>
        {showIcon && <ExternalLink className="w-2.5 h-2.5 opacity-70" />}
      </a>
      <span>, {t('creditAdjustedBy')}</span>
      <a
        href="https://www.threads.com/@xttttttjt_"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-sky-400 hover:text-sky-300 underline underline-offset-2 decoration-sky-500/40 hover:decoration-sky-300 inline-flex items-center gap-0.5 transition-colors"
        title="Threads @xttttttjt_"
      >
        <span>@xttttttjt_</span>
        {showIcon && <ExternalLink className="w-2.5 h-2.5 opacity-70" />}
      </a>
      <span className="text-slate-500">{t('creditOnThreads')}</span>
    </span>
  );
};
