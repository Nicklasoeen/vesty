export function isDevGalleryPath(pathname: string | null | undefined): boolean {
  if (!pathname) {
    return false;
  }
  const path = pathname.split('?')[0] ?? pathname;
  return path === '/dev' || path.startsWith('/dev/');
}

/**
 * Authenticated providers stay off the /dev tree in development so the
 * gallery never restores a session, reads a profile, or calls RPC.
 * Production always mounts them; /dev routes redirect away when __DEV__ is false.
 */
export function shouldMountAuthenticatedAppProviders(input: {
  isDev: boolean;
  pathname: string | null | undefined;
}): boolean {
  if (!input.isDev) {
    return true;
  }
  if (!input.pathname) {
    return false;
  }
  return !isDevGalleryPath(input.pathname);
}
