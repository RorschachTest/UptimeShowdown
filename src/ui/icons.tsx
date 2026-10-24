import type { ComponentKind } from '../engine/types'

const paths: Record<ComponentKind, React.ReactNode> = {
  traffic: (
    <>
      <circle cx="7" cy="8" r="2.5" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M2.5 18c0-2.8 2-4.5 4.5-4.5s4.5 1.7 4.5 4.5M12.5 18c0-2.8 2-4.5 4.5-4.5s4.5 1.7 4.5 4.5" />
    </>
  ),
  app: (
    <>
      <rect x="3.5" y="4" width="17" height="7" rx="1.5" />
      <rect x="3.5" y="13" width="17" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6" />
    </>
  ),
  sqldb: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" />
      <path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" />
    </>
  ),
  allinone: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h3M15.5 15.5h.01" />
    </>
  ),
  lb: (
    <>
      <circle cx="5" cy="12" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M7 12h10M7 11l10-5.5M7 13l10 5.5" />
    </>
  ),
  cache: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
  ratelimit: (
    <>
      <path d="M4 18a8 8 0 1 1 16 0" />
      <path d="M12 18l4-5M8 18h.01M16 18h.01M12 10h.01" />
    </>
  ),
  kvstore: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
      <path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
      <path d="M9 9.5h2M9 16h2" />
    </>
  ),
  idgen: (
    <>
      <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />
    </>
  ),
  geoindex: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  leaderboard: (
    <>
      <path d="M4 20V13h4v7M10 20V8h4v12M16 20v-9h4v9M3 20h18" />
    </>
  ),
  queue: (
    <>
      <rect x="3" y="7" width="4" height="10" rx="1" />
      <rect x="10" y="7" width="4" height="10" rx="1" />
      <path d="M17 12h4m-2-2 2 2-2 2" />
    </>
  ),
  worker: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </>
  ),
  provider: (
    <>
      <path d="M4 12l16-7-5 16-3-7-8-2Z" />
    </>
  ),
  feed: (
    <>
      <rect x="4" y="4" width="16" height="5" rx="1" />
      <rect x="4" y="11" width="16" height="4" rx="1" />
      <path d="M4 18h16" />
    </>
  ),
  frontier: (
    <>
      <path d="M4 6h16M4 12h10M4 18h6" />
      <path d="M17 15l3 3-3 3" />
    </>
  ),
  downloader: (
    <>
      <path d="M12 4v11m-4-4 4 4 4-4" />
      <path d="M5 20h14" />
    </>
  ),
  trie: (
    <>
      <circle cx="12" cy="5" r="2" />
      <circle cx="6" cy="13" r="2" />
      <circle cx="18" cy="13" r="2" />
      <circle cx="9" cy="20" r="1.5" />
      <path d="M11 6.5 7 11.5M13 6.5l4 5M6.8 15 8.5 18.6" />
    </>
  ),
  cdn: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 3.5 5.2 3.5 8.5s-1 6.2-3.5 8.5c-2.5-2.3-3.5-5.2-3.5-8.5s1-6.2 3.5-8.5Z" />
    </>
  ),
}

export function ComponentIcon({ kind, className = 'size-5' }: { kind: ComponentKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[kind]}
    </svg>
  )
}

export function BinIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />
    </svg>
  )
}
