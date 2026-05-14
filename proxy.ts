import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Routes that require an authenticated Clerk session.
 */
export const protectedRoutePatterns = [
  "/search(.*)",
  "/api/search(.*)",
  "/api/analyze(.*)",
] as const;

/**
 * Matcher used by Clerk middleware to protect app and product API routes.
 */
export const isProtectedRoute = createRouteMatcher([...protectedRoutePatterns]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
