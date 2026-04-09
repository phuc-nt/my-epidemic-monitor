/**
 * Mobile tab bar — bottom navigation shown only on small screens (<768px).
 *
 * Switches the app between three full-screen views: Map, Tin (outbreak list
 * + panels), and AI chat. Uses body class `mobile-mode` + `data-mobile-tab`
 * attribute on `.app-shell` to drive CSS visibility overrides.
 *
 * The bar auto-hides on desktop via CSS media query, so it's safe to mount
 * unconditionally. Tab state persists to sessionStorage so refreshes stay
 * on the same view.
 */
import { h } from '@/utils/dom-utils';

export type MobileTab = 'map' | 'list' | 'chat';

const STORAGE_KEY = 'em_mobile_tab_v1';
const MOBILE_BREAKPOINT_PX = 768;

interface MobileTabBarHandles {
  el: HTMLElement;
  setActive: (tab: MobileTab) => void;
  getActive: () => MobileTab;
}

/** Is the viewport currently narrow enough to be "mobile"? */
export function isMobileViewport(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT_PX;
}

/** Apply the active tab state to body + shell element. */
function applyTabState(shell: HTMLElement, tab: MobileTab): void {
  shell.dataset.mobileTab = tab;
  document.body.dataset.mobileTab = tab;
}

/** Toggle `body.mobile-mode` based on current viewport width. */
export function syncMobileModeClass(): void {
  document.body.classList.toggle('mobile-mode', isMobileViewport());
}

/**
 * Build and mount the mobile tab bar. The bar is fixed to the bottom of the
 * viewport and always present in DOM; CSS hides it on desktop.
 *
 * @param shell  the `.app-shell` element whose `data-mobile-tab` drives
 *               view visibility via CSS
 * @param onChatOpen  called when the Chat tab becomes active — lets the app
 *                    show the chat overlay in fullscreen mode
 * @param onChatClose called when the Chat tab is deactivated
 */
export function createMobileTabBar(
  shell: HTMLElement,
  onChatOpen: () => void,
  onChatClose: () => void,
): MobileTabBarHandles {
  // Restore last active tab — default to Map on first visit
  const initial: MobileTab = (() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved === 'map' || saved === 'list' || saved === 'chat') return saved;
    } catch { /* sessionStorage blocked */ }
    return 'map';
  })();

  let active: MobileTab = initial;

  const mkBtn = (tab: MobileTab, icon: string, label: string) =>
    h('button', {
      className: 'mobile-tab-btn',
      dataset: { tab },
      type: 'button',
      'aria-label': label,
    },
      h('span', { className: 'mobile-tab-btn-icon' }, icon),
      h('span', { className: 'mobile-tab-btn-label' }, label),
    );

  const btnMap  = mkBtn('map',  '🗺️', 'Bản đồ');
  const btnList = mkBtn('list', '📰', 'Tin tức');
  const btnChat = mkBtn('chat', '🤖', 'Trợ lý');

  const bar = h('nav', {
    className: 'mobile-tab-bar',
    role: 'tablist',
    'aria-label': 'Điều hướng ứng dụng',
  }, btnMap, btnList, btnChat);

  const buttons: Record<MobileTab, HTMLElement> = {
    map:  btnMap,
    list: btnList,
    chat: btnChat,
  };

  function setActive(next: MobileTab): void {
    const prev = active;
    active = next;

    for (const tab of ['map', 'list', 'chat'] as MobileTab[]) {
      buttons[tab].classList.toggle('mobile-tab-btn--active', tab === next);
    }

    applyTabState(shell, next);

    try { sessionStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }

    // Chat tab transitions drive the fullscreen chat overlay
    if (next === 'chat' && prev !== 'chat') onChatOpen();
    else if (prev === 'chat' && next !== 'chat') onChatClose();
  }

  btnMap.addEventListener('click', () => setActive('map'));
  btnList.addEventListener('click', () => setActive('list'));
  btnChat.addEventListener('click', () => setActive('chat'));

  // Apply initial state
  applyTabState(shell, initial);

  return { el: bar, setActive, getActive: () => active };
}
