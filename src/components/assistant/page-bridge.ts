"use client";
import { FILL_EVENT } from "@/components/console/fillable";
import { setNativeValue } from "@/components/console/insert-text";

/* ---------- what the assistant sees ---------- */

export type PageField = {
  name: string;
  label: string;
  kind: string;
  value: string;
  required?: boolean;
  options?: { valor: string; texto: string }[];
};
export type PageForm = { id: string; title: string; fields: PageField[]; buttons: string[] };
export type PageSnapshot = { path: string; title: string; forms: PageForm[]; actions: string[] };

// The server refuses a bigger screen (lib/assistant/page-snapshot.ts SNAPSHOT_LIMITS).
const MAX_FIELDS = 60;
const MAX_OPTIONS = 40;
const MAX_TOTAL_OPTIONS = 400;
const MAX_ACTIONS = 20;
const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
const text = (node: Element | null | undefined) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();
/**
 * Outside the assistant's own panel, outside what the person decides alone
 * (data-assistant-ignore: the microphone, accepting a quote, signing a contract,
 * publishing a charge, sending to the client, deleting) and outside confirmation
 * dialogs: the assistant neither reads, fills, submits nor clicks those.
 */
const outsidePanel = (element: Element) => !element.closest("[data-assistant], [data-assistant-ignore], [role=alertdialog]");
/** A form with an attestation ("Conferi valor, vencimento e pagador", consent) is the person's to send, even unmarked. */
const attests = (form: HTMLFormElement) => !!form.querySelector('[name="confirm"], [name="consent"]');
/** Shown on screen; a hidden picker input counts when its wrapper is. */
const shown = (element: Element) =>
  outsidePanel(element) &&
  (element.getClientRects().length > 0 ||
    (!!(element as HTMLElement).dataset?.picker && (element.parentElement?.getClientRects().length ?? 0) > 0));
/** A form counts as visible when any of its controls is: ServerForm renders `display: contents`. */
const formShown = (form: HTMLFormElement) =>
  outsidePanel(form) &&
  (form.getClientRects().length > 0 || [...form.querySelectorAll("input, textarea, select, button")].some((el) => el.getClientRects().length > 0));
const visible = (element: Element) => (element instanceof HTMLFormElement ? formShown(element) : shown(element));
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function labelFor(form: HTMLFormElement, element: HTMLElement) {
  const id = element.id;
  const byFor = id ? form.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`) : null;
  const wrapped = element.closest("label");
  // Custom pickers keep the label on their visible button, which shares the wrapper.
  const sibling = element.parentElement?.querySelector("button[id]");
  const siblingLabel = sibling?.id ? form.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(sibling.id)}"]`) : null;
  return (
    text(byFor) ||
    text(wrapped) ||
    text(siblingLabel) ||
    element.getAttribute("aria-label") ||
    element.getAttribute("placeholder") ||
    element.getAttribute("name") ||
    ""
  );
}

/** The id the snapshot gives a form; the fill finds the same form by it. */
const formIdOf = (form: HTMLFormElement, index: number) => form.getAttribute("id") || `form${index + 1}`;
/** Forms the assistant may read and fill. */
const fillable = (form: HTMLFormElement) => visible(form) && !attests(form);

/** The controls a page marked for the assistant (data-assistant-action), shown and outside the excluded areas. */
function actionControls() {
  return [...document.querySelectorAll<HTMLElement>("[data-assistant-action]")].filter((el) => visible(el) && !(el as HTMLButtonElement).disabled);
}

/** The visible forms on the current page, as fields the model can name, and the controls it may press. */
export function snapshotPage(): PageSnapshot {
  const forms: PageForm[] = [];
  let count = 0;
  let options = 0;
  document.querySelectorAll<HTMLFormElement>("form").forEach((form, index) => {
    if (!fillable(form)) return;
    const seen = new Set<string>();
    const fields: PageField[] = [];
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select").forEach((el) => {
      if (count >= MAX_FIELDS || !el.name || el.disabled || !shown(el)) return;
      const picker = el.dataset.picker;
      const type = el instanceof HTMLInputElement ? el.type : el instanceof HTMLSelectElement ? "select" : "textarea";
      if (!picker && ["hidden", "submit", "button", "file", "reset", "image"].includes(type)) return;
      if (type !== "radio" && seen.has(el.name)) return;
      seen.add(el.name);
      const field: PageField = { name: el.name, label: clip(labelFor(form, el), 80), kind: picker ?? type, value: "" };
      if (el.required) field.required = true;
      if (el instanceof HTMLSelectElement) {
        field.options = [...el.options].slice(0, Math.min(MAX_OPTIONS, MAX_TOTAL_OPTIONS - options)).map((o) => ({ valor: o.value, texto: clip(text(o), 60) }));
        field.value = clip(text(el.selectedOptions[0]) || el.value, 80);
      } else if (type === "checkbox" || type === "radio") {
        field.value = (el as HTMLInputElement).checked ? "sim" : "não";
        if (type === "radio") field.options = [{ valor: el.value, texto: clip(labelFor(form, el), 60) }];
      } else {
        field.value = clip(el.value, 120);
        if (el.dataset.options) {
          try {
            field.options = (JSON.parse(el.dataset.options) as { valor: string; texto: string }[]).slice(0, Math.min(MAX_OPTIONS, MAX_TOTAL_OPTIONS - options));
          } catch {
            /* a picker without a readable option list still takes free text */
          }
        }
      }
      options += field.options?.length ?? 0;
      fields.push(field);
      count += 1;
    });
    if (!fields.length) return;
    const buttons = [...form.querySelectorAll<HTMLButtonElement>("button")]
      .filter((b) => b.type === "submit" && visible(b))
      .map((b) => clip(text(b), 40))
      .filter(Boolean)
      .slice(0, 4);
    const card = form.closest("[data-slot=card]") ?? form;
    // form.id would return a control named "id" (edit forms carry a hidden id input); the attribute is the form's own.
    forms.push({ id: formIdOf(form, index), title: clip(text(card.querySelector("h1, h2, h3")), 80), fields, buttons });
  });
  const actions = [...new Set(actionControls().map((el) => clip(text(el), 60)).filter(Boolean))].slice(0, MAX_ACTIONS);
  return {
    path: location.pathname + location.search,
    title: clip(text(document.querySelector("main h1")) || document.title, 120),
    forms: forms.slice(0, 6),
    actions,
  };
}

