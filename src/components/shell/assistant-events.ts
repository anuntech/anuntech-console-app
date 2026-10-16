/** Opens the assistant from anywhere on a page (the Dock owns its state and listens). */
export const OPEN_ASSISTANT_EVENT = "console:open-assistant";

export function openAssistant() {
  window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
}
