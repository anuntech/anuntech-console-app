import { NextRequest, NextResponse } from "next/server";
import { workspaceRedirect } from "@/lib/http/workspace-redirect";

export function proxy(request: NextRequest) {
  // The old Workspace domain. Here and not in next.config redirects(), which
  // would carry the query string (an old ?token=) to the Console.
  const workspace = workspaceRedirect(request.headers.get("host"), request.nextUrl.pathname);
  if (workspace)
    return NextResponse.redirect(workspace, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
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

export const config = {
  matcher: [
    "/conta",
    "/configuracoes/:path*",
    // Every path, but only on the Workspace host: console.anuntech.com never
    // reaches this entry. The value is a pattern; the proxy above compares the
    // host exactly before redirecting.
    { source: "/:path*", has: [{ type: "host", value: "workspace.anuntech.com" }] },
  ],
};
