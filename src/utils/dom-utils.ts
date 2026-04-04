/** Anything that can appear as a child of h() / replaceChildren(). */
export type DomChild = Node | string | number | null | undefined | false;

/** Props accepted by h(). */
export interface DomProps {
  className?: string;
  style?: Partial<CSSStyleDeclaration> | string;
  dataset?: Record<string, string>;
  [key: string]: unknown;
}

/** Create a DOM element with props and children. */
export function h(
  tag: string,
  propsOrChild?: DomProps | DomChild | null,
  ...children: DomChild[]
): HTMLElement {
  const el = document.createElement(tag);
  let allChildren: DomChild[];

  if (
    propsOrChild != null &&
    typeof propsOrChild === 'object' &&
    !(propsOrChild instanceof Node)
  ) {
    applyProps(el, propsOrChild as DomProps);
    allChildren = children;
  } else {
    allChildren = [propsOrChild as DomChild, ...children];
  }

  appendChildren(el, allChildren);
  return el;
}

/** Replace all children of an element. */
export function replaceChildren(el: Element, ...children: DomChild[]): void {
  const frag = document.createDocumentFragment();
  appendChildren(frag, children);
  while (el.lastChild) el.removeChild(el.lastChild);
  el.appendChild(frag);
}

const SAFE_TAGS = new Set([
  'strong', 'em', 'b', 'i', 'br', 'p', 'ul', 'ol', 'li', 'span', 'div', 'a',
]);
const SAFE_ATTRS = new Set(['class', 'href', 'target', 'rel', 'style']);
const SAFE_STYLE_RE =
  /^color:\s*(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-zA-Z]+|var\(--[\w-]+\))\s*;?\s*$/;

/** Parse HTML, stripping tags/attributes not in the allowlist. */
export function safeHtml(html: string): DocumentFragment {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const walk = (parent: Element | DocumentFragment) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      if (!SAFE_TAGS.has(el.tagName.toLowerCase())) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        continue;
      }
      for (const attr of Array.from(el.attributes)) {
        if (!SAFE_ATTRS.has(attr.name.toLowerCase())) el.removeAttribute(attr.name);
      }
      if (el.hasAttribute('href')) {
        const href = el.getAttribute('href') ?? '';
        if (!/^https?:\/\//i.test(href) && !href.startsWith('/') && !href.startsWith('#')) {
          el.removeAttribute('href');
        }
      }
      if (el.hasAttribute('style')) {
        const style = el.getAttribute('style') ?? '';
        if (!SAFE_STYLE_RE.test(style.trim())) el.removeAttribute('style');
      }
      walk(el);
    }
  };
  walk(tpl.content);
  return tpl.content;
}

function applyProps(el: HTMLElement, props: DomProps): void {
  for (const key in props) {
    const value = props[key];
    if (value == null || value === false) continue;
    if (key === 'className') {
      el.className = value as string;
    } else if (key === 'style') {
      if (typeof value === 'string') el.style.cssText = value;
      else if (typeof value === 'object') Object.assign(el.style, value);
    } else if (key === 'dataset') {
      for (const k in value as Record<string, string>) {
        el.dataset[k] = (value as Record<string, string>)[k]!;
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
}

function appendChildren(parent: Element | DocumentFragment, children: DomChild[]): void {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}
