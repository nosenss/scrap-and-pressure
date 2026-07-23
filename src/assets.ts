/** Public asset URL that works on itch.io (subdirectory) and local Vite. */
export function assetUrl(path: string): string {
  const clean = path.replace(/^\//, '')
  return `${import.meta.env.BASE_URL}${clean}`
}
