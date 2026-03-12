import RichText from '@/lib/components/RichText/index';

export interface BannerBlockProps {
  className: string;
  style: 'info' | 'warning' | 'error' | 'success';
  content: {
    root: {
      type: string;
      children: {
        type: string;
        version: number;
        [k: string]: unknown;
      }[];
      direction: ('ltr' | 'rtl') | null;
      format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
      indent: number;
      version: number;
    };
    [k: string]: unknown;
  };
  id?: string | null;
  blockName?: string | null;
  blockType: 'banner';
}

export const BannerBlock = ({ className, content, style }: BannerBlockProps) => {
  function cn(...args: (string | Record<string, boolean> | undefined)[]): string {
    return args
      .flatMap((arg) => {
        if (!arg) return [];
        if (typeof arg === 'string') return arg.split(' ');
        return Object.entries(arg)
          .filter(([, value]) => value)
          .map(([key]) => key);
      })
      .filter(Boolean)
      .join(' ');
  }

  return (
    <div className={cn('mx-auto my-8 w-full', className)}>
      <div
        className={cn('border py-3 px-6 flex items-center rounded', {
          'border-border bg-card': style === 'info',
          'border-error bg-error/30': style === 'error',
          'border-success bg-success/30': style === 'success',
          'border-warning bg-warning/30': style === 'warning',
        })}
      >
        <RichText content={content} enableGutter={false} enableProse={false} />
      </div>
    </div>
  );
};
