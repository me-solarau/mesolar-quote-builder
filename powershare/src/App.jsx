import { useEffect } from 'react'

import { AppProvider, useApp, useRoute } from './lib/useApp.jsx'
import { SITE } from './data/site.js'
import { Icon, Segmented } from './components/ui/index.jsx'
import * as store from './lib/store.js'

import Login from './screens/auth/Login.jsx'

import TenantHome from './screens/tenant/Home.jsx'
import TenantUsage from './screens/tenant/Usage.jsx'
import TenantCosts from './screens/tenant/Costs.jsx'
import TenantHistory from './screens/tenant/History.jsx'
import TenantHelp from './screens/tenant/Help.jsx'

import OwnerDashboard from './screens/owner/Dashboard.jsx'
import OwnerTenants from './screens/owner/Tenants.jsx'
import OwnerDevices from './screens/owner/Devices.jsx'
import OwnerBilling from './screens/owner/Billing.jsx'
import OwnerReports from './screens/owner/Reports.jsx'
import OwnerSettings from './screens/owner/Settings.jsx'

import InstallerCommissioning from './screens/installer/Commissioning.jsx'

const TENANT_NAV = [
  { key: 'home', label: 'Home', icon: 'home', Screen: TenantHome },
  { key: 'usage', label: 'Usage', icon: 'usage', Screen: TenantUsage },
  { key: 'costs', label: 'Costs', icon: 'cost', Screen: TenantCosts },
  { key: 'history', label: 'History', icon: 'history', Screen: TenantHistory },
  { key: 'help', label: 'Help', icon: 'help', Screen: TenantHelp }
]

const OWNER_NAV = [
  { key: 'dashboard', label: 'Site dashboard', icon: 'dashboard', Screen: OwnerDashboard },
  { key: 'tenants', label: 'Tenants', icon: 'people', Screen: OwnerTenants },
  { key: 'devices', label: 'Devices', icon: 'devices', Screen: OwnerDevices },
  { key: 'billing', label: 'Billing', icon: 'billing', Screen: OwnerBilling },
  { key: 'reports', label: 'Reports', icon: 'reports', Screen: OwnerReports },
  { key: 'settings', label: 'Settings', icon: 'settings', Screen: OwnerSettings }
]

const INSTALLER_NAV = [
  { key: 'commissioning', label: 'Commissioning', icon: 'devices', Screen: InstallerCommissioning },
  { key: 'devices', label: 'Device health', icon: 'wifi', Screen: OwnerDevices }
]

function navFor (role) {
  if (role === 'owner') return OWNER_NAV
  if (role === 'installer') return INSTALLER_NAV
  return TENANT_NAV
}

function Shell () {
  const { session, liveAlerts, periods, periodId, setPeriodId, currentPeriodId } = useApp()
  const [route, navigate] = useRoute()
  const nav = navFor(session.role)
  const active = nav.find((n) => n.key === route) ?? nav[0]

  useEffect(() => {
    if (!nav.some((n) => n.key === route)) navigate(nav[0].key)
  }, [route, nav, navigate])

  const openAlerts = liveAlerts.filter((a) => a.severity !== 'info').length
  const Screen = active.Screen

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="bolt" size={15} style={{ color: '#fff' }} />
          </span>
          <div>
            <div className="brand-name">PowerShare</div>
            <div className="brand-sub">{SITE.name}</div>
          </div>
        </div>

        <div className="nav-label">
          {session.role === 'owner' ? 'Administration' : session.role === 'installer' ? 'Installer' : 'My energy'}
        </div>
        {nav.map((n) => (
          <button key={n.key} className="nav-item" aria-current={active.key === n.key ? 'page' : undefined}
            onClick={() => navigate(n.key)}>
            <Icon name={n.icon} size={16} />
            {n.label}
            {session.role === 'owner' && n.key === 'dashboard' && openAlerts > 0 && (
              <span className="badge-dot" aria-label={`${openAlerts} open alerts`} />
            )}
          </button>
        ))}

        <div className="sidebar-foot">
          <ThemeToggle />
          <button className="nav-item" onClick={() => store.setSession(null)} style={{ marginTop: 6 }}>
            <Icon name="logout" size={16} />
            Sign out
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 8px 0' }}>
            Signed in as {session.name}
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h1>{active.label}</h1>
            <div className="topbar-sub">
              {session.role === 'owner' ? `${SITE.name} · ${SITE.supply}` : session.name}
            </div>
          </div>
          <div className="spacer" />
          <PeriodPicker periods={periods} value={periodId} onChange={setPeriodId} currentId={currentPeriodId} />
        </header>

        <main className="content">
          <Screen />
        </main>
      </div>

      <nav className="tabbar" aria-label="Sections">
        {nav.slice(0, 5).map((n) => (
          <button key={n.key} aria-current={active.key === n.key ? 'page' : undefined}
            onClick={() => navigate(n.key)}>
            <Icon name={n.icon} size={19} />
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function PeriodPicker ({ periods, value, onChange, currentId }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>
      Billing period
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 'auto', minWidth: 200 }}>
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}{p.id === currentId ? ' (open)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

function ThemeToggle () {
  const theme = store.getTheme()
  return (
    <div style={{ padding: '0 8px' }}>
      <Segmented
        label="Theme"
        value={theme}
        onChange={store.setTheme}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'system', label: 'Auto' },
          { value: 'dark', label: 'Dark' }
        ]}
      />
    </div>
  )
}

function Root () {
  const { session } = useApp()
  if (!session) return <Login />
  return <Shell />
}

export default function App () {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  )
}
