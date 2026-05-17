import {
  extractArticle,
  extractGenericPage,
  extractYouTube,
} from '@wijzer/content';
import type { ExtractorName } from './select-extractor.js';

export type ExtractorResult =
  | {
      toolName: 'clipYouTube';
      usable: boolean;
      quality: 'high' | 'medium' | 'low';
      finalUrl: string;
      thumbnail?: string;
      videoId: string;
      title: string;
      channel?: string;
      transcript: string;
      transcriptAvailable: boolean;
      truncated: boolean;
      warnings: string[];
      unusableReason?: string;
    }
  | {
      toolName: 'clipArticle';
      usable: boolean;
      quality: 'high' | 'medium' | 'low';
      finalUrl: string;
      title: string;
      byline?: string;
      siteName?: string;
      excerpt?: string;
      textContent: string;
      warnings: string[];
      unusableReason?: string;
    }
  | {
      toolName: 'clipGenericUrl';
      usable: boolean;
      quality: 'high' | 'medium' | 'low';
      finalUrl: string;
      title: string;
      description?: string;
      headings: string[];
      textContent: string;
      warnings: string[];
      unusableReason?: string;
    };

export async function runExtractor(
  name: ExtractorName,
  url: string,
): Promise<ExtractorResult> {
  switch (name) {
    case 'clipYouTube': {
      const data = await extractYouTube(url);
      return {
        toolName: 'clipYouTube',
        usable: data.transcriptAvailable,
        quality: data.quality,
        finalUrl: data.finalUrl,
        thumbnail: data.thumbnail,
        videoId: data.videoId,
        title: data.title,
        channel: data.channel,
        transcript: data.transcript,
        transcriptAvailable: data.transcriptAvailable,
        truncated: data.truncated,
        warnings: data.warnings,
        unusableReason: data.transcriptAvailable
          ? undefined
          : 'No captions/transcript available for this video',
      };
    }
    case 'clipArticle': {
      const data = await extractArticle(url);
      const usable = data.textContent.trim().length > 80;
      return {
        toolName: 'clipArticle',
        usable,
        quality: data.quality,
        finalUrl: data.finalUrl,
        title: data.title,
        byline: data.byline,
        siteName: data.siteName,
        excerpt: data.excerpt,
        textContent: data.textContent,
        warnings: data.warnings,
        unusableReason: usable
          ? undefined
          : 'Could not extract enough article text from this page',
      };
    }
    case 'clipGenericUrl': {
      const data = await extractGenericPage(url);
      const usable = data.textContent.trim().length > 80;
      return {
        toolName: 'clipGenericUrl',
        usable,
        quality: data.quality,
        finalUrl: data.finalUrl,
        title: data.title,
        description: data.description,
        headings: data.headings,
        textContent: data.textContent,
        warnings: data.warnings,
        unusableReason: usable
          ? undefined
          : 'Could not extract enough visible text from this page',
      };
    }
  }
}
