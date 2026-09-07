import { ACCOUNTS } from '../../data/seed.js'
import { SITE, TENANT_BY_ID } from '../../data/site.js'
import { participantColor } from '../../lib/palette.js'
import { Card, Icon, Avatar, Notice } from '../../components/ui/index.jsx'
import * as store from '../../lib/store.js'

const ROLE_LABEL = {
  owner: 'Owner / Administrator — full access',
  tenant: 'Tenant — own usage and share only',
  installer: 'Installer — commissioning and device health'
}

export default function Login () {
  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
          <span className="brand-mark" style={{ width: 34, height: 34, borderRadius: 9 }}>
            <Icon name="bolt" size={19} style={{ color: '#fff' }} />
          </span>
          <div>
            <div style={{ fontWeight: 650, fontSize: 19, letterSpacing: '-0.02em' }}>PowerShare</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {SITE.name} · {SITE.suburb}
            </div>
          </div>
        </div>

        <Card title="Sign in" subtitle="Choose an account to explore the platform.">
          {ACCOUNTS.map((a) => {
            const colour = a.role === 'owner'
              ? 'var(--text-secondary)'
              : a.role === 'installer'
                ? '#52514e'
                : participantColor(a.tenantId)
            return (
              <button key={a.id} className="account-row" onClick={() => store.setSession(a)}>
                <Avatar name={a.name} color={colour} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{a.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
                    {ROLE_LABEL[a.role]}
                  </span>
                </span>
                <Icon name="chevron" size={15} style={{ color: 'var(--text-muted)' }} />
              </button>
            )
          })}

          <div style={{ marginTop: 14 }}>
            <Notice icon="info">
              This build runs entirely in the browser on simulated meter data.
              Sign-in is a role switcher — in production these are email/magic-link
              accounts with row-level permissions, and a tenant can only ever read
              their own rows.
            </Notice>
          </div>
        </Card>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14, textAlign: 'center' }}>
          {Object.keys(TENANT_BY_ID).length} cost participants · 18 meters · 3-phase 50 A supply
        </p>
      </div>
    </div>
  )
}