/* ---------- what the assistant does ---------- */

const truthy = (value: string) => ["sim", "true", "1", "on", "yes", "marcado"].includes(fold(value));

function flash(el: Element) {
  const target = (el as HTMLElement).dataset.picker ? (el.parentElement ?? el) : el;
  target.classList.remove("assistant-filled");
  void (target as HTMLElement).offsetWidth;
  target.classList.add("assistant-filled");
  setTimeout(() => target.classList.remove("assistant-filled"), 2000);
}

/** The snapshot's form by its id, if it is still on screen and still one the assistant may fill. */
function formNamed(id: string) {
  let found: HTMLFormElement | null = null;
  document.querySelectorAll<HTMLFormElement>("form").forEach((form, index) => {
    if (!found && formIdOf(form, index) === id && fillable(form)) found = form;
  });
  return found as HTMLFormElement | null;
}

function fieldsNamed(form: HTMLFormElement, name: string) {
  return [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${CSS.escape(name)}"]`)].filter(shown);
}

/**
 * Writes values into one form's own fields by name, the way a person would:
 * pickers get the value through `console:fill`, selects match an option by
 * value or text, checkboxes toggle, everything else is typed. Only the form
 * the snapshot named; submitting happens only after the person confirmed the
 * card that asked for it.
 */
export function fillPage(formId: string, fields: { campo: string; valor: string }[], submit: boolean) {
  const form = formNamed(formId);
  if (!form) return { filled: 0, missing: fields.map((f) => f.campo), submitted: false };
  const missing: string[] = [];
  let filled = 0;
  for (const { campo, valor } of fields) {
    const candidates = fieldsNamed(form, campo);
    if (!candidates.length) {
      missing.push(campo);
      continue;
    }
    let el = candidates[0];
    if (el instanceof HTMLInputElement && el.type === "radio") {
      const match = candidates.find((c) => fold(c.value) === fold(valor) || fold(labelFor(form, c)) === fold(valor));
      if (!match) {
        missing.push(campo);
        continue;
      }
      el = match;
      (el as HTMLInputElement).click();
    } else if (el.dataset.picker) {
      el.dispatchEvent(new CustomEvent(FILL_EVENT, { detail: { value: valor } }));
    } else if (el instanceof HTMLSelectElement) {
      const option = [...el.options].find((o) => fold(o.value) === fold(valor)) ?? [...el.options].find((o) => fold(text(o)) === fold(valor));
      if (!option) {
        missing.push(campo);
        continue;
      }
      el.value = option.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (el instanceof HTMLInputElement && el.type === "checkbox") {
      const control = el.previousElementSibling?.getAttribute("role") === "checkbox" ? (el.previousElementSibling as HTMLElement) : el;
      if (el.checked !== truthy(valor)) control.click();
    } else {
      setNativeValue(el as HTMLInputElement | HTMLTextAreaElement, valor);
    }
    flash(el);
    filled += 1;
  }
  if (submit && filled) {
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    setTimeout(() => form.requestSubmit(button ?? undefined), 150);
  }
  return { filled, missing, submitted: submit && filled > 0 };
}

/**
 * Presses one control the page marked data-assistant-action, by its exact
 * text (case and accents aside, never a part of it). Two controls with the
 * same text are ambiguous and nothing is pressed.
 */
export function clickPage(label: string): "clicked" | "missing" | "ambiguous" {
  const wanted = fold(label);
  const matches = actionControls().filter((el) => fold(text(el)) === wanted);
  if (matches.length !== 1) return matches.length ? "ambiguous" : "missing";
  flash(matches[0]);
  matches[0].click();
  return "clicked";
}
