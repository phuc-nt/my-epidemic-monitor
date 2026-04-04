/**
 * YouTube transcript extraction — fetches auto-generated captions from YouTube videos.
 * Uses YouTube's internal timedtext API (no API key required).
 * Runs server-side (dev middleware / Edge function) to avoid CORS.
 */

export interface TranscriptSegment {
  text: string;
  start: number;  // seconds
  duration: number;
}

export interface VideoTranscript {
  videoId: string;
  title: string;
  language: string;
  segments: TranscriptSegment[];
  fullText: string;     // All segments joined
  fetchedAt: number;
}

/**
 * Extract video ID from various YouTube URL formats.
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Fetch transcript from YouTube video.
 * Tries Vietnamese captions first, falls back to auto-generated, then English.
 * Must be called server-side (CORS blocked in browser).
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<VideoTranscript | null> {
  try {
    // Step 1: Fetch video page to get caption track URLs
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'vi,en;q=0.9' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : videoId;

    // Step 2: Find caption tracks in player response
    const captionMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])/);
    if (!captionMatch) return null;

    let tracks: Array<{ baseUrl: string; languageCode: string; kind?: string }>;
    try {
      tracks = JSON.parse(captionMatch[1]);
    } catch {
      return null;
    }

    if (!tracks || tracks.length === 0) return null;

    // Step 3: Pick best track — prefer vi, then vi auto, then en
    const viTrack = tracks.find(t => t.languageCode === 'vi' && t.kind !== 'asr');
    const viAutoTrack = tracks.find(t => t.languageCode === 'vi');
    const enTrack = tracks.find(t => t.languageCode === 'en');
    const track = viTrack ?? viAutoTrack ?? enTrack ?? tracks[0];

    if (!track?.baseUrl) return null;

    // Step 4: Fetch caption XML
    const captionRes = await fetch(track.baseUrl, {
      signal: AbortSignal.timeout(8000),
    });
    if (!captionRes.ok) return null;
    const xml = await captionRes.text();

    // Step 5: Parse XML segments
    const segments: TranscriptSegment[] = [];
    const segRe = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([^<]*)<\/text>/g;
    let m: RegExpExecArray | null;
    while ((m = segRe.exec(xml)) !== null) {
      segments.push({
        start: parseFloat(m[1]),
        duration: parseFloat(m[2]),
        text: decodeHtmlEntities(m[3]),
      });
    }

    if (segments.length === 0) return null;

    const fullText = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();

    return {
      videoId,
      title,
      language: track.languageCode,
      segments,
      fullText: fullText.slice(0, 10000), // Limit for LLM context
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n/g, ' ');
}
