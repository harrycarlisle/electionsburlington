export const CLOSE_SVG = '<svg class="icon-close" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export function closeButton(extraClass = 'dialog-close', label = 'Close') {
  return `<button class="${extraClass}" type="button" aria-label="${label}">${CLOSE_SVG}</button>`;
}
