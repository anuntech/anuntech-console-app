// Filters a list screen reads from a link or a form, as the web's query strings
// (?company=, ?periodo=custom&de=&ate=). Pure, so tests/ can run them.
import { isoFromInput } from "./tasks";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A company id as a link brings it (`?company=`): a UUID in lower case, or "" for all. */
export const companyParam = (value: unknown) => (typeof value === "string" && UUID.test(value) ? value.toLowerCase() : "");

/**
 * "Personalizado" from the two DD/MM/AAAA fields: the dates the API reads
 * (only complete, real dates; an empty field means no limit on that side),
 * and which field is wrong. A complete date that is not real is wrong; one
 * still being typed is not yet.
 */
export function customPeriod(fromText: string, toText: string) {
  const read = (text: string) => {
    const iso = isoFromInput(text);
    return { iso: iso || undefined, invalid: iso === null && text.trim().length >= 10 };
  };
  const from = read(fromText);
  const to = read(toText);
  // Até before De finds nothing (the web's list too): the field says why.
  const reversed = !!from.iso && !!to.iso && to.iso < from.iso;
  return {
    from: from.iso,
    to: to.iso,
    fromError: from.invalid ? "Informe uma data válida." : undefined,
    toError: to.invalid ? "Informe uma data válida." : reversed ? "Use uma data depois do início." : undefined,
  };
}
