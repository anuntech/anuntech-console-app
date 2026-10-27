import { sql, type SQL } from "drizzle-orm";
import { ACCENTED, PLAIN } from "./text-rules";

/** Lowercase, accents out: the same as the `search` column of console_file_texts, so both sides match. */
export const searchable = (value: SQL | string) => sql`lower(translate(${value}, ${ACCENTED}, ${PLAIN}))`;
/** What a person typed, as a full-text query in Portuguese, accents out. */
export const contentQuery = (typed: string) => sql`websearch_to_tsquery('portuguese', ${searchable(typed)})`;
