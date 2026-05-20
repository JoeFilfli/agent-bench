import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'

// ── Design tokens ──────────────────────────────────────────────────────
export const C = {
  gray50: '#f9fafb', gray100: '#f3f4f6', gray200: '#e5e7eb',
  gray300: '#d1d5db', gray400: '#9ca3af', gray500: '#6b7280',
  gray700: '#374151', gray900: '#111827',
  blue50: '#eff6ff', blue100: '#dbeafe', blue600: '#2563eb', blue700: '#1d4ed8',
  success: '#059669', successBg: '#d1fae5', successText: '#065f46',
  warning: '#d97706', warningBg: '#fef3c7', warningText: '#92400e',
  danger:  '#dc2626', dangerBg:  '#fee2e2', dangerText:  '#991b1b',
}

// ── StatusBadge ────────────────────────────────────────────────────────
const STATUS: Record<string, [string, string]> = {
  done:    [C.successBg, C.successText],
  running: [C.warningBg, C.warningText],
  pending: [C.gray100,   C.gray700],
  failed:  [C.dangerBg,  C.dangerText],
}

export function StatusBadge({ status }: { status: string }) {
  const [bg, text] = STATUS[status] ?? [C.gray100, C.gray700]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: 9999,
      fontSize: 12, fontWeight: 500, background: bg, color: text,
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  )
}

// ── CategoryBadge ──────────────────────────────────────────────────────
const CAT: Record<string, [string, string]> = {
  reasoning:  ['#dbeafe', '#1e40af'],
  coding:     ['#d1fae5', '#065f46'],
  game:       ['#fed7aa', '#9a3412'],
  simulation: ['#ede9fe', '#4c1d95'],
  multi_turn: ['#fee2e2', '#991b1b'],
}

export function CategoryBadge({ category }: { category: string }) {
  const [bg, text] = CAT[category] ?? [C.gray100, C.gray700]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: 9999,
      fontSize: 12, fontWeight: 500, background: bg, color: text,
    }}>
      {category}
    </span>
  )
}

// ── TypeBadge ──────────────────────────────────────────────────────────
const ATYPE: Record<string, [string, string]> = {
  react:      ['#dbeafe', '#1e40af'],
  pipeline:   ['#d1fae5', '#065f46'],
  debate:     ['#fed7aa', '#9a3412'],
  supervisor: ['#ede9fe', '#4c1d95'],
}

export function TypeBadge({ type }: { type: string }) {
  const [bg, text] = ATYPE[type] ?? [C.gray100, C.gray700]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: 9999,
      fontSize: 12, fontWeight: 500, background: bg, color: text,
    }}>
      {type}
    </span>
  )
}

// ── TaskBadge ──────────────────────────────────────────────────────────
export function TaskBadge({ name }: { name: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: 9999,
      fontSize: 12, fontWeight: 500,
      background: C.blue50, color: C.blue700,
      border: `1px solid ${C.blue100}`,
      whiteSpace: 'nowrap',
    }}>
      {name}
    </span>
  )
}

// ── ScoreChip ──────────────────────────────────────────────────────────
export function ScoreChip({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = score >= 0.7 ? C.success : score >= 0.4 ? C.warning : C.danger
  return <span style={{ fontWeight: 600, color, fontSize: 14 }}>{pct}%</span>
}

// ── Btn ────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BTN_VARIANT: Record<BtnVariant, CSSProperties> = {
  primary:   { background: C.blue600, color: '#fff', borderColor: C.blue600 },
  secondary: { background: '#fff', color: C.gray700, borderColor: C.gray300 },
  ghost:     { background: 'transparent', color: C.gray500, borderColor: 'transparent' },
  danger:    { background: '#fff', color: C.danger, borderColor: '#fca5a5' },
}

export function Btn({
  children, onClick, type = 'button', disabled, variant = 'secondary', style,
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  variant?: BtnVariant
  style?: CSSProperties
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 6,
        fontSize: 13, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: '1px solid transparent',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
        ...BTN_VARIANT[variant],
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── StatCard ───────────────────────────────────────────────────────────
export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${C.gray200}`,
      borderRadius: 8, padding: '16px 20px', minWidth: 120,
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: C.gray500, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.gray900, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.gray400, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── PageHeader ─────────────────────────────────────────────────────────
export function PageHeader({
  title, subtitle, actions, back,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  back?: ReactNode
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      {back && <div style={{ marginBottom: 12 }}>{back}</div>}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.gray900 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 14, color: C.gray500, marginTop: 4 }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
      </div>
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${C.gray200}`,
      borderRadius: 8, overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  )
}

// ── Field ──────────────────────────────────────────────────────────────
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.gray700, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export const inputStyle: CSSProperties = {
  display: 'block', width: '100%', padding: '8px 12px',
  border: `1px solid ${C.gray300}`, borderRadius: 6,
  fontSize: 14, color: C.gray900, background: '#fff',
  outline: 'none', boxSizing: 'border-box',
}

// ── BackLink ───────────────────────────────────────────────────────────
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 13, color: C.gray500, textDecoration: 'none',
    }}>
      ← {label}
    </Link>
  )
}

// ── Divider ────────────────────────────────────────────────────────────
export function Divider() {
  return <div style={{ height: 1, background: C.gray200, margin: '24px 0' }} />
}

// ── Empty state ────────────────────────────────────────────────────────
export function Empty({ message }: { message: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 24px',
      color: C.gray400, fontSize: 14,
    }}>
      {message}
    </div>
  )
}

// ── Alert ──────────────────────────────────────────────────────────────
export function Alert({ message }: { message: string }) {
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 6, marginBottom: 16,
      background: C.dangerBg, color: C.dangerText,
      border: `1px solid #fca5a5`, fontSize: 14,
    }}>
      {message}
    </div>
  )
}

// ── Agent colors for charts ────────────────────────────────────────────
export const AGENT_COLORS = [
  '#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2',
]
