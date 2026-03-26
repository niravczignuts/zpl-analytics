'use client';

/**
 * AIContent — renders AI-generated markdown text with proper formatting.
 * Handles: **bold**, bullet points (- or •), numbered lists, line breaks, headers (#)
 */
interface Props {
  text: string;
  className?: string;
}

export function AIContent({ text, className = '' }: Props) {
  if (!text) return null;

  const lines = text.split('\n');

  const renderLine = (line: string, idx: number) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} className="h-1.5" />;

    // Header lines: **Title** or ## Title or ### Title
    if (/^#{1,3}\s/.test(trimmed)) {
      const content = trimmed.replace(/^#{1,3}\s/, '');
      return (
        <p key={idx} className="text-xs font-bold text-foreground/90 mt-2 mb-0.5">
          {renderInline(content)}
        </p>
      );
    }

    // Bullet lines: - item or • item or * item
    if (/^[-•*]\s/.test(trimmed)) {
      const content = trimmed.replace(/^[-•*]\s/, '');
      return (
        <div key={idx} className="flex items-start gap-1.5 text-xs text-foreground/80">
          <span className="text-[#FFD700]/60 shrink-0 mt-0.5">•</span>
          <span>{renderInline(content)}</span>
        </div>
      );
    }

    // Numbered list: 1. item
    if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\./)?.[1];
      const content = trimmed.replace(/^\d+\.\s/, '');
      return (
        <div key={idx} className="flex items-start gap-1.5 text-xs text-foreground/80">
          <span className="text-[#FFD700]/60 shrink-0 font-medium min-w-[14px]">{num}.</span>
          <span>{renderInline(content)}</span>
        </div>
      );
    }

    // Bold-only line (acts like a subheader): **text**
    if (/^\*\*[^*]+\*\*:?\s*$/.test(trimmed)) {
      return (
        <p key={idx} className="text-xs font-semibold text-foreground/90 mt-1.5">
          {renderInline(trimmed)}
        </p>
      );
    }

    // Regular paragraph
    return (
      <p key={idx} className="text-xs text-foreground/80 leading-relaxed">
        {renderInline(trimmed)}
      </p>
    );
  };

  const renderInline = (text: string): React.ReactNode => {
    // Split on **bold** patterns
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-foreground/95">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className={`space-y-0.5 ${className}`}>
      {lines.map((line, idx) => renderLine(line, idx))}
    </div>
  );
}
