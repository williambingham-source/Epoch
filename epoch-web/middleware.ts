export { auth as middleware } from '@/auth';

export const config = {
  // Protect all workspace routes; auth routes and the home screen are public.
  matcher: ['/ws/:path*'],
};
