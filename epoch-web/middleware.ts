export { auth as middleware } from '@/auth';

export const config = {
  // Protect workspace routes and settings; auth routes and home screen are public.
  matcher: ['/ws/:path*', '/settings'],
};
