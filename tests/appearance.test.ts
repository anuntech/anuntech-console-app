import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTheme, parseDockPosition } from "../src/lib/account/appearance";
import { sessionDevice } from "../src/lib/auth/session-device";
test("appearance cookies accept only supported values", () => {
  assert.equal(parseTheme("dark"), "dark");
  assert.equal(parseTheme("system"), "system");
  assert.equal(parseTheme("<script>"), "light");
  assert.equal(parseDockPosition("left"), "left");
  assert.equal(parseDockPosition("elsewhere"), "bottom");
});
test("session device labels do not render arbitrary user-agent text", () => {
  assert.equal(sessionDevice(null), "Dispositivo não informado");
  assert.equal(sessionDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/140 Safari/537 Edg/140"), "Edge · Windows");
  assert.equal(sessionDevice("<script>private-value</script>"), "Navegador · dispositivo");
});
