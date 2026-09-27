import { useState } from 'react'
import { AppProvider, useApp, useRoute, href } from './lib/useApp.jsx'
import { TeamTag } from './components/ui.jsx'
import { isSupporter } from './lib/access.js'

import Home from './screens/Home.jsx'
import Match from './screens/Match.jsx'
import { Teams, Team } from './screens/Teams.jsx'
import { Officials, Official } from './screens/Officials.jsx'
import Search from './screens/Search.jsx'
import { EvidenceList, EvidenceNew, EvidenceDetail } from './screens/Evidence.jsx'
import Account from './screens/Account.jsx'
import Admin from './screens/Admin.jsx'

const NAV = [
  ['home', 'Results'],
  ['teams', 'Teams'],
  ['officials', 'Referees & TMOs'],
  ['evidence', 'Evidence'],
  ['account', 'Account']
]

function Screen ({ route }) {
  const [page, a, b] = route
  switch (page) {
    case 'match': return <Match id={a} />
    case 'teams': return <Teams />
    case 'team': return <Team id={a} />
    case 'officials': return <Officials />
    case 'official': return <Official id={a} />
    case 'search': return <Search q={a} />
    case 'evidence':
      if (a === 'new') return <EvidenceNew matchId={b} />
      if (a) return <EvidenceDetail id={a} />
      return <EvidenceList />
    case 'account': return <Account />
    case 'desk': return <Admin />
    default: return <Home />
  }
}

function Shell () {
  const { user } = useApp()
  const [route, go] = useRoute()
  const [q, setQ] = useState(route[0] === 'search' ? route[1] ?? '' : '')
  const nav = user?.role === 'admin' ? [...NAV, ['desk', 'Desk']] : NAV
  const section = { match: 'home', team: 'teams', official: 'officials' }[route[0]] ?? route[0]

  return (
    <div className='app'>
      <aside className='side'>
        <a className='brand' href={href('home')}><img src='/icon.svg' alt='' />RefLens</a>
        <nav className='nav'>
          {nav.map(([k, label]) => <a key={k} href={href(k)} className={section === k ? 'on' : ''}>{label}</a>)}
        </nav>
        <div className='me'>
          {user
            ? <div className='stack'><div className='row'><strong>{user.name}</strong></div><div className='row small'><TeamTag id={user.teamId} short />{isSupporter(user) ? <span className='chip good'>Supporter</span> : <span className='chip'>Free</span>}</div></div>
            : <a className='btn primary small' href={href('account')}>Join / sign in</a>}
        </div>
      </aside>
      <main className='main'>
        <form className='topbar' onSubmit={(e) => { e.preventDefault(); go('search', q) }}>
          <input type='search' value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search teams, games, referees, decisions…' aria-label='Search' />
          <button className='btn'>Search</button>
        </form>
        <Screen route={route} />
        <p className='small muted section'>
          RefLens is an independent supporters’ platform, not affiliated with World Rugby or any union. AI verdicts are
          opinions on the footage available, not official rulings. Sample data in this preview is generated, and the officials are fictional.
        </p>
      </main>
    </div>
  )
}

export default function App () {
  return <AppProvider><Shell /></AppProvider>
}
