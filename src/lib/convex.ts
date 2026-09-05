export const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined

export const isConvexConfigured = convexUrl !== undefined && convexUrl.length > 0
