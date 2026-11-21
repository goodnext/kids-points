import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { DEMO_DB, KidsPointsDB, REAL_DB } from '../storage/db'
import { replaceOldDefaultMenu } from '../storage/defaults'
import { demoClock, getDemoOffset, seedDemo, setDemoOffset } from '../storage/demo'
import { Repo, type Snapshot } from '../storage/repo'

export type Mode = 'real' | 'demo'
export interface DbNames {
  real: string
  demo: string
}

interface Loaded {
  repo: Repo
  snap: Snapshot
  mode: Mode
  demoOffset: number
}

export interface Store extends Loaded {
  reload(): Promise<void>
  switchMode(mode: Mode): Promise<void>
  advanceDemo(): Promise<void>
  resetDemo(): Promise<void>
}

const MODE_KEY = 'kp-mode'

function readSavedMode(): Mode {
  try {
    if (new URLSearchParams(location.search).has('demo')) return 'demo'
    return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'real'
  } catch {
    return 'real'
  }
}

function saveMode(mode: Mode): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // 保存できなくても動作は続ける
  }
}

async function open(mode: Mode, names: DbNames): Promise<Loaded> {
  if (mode === 'real') {
    const repo = new Repo(new KidsPointsDB(names.real), () => new Date())
    await replaceOldDefaultMenu(repo.db)
    await repo.settle()
    return { repo, snap: await repo.snapshot(), mode, demoOffset: 0 }
  }
  const db = new KidsPointsDB(names.demo)
  if ((await db.children.count()) === 0) await seedDemo(db, new Date())
  await replaceOldDefaultMenu(db)
  const demoOffset = await getDemoOffset(db)
  const repo = new Repo(db, demoClock(demoOffset))
  await repo.settle()
  return { repo, snap: await repo.snapshot(), mode, demoOffset }
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({
  children,
  dbNames = { real: REAL_DB, demo: DEMO_DB },
  initialMode,
}: {
  children: ReactNode
  dbNames?: DbNames
  initialMode?: Mode
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const current = useRef<Loaded | null>(null)
  const names = useRef(dbNames)

  useEffect(() => {
    current.current = loaded
  }, [loaded])

  const load = useCallback(async (mode: Mode) => {
    current.current?.repo.db.close()
    const next = await open(mode, names.current)
    current.current = next
    setLoaded(next)
  }, [])

  useEffect(() => {
    void load(initialMode ?? readSavedMode())
  }, [load, initialMode])

  const reload = useCallback(async () => {
    const cur = current.current
    if (!cur) return
    await cur.repo.settle()
    const next = { ...cur, snap: await cur.repo.snapshot() }
    current.current = next
    setLoaded(next)
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  const switchMode = useCallback(
    async (mode: Mode) => {
      saveMode(mode)
      await load(mode)
    },
    [load],
  )

  const advanceDemo = useCallback(async () => {
    const cur = current.current
    if (!cur || cur.mode !== 'demo') return
    await setDemoOffset(cur.repo.db, cur.demoOffset + 1)
    await load('demo')
  }, [load])

  const resetDemo = useCallback(async () => {
    const cur = current.current
    if (!cur || cur.mode !== 'demo') return
    await seedDemo(cur.repo.db, new Date())
    await load('demo')
  }, [load])

  if (!loaded) return <div className="loading">よみこみちゅう…</div>
  return (
    <StoreContext.Provider value={{ ...loaded, reload, switchMode, advanceDemo, resetDemo }}>{children}</StoreContext.Provider>
  )
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('StoreProvider の内側で使ってください')
  return store
}
