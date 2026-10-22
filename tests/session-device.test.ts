import assert from "node:assert/strict";
import test from "node:test";
import { sessionDevice, sessionStatusLabel } from "../src/lib/auth/session-device";

test("the native app's user agent names the app and the phone", () => {
  assert.equal(sessionDevice("AnuntechApp/1.0.0 (iPhone; iOS 18.4)"), "App Anuntech · iPhone");
  assert.equal(sessionDevice("AnuntechApp/1.2.3 (Android 15; Pixel 9)"), "App Anuntech · Android");
  assert.equal(sessionDevice("AnuntechApp/1.0.0 (Android 14)"), "App Anuntech · Android");
  // A system suffix (CFNetwork, Darwin) does not turn the app into Safari.
  assert.equal(
    sessionDevice("AnuntechApp/2.0.0 (iPhone; iOS 19.0) CFNetwork/3826 Darwin/25.0.0"),
    "App Anuntech · iPhone",
  );
});

test("browsers keep their labels", () => {
  assert.equal(
    sessionDevice(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1",
    ),
    "Safari · iPhone",
  );
  assert.equal(
    sessionDevice(
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    ),
    "Chrome · Android",
  );
  assert.equal(
    sessionDevice(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
    ),
    "Edge · Windows",
  );
  assert.equal(
    sessionDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 15.4; rv:140.0) Gecko/20100101 Firefox/140.0"),
    "Firefox · Mac",
  );
  // Without the app's prefix, a native client's system agent stays generic.
  assert.equal(sessionDevice("Console/1 CFNetwork/3826.500.111 Darwin/25.0.0"), "Navegador · dispositivo");
  assert.equal(sessionDevice("okhttp/4.12.0"), "Navegador · dispositivo");
  assert.equal(sessionDevice("anuntechapp/1.0 (iPhone)"), "Navegador · iPhone");
  assert.equal(sessionDevice(null), "Dispositivo não informado");
  assert.equal(sessionDevice(""), "Dispositivo não informado");
});

test("session states use Segurança's labels", () => {
  assert.deepEqual(sessionStatusLabel, {
    current: "Esta sessão",
    active: "Ativa",
    expired: "Expirada",
    ended: "Encerrada",
  });
});
