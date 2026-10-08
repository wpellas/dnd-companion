import { useEffect, useState, useSyncExternalStore } from 'react'

export function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>()
  // Created in an effect (not useMemo) so StrictMode's mount/unmount/mount cycle can't leave a revoked URL.
  useEffect(() => {
    if (!blob) {
      // oxlint-disable-next-line react/set-state-in-effect
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

const sameDeps = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((x, i) => Object.is(x, b[i]))

/**
 * Run an async function whenever `deps` change. `loading` is true until the result for the *current* deps has
 * arrived, so callers never see data belonging to a previous input.
 */
export function usePromise<T>(fn: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<{ deps: readonly unknown[]; data?: T; error?: string }>()
  useEffect(() => {
    let cancelled = false
    fn()
      .then((data) => !cancelled && setState({ deps, data }))
      .catch((e) => !cancelled && setState({ deps, error: e instanceof Error ? e.message : String(e) }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  const current = state && sameDeps(state.deps, deps) ? state : undefined
  return { data: current?.data, error: current?.error, loading: !current }
}

const subscribeHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export const useHash = () => useSyncExternalStore(subscribeHash, () => window.location.hash)
