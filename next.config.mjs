/* © 2026 GoElev8.ai | Aaron Bryant. All rights reserved. */

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      // beforeFiles runs before the public/ filesystem check, so the
      // rewrite destination resolves to a static .html file in public/.
      // Without this, the dynamic [slug] route would intercept /willpower
      // and try to render a Supabase booking calendar for slug "willpower".
      beforeFiles: [
        {
          source: '/willpower',
          destination: '/willpower-booking.html',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
