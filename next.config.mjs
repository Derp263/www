/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import './src/env.js'
import { createMDX } from 'fumadocs-mdx/next'
import createNextIntlPlugin from 'next-intl/plugin'

const withMDX = createMDX()
/** @type {import("next").NextConfig} */
const config = {
  output: 'standalone',
  images: {
    loader: 'custom',
    loaderFile: './image-loader.js',
    // Set minimumCacheTTL to a high value to ensure Next.js doesn't invalidate the cache too early
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year in seconds
  },
  // Generate a unique build ID for each build if not provided by the environment
  // This will be used for cache invalidation in the image loader
  generateBuildId: async () => {
    // Use existing build ID if available (e.g., from CI/CD)
    if (process.env.BUILD_ID) {
      return process.env.BUILD_ID
    }
    // Otherwise, use a timestamp
    return `build-${Date.now()}`
  },
}
const withNextIntl = createNextIntlPlugin()
export default withNextIntl(withMDX(config))
