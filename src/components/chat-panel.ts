import '@/styles/chat.css';
import { Panel } from '@/components/panel-base';
import { h } from '@/utils/dom-utils';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for compact, streaming-friendly rendering
marked.setOptions({ gfm: true, breaks: true });

/** Render markdown to sanitized HTML. */
function renderMarkdown(src: string): string {
  const raw = marked.parse(src, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li',
                   'blockquote', 'h1', 'h2', 'h3', 'h4', 'a', 'hr', 'table',
                   'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * ChatPanel — AI assistant chat UI.
 * No LLM imports. Exposes `onSend` callback and `appendChunk`/`endStreaming`
 * methods for the app-init layer to wire up.
 */
export class ChatPanel extends Panel {
  private _messages: ChatMsg[] = [];
  private _messagesEl: HTMLElement;
  private _inputEl: HTMLTextAreaElement;
  private _sendBtn: HTMLButtonElement;
  private _statusEl: HTMLElement;
  private _isStreaming = false;
  private _thinkingEl: HTMLElement | null = null;

  /** Wired by app-init when LLM provider is ready. */
  public onSend: ((text: string) => void) | null = null;

  constructor() {
    super({ id: 'ai-assistant', title: 'AI Assistant', showCount: false, defaultRowSpan: 4 });

    // Status bar — shows provider connection state
    this._statusEl = h('div', { className: 'chat-status' }, 'Connecting...');

    // Scrollable messages area
    this._messagesEl = h('div', { className: 'chat-messages' });

    // Textarea — created via createElement to get typed HTMLTextAreaElement
    this._inputEl = document.createElement('textarea');
    this._inputEl.className = 'chat-input';
    this._inputEl.placeholder = 'Ask about epidemic data...';
    this._inputEl.rows = 1;

    // Send button
    this._sendBtn = h('button', { className: 'chat-send-btn' }, '→') as HTMLButtonElement;

    // Assemble layout
    const inputBar = h('div', { className: 'chat-input-bar' }, this._inputEl, this._sendBtn);
    const container = h('div', { className: 'chat-container' },
      this._statusEl,
      this._messagesEl,
      inputBar,
    );

    // Replace default panel content with chat UI
    this.content.textContent = '';
    this.content.appendChild(container);

    // Enter sends; Shift+Enter inserts newline
    this._inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    });

    this._sendBtn.addEventListener('click', () => this._handleSend());

    // Auto-resize textarea up to 100px
    this._inputEl.addEventListener('input', () => {
      this._inputEl.style.height = 'auto';
      this._inputEl.style.height = `${Math.min(this._inputEl.scrollHeight, 100)}px`;
    });

    // Initial welcome message
    this._addAssistantMessage('Xin chào! Tôi có thể giúp bạn phân tích dữ liệu dịch bệnh. Hãy đặt câu hỏi.');
  }

  // ---------------------------------------------------------------------------
  // Public API — called by app-init / LLM service layer
  // ---------------------------------------------------------------------------

  /** Update the provider status indicator. */
  setStatus(text: string, available: boolean): void {
    this._statusEl.textContent = text;
    this._statusEl.className = `chat-status ${available ? 'chat-status--ok' : 'chat-status--warn'}`;
    this._inputEl.disabled = !available;
    this._sendBtn.disabled = !available;
  }

  /**
   * Append a streaming text chunk to the current assistant message.
   * Creates a new assistant message bubble on the first chunk.
   */
  appendChunk(text: string): void {
    if (!this._isStreaming) {
      // Hide "thinking" indicator now that the first token arrived
      this._hideThinking();
      // Start new assistant message element
      this._messages.push({ role: 'assistant', content: '' });
      this._messagesEl.appendChild(this._createMessageEl('assistant', ''));
      this._isStreaming = true;
    }

    // Accumulate content on the last message record
    const last = this._messages[this._messages.length - 1];
    last.content += text;

    // Render markdown progressively (live HTML update)
    const lastEl = this._messagesEl.lastElementChild;
    if (lastEl) {
      const contentEl = lastEl.querySelector('.chat-msg-content');
      if (contentEl) contentEl.innerHTML = renderMarkdown(last.content);
    }

    this._scrollToBottom();
  }

  /** Signal that streaming is complete; re-enable input. */
  endStreaming(): void {
    this._isStreaming = false;
    this._hideThinking();
    this._inputEl.disabled = false;
    this._sendBtn.disabled = false;
    this._inputEl.focus();
  }

  /** Return a copy of the conversation history (for LLM context). */
  getHistory(): ChatMsg[] {
    return [...this._messages];
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _handleSend(): void {
    const text = this._inputEl.value.trim();
    if (!text || this._isStreaming) return;

    this._addUserMessage(text);
    this._inputEl.value = '';
    this._inputEl.style.height = 'auto';

    // Disable input until response completes
    this._inputEl.disabled = true;
    this._sendBtn.disabled = true;

    if (this.onSend) {
      this._showThinking();
      this.onSend(text);
    } else {
      // LLM not yet wired — show fallback message
      this._addAssistantMessage('LLM provider not connected. Check settings.');
      this._inputEl.disabled = false;
      this._sendBtn.disabled = false;
    }
  }

  private _addUserMessage(text: string): void {
    this._messages.push({ role: 'user', content: text });
    this._messagesEl.appendChild(this._createMessageEl('user', text));
    this._scrollToBottom();
  }

  private _addAssistantMessage(text: string): void {
    this._messages.push({ role: 'assistant', content: text });
    this._messagesEl.appendChild(this._createMessageEl('assistant', text));
    this._scrollToBottom();
  }

  private _createMessageEl(role: 'user' | 'assistant', content: string): HTMLElement {
    const label = role === 'user' ? 'You' : 'AI';
    const contentEl = h('div', { className: 'chat-msg-content' });
    if (role === 'assistant' && content) {
      contentEl.innerHTML = renderMarkdown(content);
    } else {
      contentEl.textContent = content;
    }
    return h('div', { className: `chat-msg chat-msg--${role}` },
      h('span', { className: 'chat-msg-role' }, label),
      contentEl,
    );
  }

  private _scrollToBottom(): void {
    this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
  }

  /** Show animated "thinking" indicator bubble. */
  private _showThinking(): void {
    if (this._thinkingEl) return;
    this._thinkingEl = h('div', { className: 'chat-msg chat-msg--assistant chat-msg--thinking' },
      h('span', { className: 'chat-msg-role' }, 'AI'),
      h('div', { className: 'chat-msg-content' },
        h('span', { className: 'chat-thinking-dots' },
          h('span', {}, ''), h('span', {}, ''), h('span', {}, ''),
        ),
        h('span', { className: 'chat-thinking-label' }, 'Đang suy nghĩ...'),
      ),
    );
    this._messagesEl.appendChild(this._thinkingEl);
    this._scrollToBottom();
  }

  /** Remove the thinking indicator. */
  private _hideThinking(): void {
    if (this._thinkingEl) {
      this._thinkingEl.remove();
      this._thinkingEl = null;
    }
  }
}
