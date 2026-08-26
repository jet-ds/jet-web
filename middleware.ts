import { next } from '@vercel/functions';
import {
  analyticsPolicyForCountry,
  serializeAnalyticsPolicyCookie,
} from './src/features/analytics/regionalPolicy.js';

export default function analyticsPolicyMiddleware(request: Request): Response {
  const country = request.headers.get('x-vercel-ip-country') ?? undefined;
  const policy = analyticsPolicyForCountry(country);

  return next({
    headers: {
      'Set-Cookie': serializeAnalyticsPolicyCookie(policy),
    },
  });
}

export const config = {
  matcher: [
    '/',
    '/about/:path*',
    '/blog/:path*',
    '/chatbot/:path*',
    '/contact/:path*',
    '/licenses/egregore/:path*',
    '/privacy/:path*',
    '/tools/:path*',
    '/works/:path*',
  ],
};
