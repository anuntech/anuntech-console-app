import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // An inactive settings page must refresh its direct route, not intercept itself.
  // Otherwise Next cannot recover the retained slot and reloads the whole document.
  if (
    request.headers.get("next-url")?.split("?")[0] === request.nextUrl.pathname
  ) {
    const headers = new Headers(request.headers);
    headers.delete("next-url");
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/conta", "/configuracoes/:path*"] };
