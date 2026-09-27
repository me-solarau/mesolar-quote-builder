import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import * as store from './store.js'
import { TEAMS, OFFICIALS } from '../data/seed.js'

const Ctx = createContext(null)

export function AppProvider ({ children }) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const [uid, setUid] = useState(store.getSessionUserId)
  useEffect(() => store.subscribe(() => setUid(store.getSessionUserId())), [])

  const value = useMemo(() => {
    const matches = store.allMatches().sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    return {
      state,
      user: state.users.find((u) => u.id === uid) ?? null,
      teams: TEAMS,
      officials: OFFICIALS,
      rounds: store.allRounds(),
      matches,
      decisions: store.allDecisions(),
      team: (id) => TEAMS.find((t) => t.id === id),
      official: (id) => OFFICIALS.find((o) => o.id === id),
      userById: (id) => state.users.find((u) => u.id === id)
    }
  }, [state, uid])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useApp = () => useContext(Ctx)

/** Hash router: #/match/w4-irl-nzl -> ['match', 'w4-irl-nzl'] */
export function useRoute () {
  const read = () => (window.location.hash.replace(/^#\/?/, '') || 'home').split('/').map(decodeURIComponent)
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((...parts) => { window.location.hash = '/' + parts.map(encodeURIComponent).join('/') }, [])
  return [route, go]
}

export const href = (...parts) => '#/' + parts.map(encodeURIComponent).join('/')
