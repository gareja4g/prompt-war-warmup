import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/api/auth", "/api/health"];
const AUTH_ROUTES = ["/login", "/register"];

export default auth(
  (req: NextRequest & { auth?: { user?: { id?: string } } | null }) => {
    const { pathname } = req.nextUrl;
    const isAuthenticated = !!req.auth?.user?.id;

    // Allow public routes
    const isPublicRoute = PUBLIC_ROUTES.some((route) =>
      pathname.startsWith(route),
    );

    if (isPublicRoute) {
      // Redirect authenticated users away from auth pages
      if (
        isAuthenticated &&
        AUTH_ROUTES.some((r) => pathname.startsWith(r))
      ) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.next();
    }

    // Protect all other routes
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const response = NextResponse.next();

    // Add security headers
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set(
      "Referrer-Policy",
      "strict-origin-when-cross-origin",
    );

    return response;
  },
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|images|fonts).*)",
  ],
};
