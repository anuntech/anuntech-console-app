/**
 * Sets an input's value the way typing would: through the native setter, so
 * React and uncontrolled forms both see it, then the input and change events.
 */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Where the person was typing when they tapped the microphone, if the field had focus. */
export type Caret = { start: number; end: number; value: string } | null;

export const caretOf = (el: HTMLTextAreaElement | null): Caret =>
  el && document.activeElement === el ? { start: el.selectionStart, end: el.selectionEnd, value: el.value } : null;

/**
 * Where dictated text goes when it arrives: the live cursor if the person is
 * in the field, the cursor of the tap if nothing changed since, else the end.
 */
export function rangeFor(el: HTMLTextAreaElement, tapped: Caret): [number, number] {
  if (document.activeElement === el) return [el.selectionStart, el.selectionEnd];
  if (tapped && tapped.value === el.value) return [tapped.start, tapped.end];
  return [el.value.length, el.value.length];
}

/** Whether focusing the field now would pull the person away from something else they went on to do. */
export function mayFocus(el: HTMLElement, controls: HTMLElement | null) {
  const active = document.activeElement;
  return !active || active === document.body || active === el || (!!controls && controls.contains(active));
}
