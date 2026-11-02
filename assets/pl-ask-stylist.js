/**
 * <ask-stylist> — hands a shopper from the page into the AI support chat with
 * a question already asked.
 *
 * Wrap anything containing `[data-ask]` triggers. The trigger's value is the
 * question; an empty value just opens the panel.
 *
 *   <ask-stylist data-fallback="/pages/contact">
 *     <button type="button" data-ask="What size shoe for a 3 year old?">…</button>
 *   </ask-stylist>
 *
 * Clicks are caught on the wrapper rather than bound per button, so a section
 * that re-renders in the theme editor keeps working without rebinding.
 */
class AskStylist extends HTMLElement {
  connectedCallback() {
    if (this.dataset.bound) return;
    this.dataset.bound = 'true';

    this.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-ask]');
      if (!trigger || !this.contains(trigger)) return;
      this.#ask(trigger.dataset.ask);
    });
  }

  /**
   * The chat script is deferred, so on a fast click the element can be in the
   * DOM without having been upgraded yet. Waiting on the definition is what
   * makes the first tap after a cold load behave like every other one.
   */
  async #ask(question) {
    const chat = document.querySelector('ai-support-chat');

    // No assistant on this page — send them somewhere a human is.
    if (!chat) {
      const fallback = this.dataset.fallback;
      if (fallback) window.location.href = fallback;
      return;
    }

    if (typeof chat.ask !== 'function') {
      await customElements.whenDefined('ai-support-chat');
    }

    if (typeof chat.ask === 'function') chat.ask(question);
    else if (typeof chat.open === 'function') chat.open();
  }
}

if (!customElements.get('ask-stylist')) {
  customElements.define('ask-stylist', AskStylist);
}
