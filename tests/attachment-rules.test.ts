import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVATAR_IMAGE,
  BOOKMARK_FILE,
  DOCUMENT_ATTACHMENTS,
  KNOWLEDGE_DOCUMENT,
  attachmentHint,
  attachmentLimitError,
  limitLabel,
} from "../src/lib/attachment-rules";
import { MAX_TICKET_BYTES } from "../src/lib/ticket-files";

test("attachment limits read the same on the field and in server messages", () => {
  assert.equal(attachmentHint(DOCUMENT_ATTACHMENTS), "PDF, PNG, JPEG ou WebP · até 5 arquivos, 20 MB no total");
  assert.equal(attachmentHint(BOOKMARK_FILE), "Qualquer tipo · até 1 MB");
  assert.equal(attachmentHint(KNOWLEDGE_DOCUMENT), ".md, .txt ou .csv · até 300 KB");
  assert.equal(attachmentHint(AVATAR_IMAGE), "PNG, JPEG ou WebP · até 20 MB");
  assert.equal(attachmentLimitError(DOCUMENT_ATTACHMENTS), "Até 5 arquivos, com 20 MB no total.");
  assert.equal(attachmentLimitError(BOOKMARK_FILE), "Escolha um arquivo de até 1 MB.");
  // Server messages are built from these labels; they must stay round numbers.
  assert.deepEqual(
    [BOOKMARK_FILE, KNOWLEDGE_DOCUMENT, DOCUMENT_ATTACHMENTS].map((rules) => limitLabel(rules.maxBytes)),
    ["1 MB", "300 KB", "20 MB"],
  );
  assert.equal(MAX_TICKET_BYTES, DOCUMENT_ATTACHMENTS.maxBytes);
});
