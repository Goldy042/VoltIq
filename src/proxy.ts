import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public: the landing page, sign-in/up and the live map. Everything else needs an account.
const isPublic = createRouteMatcher(['/', '/login(.*)', '/signup(.*)', '/map(.*)']);
const isApi = createRouteMatcher(['/api(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return;
  // API routes answer 401 JSON themselves (see withUser); pages bounce to /login.
  if (isApi(req)) return;
  await auth.protect({ unauthenticatedUrl: new URL('/login', req.url).toString() });
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|json)).*)',
    '/(api|trpc)(.*)',
  ],
};
