/**
 * Route handlers do not get the Origin check Server Actions get: a request
 * that changes something or costs money must come from the Console itself.
 */
export function sameOrigin(request: Request) {
  return (
    request.headers.get("origin") === new URL(process.env.BETTER_AUTH_URL || request.url).origin &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}

/**
 * A JSON body: a plain HTML form from another site can only send
 * text/plain, form-urlencoded or multipart, never application/json.
 */
export function isJson(request: Request) {
  return /^application\/json\s*(;|$)/i.test(request.headers.get("content-type") ?? "");
}
