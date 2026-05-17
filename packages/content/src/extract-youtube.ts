import { ExtractionError } from '@wijzer/core';
import { YoutubeTranscript } from 'youtube-transcript';
import { MAX_TRANSCRIPT_CHARS } from './constants.js';
import { assertSafeUrl } from './safe-fetch.js';

export type YouTubeExtraction = {
  videoId: string;
  title: string;
  channel?: string;
  thumbnail?: string;
  transcript: string;
  transcriptAvailable: boolean;
  truncated: boolean;
  finalUrl: string;
  quality: 'high' | 'medium' | 'low';
  warnings: string[];
};

export function parseYouTubeVideoId(urlString: string): string | null {
  const parsed = assertSafeUrl(urlString);
  const host = parsed.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0];
    return id || null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsed.pathname.startsWith('/watch')) {
      return parsed.searchParams.get('v');
    }
    if (parsed.pathname.startsWith('/shorts/')) {
      return parsed.pathname.split('/')[2] ?? null;
    }
    if (parsed.pathname.startsWith('/embed/')) {
      return parsed.pathname.split('/')[2] ?? null;
    }
  }

  return null;
}

type OEmbedResponse = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

async function fetchOEmbed(videoId: string): Promise<OEmbedResponse> {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(oembedUrl, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    return {};
  }
  return (await res.json()) as OEmbedResponse;
}

function truncateTranscript(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_TRANSCRIPT_CHARS) {
    return { text, truncated: false };
  }
  return {
    text: text.slice(0, MAX_TRANSCRIPT_CHARS),
    truncated: true,
  };
}

export async function extractYouTube(urlString: string): Promise<YouTubeExtraction> {
  const videoId = parseYouTubeVideoId(urlString);
  if (!videoId) {
    throw new ExtractionError('Could not parse YouTube video ID from URL');
  }

  const finalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const warnings: string[] = [];

  const oembed = await fetchOEmbed(videoId);
  const title = oembed.title ?? 'Untitled YouTube video';
  const channel = oembed.author_name;
  const thumbnail = oembed.thumbnail_url;

  let transcriptText = '';
  let transcriptAvailable = false;

  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    transcriptText = segments.map((s) => s.text).join(' ');
    transcriptAvailable = transcriptText.trim().length > 0;
  } catch {
    warnings.push('No captions/transcript available for this video');
    transcriptAvailable = false;
  }

  if (!transcriptAvailable) {
    return {
      videoId,
      title,
      channel,
      thumbnail,
      transcript: '',
      transcriptAvailable: false,
      truncated: false,
      finalUrl,
      quality: 'low',
      warnings,
    };
  }

  const { text: transcript, truncated } = truncateTranscript(transcriptText);
  if (truncated) {
    warnings.push('Transcript was truncated for model safety');
  }

  const quality: 'high' | 'medium' | 'low' =
    transcript.length > 500 ? 'high' : transcript.length > 100 ? 'medium' : 'low';

  return {
    videoId,
    title,
    channel,
    thumbnail,
    transcript,
    transcriptAvailable: true,
    truncated,
    finalUrl,
    quality,
    warnings,
  };
}
