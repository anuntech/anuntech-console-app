// Test-process only. Loaded before the other mocks so a later mock can reach
// the real network for one host (live OpenRouter checks) while the OTP
// harness keeps blocking everything else.
globalThis.__nativeFetch = globalThis.fetch;
