import type { ClipMetadata } from '@wijzer/core';

function ProvenanceLabel({ source }: { source: string }) {
  if (source === 'extracted') return null;
  return (
    <span className="ml-1 text-xs text-muted-foreground">({source})</span>
  );
}

export function ClipMetadataPanel({ metadata }: { metadata: ClipMetadata }) {
  return (
    <dl className="grid gap-2 rounded-lg border border-border p-4 text-sm">
      <div className="flex gap-2">
        <dt className="text-muted-foreground">Kind</dt>
        <dd className="capitalize">{metadata.kind}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="text-muted-foreground">Tool</dt>
        <dd>{metadata.toolUsed}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="text-muted-foreground">Quality</dt>
        <dd className="capitalize">{metadata.extractionQuality}</dd>
      </div>
      <div className="flex flex-wrap gap-2">
        <dt className="text-muted-foreground">Title</dt>
        <dd>
          {metadata.title.value}
          <ProvenanceLabel source={metadata.title.source} />
        </dd>
      </div>
      {metadata.author ? (
        <div className="flex flex-wrap gap-2">
          <dt className="text-muted-foreground">Author</dt>
          <dd>
            {metadata.author.value}
            <ProvenanceLabel source={metadata.author.source} />
          </dd>
        </div>
      ) : null}
      {metadata.siteName ? (
        <div className="flex flex-wrap gap-2">
          <dt className="text-muted-foreground">Site</dt>
          <dd>
            {metadata.siteName.value}
            <ProvenanceLabel source={metadata.siteName.source} />
          </dd>
        </div>
      ) : null}
      {metadata.warnings.length > 0 ? (
        <div>
          <dt className="mb-1 text-muted-foreground">Warnings</dt>
          <dd>
            <ul className="list-disc pl-4 text-amber-800 dark:text-amber-200">
              {metadata.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
