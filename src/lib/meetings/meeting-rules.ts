import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { BOOKMARK_FILE } from "../tickets/attachment-rules";

/**
 * The Mac meeting-notes app (Anuntech Reuniões): how it connects to an
 * account and what a note it sends must look like. Pure: the connect page,
 * the API routes and the tests share it.
 *
 * Connecting follows OAuth's native-app shape with PKCE (RFC 8252, 7636). The
 * app opens /conectar/<challenge>, the signed-in person approves, the browser
 * hands a one-time code to anuntech-reunioes://, and the app trades the code
 * and its verifier for a key. A code caught on the way is useless without the
 * verifier, which never leaves the Mac. The challenge is the verifier's
 * SHA-256 in hex rather than base64url so it fits the sign-in return path
 * (letters, digits and "-" only) and survives a sign-in in the middle.
 */

export const MEETING_APP = "reunioes" as const;
export const APP_NAME = "Anuntech Reuniões";
export const APP_SCHEME = "anuntech-reunioes";
export const CHALLENGE = /^[0-9a-f]{64}$/;
/** Long enough to finish a sign-in with the second step; short enough not to linger. */
export const CODE_TTL_MS = 10 * 60 * 1000;
export const NOTES_PER_HOUR = 30;
/** A note is a bookmark file, so it has the same ceiling as any other. */
export const MAX_NOTE_BYTES = BOOKMARK_FILE.maxBytes;
export const NOTE_TOO_LARGE = "A nota passou de 1 MB. Ela continua salva no Mac.";

const TOKEN = /^anr_[A-Za-z0-9_-]{43}$/;
const CODE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
/** 256 random bits, URL-safe; keys carry a prefix so a leaked one is easy to recognize. */
export const newCode = () => randomBytes(32).toString("base64url");
export const newToken = () => `anr_${randomBytes(32).toString("base64url")}`;

/** The verifier is what the app kept; the challenge is what it showed the browser. */
export function verifierMatches(verifier: string, challenge: string) {
  if (!VERIFIER.test(verifier) || !CHALLENGE.test(challenge)) return false;
  return timingSafeEqual(Buffer.from(sha256(verifier)), Buffer.from(challenge));
}

/** The key in an `Authorization: Bearer anr_…` header, or null. */
export function bearerToken(header: string | null) {
  const value = header?.match(/^Bearer\s+(\S+)$/)?.[1];
  return value && TOKEN.test(value) ? value : null;
}

/** Where the browser hands the code back to the app. */
export const callbackUrl = (code: string) => `${APP_SCHEME}://conectado?code=${encodeURIComponent(code)}`;

/** Control characters and stray spacing out of a name the Mac reports about itself. */
const cleanLabel = (value: string) => value.replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim();

export const exchangeInput = z.object({
  code: z.string().regex(CODE),
  verifier: z.string().regex(VERIFIER),
  device: z
    .string()
    .transform(cleanLabel)
    .pipe(z.string().min(1).max(80))
    .catch("Mac"),
});

export const noteInput = z.object({
  /** Made on the Mac for each note: sending the same note twice keeps one bookmark. */
  noteId: z.uuid(),
  /** "internal" is Anuntech's own space; otherwise a company id. Ignored when a folder is given. */
  space: z.union([z.literal("internal"), z.uuid()]),
  folderId: z.uuid().nullable().default(null),
  title: z.string().transform(cleanLabel).pipe(z.string().min(1, "A nota precisa de um título.").max(160)),
  fileName: z.string().regex(/^\d{4}-\d{2}-\d{2}-\d{4}(-\d{1,3})?\.md$/, "Nome de arquivo inválido."),
  markdown: z
    .string()
    .min(1, "A nota chegou vazia.")
    .refine((value) => Buffer.byteLength(value, "utf8") <= MAX_NOTE_BYTES, NOTE_TOO_LARGE),
  startedAt: z.iso.datetime({ offset: true }),
  durationSeconds: z.number().int().min(0).max(24 * 3600),
});
export type NoteInput = z.infer<typeof noteInput>;

/** What a meeting bookmark keeps besides the file: enough for the card and the reader. */
export type MeetingInfo = {
  source: typeof MEETING_APP;
  noteId: string;
  startedAt: string;
  durationSeconds: number;
  device: string | null;
};

const meetingShape = z.object({
  source: z.literal(MEETING_APP),
  noteId: z.string(),
  startedAt: z.string(),
  durationSeconds: z.number(),
  device: z.string().nullable().catch(null),
});

/** The jsonb column read back defensively: anything else is not a meeting. */
export function meetingInfo(value: unknown): MeetingInfo | null {
  const parsed = meetingShape.safeParse(value);
  return parsed.success ? parsed.data : null;
}
