import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

export function SafeMarkdown({ content }: { content: string }) {
  if (!content.trim()) {
    return <p className="text-sm text-[var(--muted)]">(empty)</p>;
  }

  return (
    <div className="prose-wijzer text-[15px]">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
    </div>
  );
}
