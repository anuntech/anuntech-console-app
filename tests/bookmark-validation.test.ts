import { test } from "node:test";
import assert from "node:assert/strict";
import { bookmarkInput, safeFileName } from "../src/lib/bookmark-validation";
import { prepareTicketFiles } from "../src/lib/ticket-files";
const base = {
  companyId: "123e4567-e89b-42d3-a456-426614174000",
  engagementId: "",
  title: "Projeto",
};
test("bookmarks only accept safe web links", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,x",
    "file:///etc/passwd",
    "https://user:password@example.com",
  ])
    assert.equal(bookmarkInput.safeParse({ ...base, url }).success, false);
  assert.equal(
    bookmarkInput.safeParse({ ...base, url: "https://example.com/project" })
      .success,
    true,
  );
  assert.equal(bookmarkInput.safeParse({ ...base, url: "" }).success, true);
  assert.equal(safeFileName("../test\r\n.html"), ".._test__.html");
});
test("new ticket attachments validate content and aggregate size before persistence", async () => {
  await assert.rejects(
    () =>
      prepareTicketFiles([
        new File(["<script>"], "fake.pdf", { type: "application/pdf" }),
      ]),
    /válidos/,
  );
  await assert.rejects(
    () =>
      prepareTicketFiles([
        new File([new Uint8Array(1024 * 1024 + 1)], "large.pdf"),
      ]),
    /1 MB/,
  );
  assert.deepEqual(await prepareTicketFiles([new File([], "")]), []);
  const [file] = await prepareTicketFiles([
    new File(["%PDF-1.7\nexample"], "project.pdf"),
  ]);
  assert.equal(file.mime, "application/pdf");
  assert.equal(file.name, "project.pdf");
});
