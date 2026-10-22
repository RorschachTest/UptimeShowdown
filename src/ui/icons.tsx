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
