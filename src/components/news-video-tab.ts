/**
 * Video tab content for the News Feed Panel.
 * Renders a list of hardcoded health YouTube video entries.
 * Clicking a thumbnail replaces it with an autoplay iframe embed.
 */
import { h } from '@/utils/dom-utils';

const SOURCE_COLORS: Record<string, string> = {
  WHO: '#1976d2',
  'WHO-VN': '#1565c0',
  CDC: '#388e3c',
  VTV: '#c62828',
};

export interface VideoItem {
  id: string;
  title: string;
  youtubeId: string;
  source: string;
  publishedAt: number;
}

export const SAMPLE_VIDEOS: VideoItem[] = [
  { id: 'who-dengue',   title: 'WHO: Dengue - Key facts and prevention',       youtubeId: 'jM5Yd5GSkOo', source: 'WHO',    publishedAt: Date.now() - 86_400_000 },
  { id: 'cdc-outbreak', title: 'CDC: Understanding Disease Outbreaks',           youtubeId: 'cGsEhLKPC6o', source: 'CDC',    publishedAt: Date.now() - 172_800_000 },
  { id: 'who-climate',  title: 'Climate change and health',                      youtubeId: '6PMHV6yCYKU', source: 'WHO',    publishedAt: Date.now() - 259_200_000 },
  { id: 'vtv-sxh',      title: 'VTV: Phòng chống sốt xuất huyết mùa mưa',      youtubeId: 'dQw4w9WgXcQ', source: 'VTV',    publishedAt: Date.now() - 345_600_000 },
  { id: 'who-vietnam',  title: 'WHO Vietnam: Health Emergency Response',         youtubeId: 'Y_8KcGKzwl0', source: 'WHO-VN', publishedAt: Date.now() - 432_000_000 },
];

function relativeTime(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function videoItemEl(video: VideoItem): HTMLElement {
  const color = SOURCE_COLORS[video.source] ?? '#555';

  const img = h('img', {
    src: `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`,
    loading: 'lazy',
    alt: video.title,
  });

  const playBtn = h('span', { className: 'video-play-btn' }, '▶');

  const thumbnail = h('div', {
    className: 'video-thumbnail',
    dataset: { youtubeId: video.youtubeId },
    title: 'Play video',
  }, img, playBtn);

  const sourceBadge = h('span', {
    className: 'news-item-source',
    style: `color:${color};border-color:${color}`,
  }, video.source);

  const timeEl = h('span', { className: 'news-item-time' }, relativeTime(video.publishedAt));
  const titleEl = h('p', { className: 'video-title' }, video.title);
  const info = h('div', { className: 'video-info' }, sourceBadge, timeEl, titleEl);
  const item = h('div', { className: 'video-item' }, thumbnail, info);

  // Click thumbnail → replace with iframe embed
  thumbnail.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.className = 'video-embed';
    iframe.src = `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`;
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.setAttribute('title', video.title);
    thumbnail.replaceWith(iframe);
  });

  return item;
}

/** Build the full video tab content node. */
export function buildVideoTab(): HTMLElement {
  const container = h('div', { className: 'video-list' });
  for (const video of SAMPLE_VIDEOS) {
    container.appendChild(videoItemEl(video));
  }
  return container;
}
