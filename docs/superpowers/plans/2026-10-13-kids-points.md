# kids-points 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 子ども2人のお手伝いポイントを、スタンプカードと「ちょきんばこ」の複利で管理する iPad 向け PWA を作り、GitHub Pages で公開する。

**Architecture:** 残高は保存せず、取引記録（追記のみ・取り消しは印をつける）から純粋関数で計算する。ルールは `src/domain/`（画面・DBに依存しない）、保存は `src/storage/`（Dexie で IndexedDB）、画面は `src/ui/`（React、ルーターなしの状態切り替え）。デモモードは別名のDBと「時計のずらし」で本番と同じロジックを動かす。

**Tech Stack:** Vite + React + TypeScript、Dexie、vite-plugin-pwa、Vitest + fake-indexeddb + React Testing Library、GitHub Pages（GitHub Actions）

**Spec:** `docs/superpowers/specs/2026-10-13-kids-points-design.md`

## Global Constraints

- 1pt = 10円。pt は1以上の整数のみ（開始残高・スタンプ・つかう・預け入れ・引き出し）。
- 利息: その月の最終時点のちょきんばこ残高に `max(1, floor(残高 × 利率% / 100))`。残高0なら0。その月に取り消されていない `withdraw` があれば0。利率は整数%（初期値5、0〜100）。
- 利息は翌月1日 0:00 の日時で `interest` として記録し `period: 'YYYY-MM'` を持たせる。同じ子・同じ月は1件まで。
- 日時の基準はローカル時刻（iPad の日本時間）。テストは `TZ=Asia/Tokyo` で実行する。
- 取り消しは全体で直前の1件のみ。`interest`・前月以前・残高がマイナスになるものは取り消せない。記録は消さず `voidedAt` をつける。
- スタンプカードは1枚20マス。スタンプ記録1件で1マス。
- PIN は4桁の数字。ハッシュ化して保存（強固なセキュリティは目的としない）。
- 預け入れは子どもがPINなしで操作できる。引き出し・つかう・スタンプは親メニュー（PIN）から。
- ブラウザの `alert` / `confirm` / `prompt` は使わない（確認は画面内で行う）。
- 画面の文言はひらがな中心。親向け画面は漢字を使ってよい。
- 本番DB名 `kids-points`、デモDB名 `kids-points-demo`。デモのPINは `0000`。
- Node 22 以上。GitHub Pages の公開パスは `/kids-points/`。

## Review Focus

1. **月が変わる瞬間をまたいで画面を開きっぱなしにして操作する** → 操作の前に前月の利息を確定させ、前月分の利息が正しく残る（Task 5 のテストで固定）。
2. **ボタンの連打（5歳の子の連続タップ）** → 1回のタップで1件だけ記録される（Task 8 の DepositPanel テストで固定。StampTab・MoneyTab も同じ ref ガードを使う）。
3. **pt入力に全角数字・小数・空・負数・0** → 全角は半角として受け付け、それ以外は受け付けない（Task 2 の `parsePoints` テストで固定）。
4. **壊れたファイルや別アプリのJSONをバックアップとして読み込む** → エラーを表示し、今のデータは変えない（Task 6 のテストで固定）。
5. **取り消しの対象が、今見ていない方の子の操作** → 誰の何を取り消すかを表示してから実行する（Task 9 の App テストで固定）。

---

## ファイル構成

```
kids-points/
  AGENTS.md / CLAUDE.md          … プロジェクトの指示ファイル
  index.html                      … lang=ja、apple-touch-icon
  vite.config.ts                  … base、PWA、Vitest 設定
  public/icon.svg                 … アイコンの元。PNG は生成する
  .github/workflows/deploy.yml    … GitHub Pages へのデプロイ
  src/
    main.tsx
    test/setup.ts                 … fake-indexeddb、jest-dom
    test/timezone.test.ts         … TZ が日本時間であることの確認
    domain/
      types.ts                    … 型
      month.ts                    … 年月の計算
      balance.ts                  … 残高計算・並び順
      validate.ts                 … 操作の検証、pt入力の解析
      interest.ts                 … 利息・月の結果・利息見込み
      undo.ts                     … 取り消し可否
      stampcard.ts                … スタンプカードの分割
      describeTx.ts               … 取引の説明文
      fixtures.ts                 … テスト用の取引ビルダー
    storage/
      db.ts                       … Dexie のDB定義
      ids.ts                      … id 生成
      pin.ts                      … PIN のハッシュ
      defaults.ts                 … アバター・色・初期メニュー
      repo.ts                     … 読み書き（Repo）
      backup.ts                   … 書き出し・読み込み・リマインド判定
      demo.ts                     … デモ用データ・時計
    ui/
      app.css
      store.tsx                   … Repo とスナップショットを配る Context
      sound.ts                    … 効果音（WebAudio）
      App.tsx                     … 画面の切り替え
      Setup.tsx / Top.tsx / PinReset.tsx
      common/PinPad.tsx / Overlay.tsx / ChildForm.tsx / HomeScreenGuide.tsx
      child/ChildHome.tsx / StampCard.tsx / Pockets.tsx / DepositPanel.tsx
      parent/ParentHome.tsx / StampTab.tsx / MoneyTab.tsx / UndoTab.tsx / DemoTab.tsx
      parent/settings/SettingsTab.tsx / ChildrenSettings.tsx / MenuSettings.tsx / GeneralSettings.tsx / BackupSettings.tsx
```

テストは対象ファイルの隣に `*.test.ts(x)` で置く。`domain/` と `storage/` のテストは node 環境、`ui/` のテストはファイル先頭に `// @vitest-environment jsdom` を書く。

---

### Task 1: プロジェクトの土台

**Files:**
- Create: Vite react-ts テンプレート一式、`AGENTS.md`、`CLAUDE.md`、`src/test/setup.ts`、`src/test/timezone.test.ts`
- Modify: `vite.config.ts`、`package.json`、`index.html`、`src/main.tsx`、`.gitignore`
- Delete: `src/App.tsx`、`src/App.css`、`src/index.css`、`src/assets/react.svg`、`public/vite.svg`

**Interfaces:**
- Produces: `npm test`（`TZ=Asia/Tokyo vitest run`）、`npm run build`

- [ ] **Step 1: テンプレートを scratch に作ってコピーする**

既存の `docs/` と `.git` を壊さないため、別の場所で作ってからコピーする。

```bash
SCRATCH=$(mktemp -d)
cd "$SCRATCH" && npm create vite@latest kp -- --template react-ts
cp -R "$SCRATCH/kp/." ~/work/kids-points/
cd ~/work/kids-points && npm install
npm install dexie
npm install -D vitest jsdom fake-indexeddb @testing-library/react @testing-library/user-event @testing-library/jest-dom vite-plugin-pwa @vite-pwa/assets-generator
```

`npm create` が対話で質問してきたら、「Use rolldown-vite」系は No、「Install and start now」は No を選ぶ。`vite-plugin-pwa` の peer 依存エラーで止まった場合は、エラー文に出ている対応 Vite のメジャーバージョンに `vite` を合わせて入れ直す（`npm install -D vite@<そのメジャー>`）。

- [ ] **Step 2: テンプレートの見本ファイルを消す**

```bash
cd ~/work/kids-points && rm -f src/App.tsx src/App.css src/index.css src/assets/react.svg public/vite.svg && rmdir src/assets 2>/dev/null; true
```

- [ ] **Step 3: 設定ファイルを書く**

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/kids-points/',
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

`package.json` の `scripts` に追加（既存の `dev` / `build` / `lint` / `preview` は残す）:

```json
"test": "TZ=Asia/Tokyo vitest run",
"test:watch": "TZ=Asia/Tokyo vitest"
```

`src/test/setup.ts`:

```ts
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
```

`src/main.tsx`（Task 7 で置き換える仮のもの）:

```tsx
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')!).render(<p>じゅんびちゅう</p>)
```

`index.html` の `<html lang="en">` を `<html lang="ja">` に、`<title>` を `ポイントちょきん` に変え、`<link rel="icon" ... vite.svg>` の行を消す。

`.gitignore` に `dev-dist` を追記する。

- [ ] **Step 4: タイムゾーンの確認テストを書く**

`src/test/timezone.test.ts`:

```ts
import { expect, it } from 'vitest'

it('テストは日本時間で動く（月の境目の計算の前提）', () => {
  expect(new Date('2026-12-01T00:00').toISOString()).toBe('2026-11-30T15:00:00.000Z')
})
```

- [ ] **Step 5: テストとビルドが通ることを確認する**

Run: `npm test && npm run build`
Expected: テスト1件 PASS、ビルド成功

- [ ] **Step 6: 指示ファイルを作る**

`AGENTS.md`:

```markdown
# kids-points

子ども2人のお手伝いポイントを、スタンプカードと「ちょきんばこ」の複利で管理する iPad 向け PWA。

- 仕様: `docs/superpowers/specs/2026-10-13-kids-points-design.md`
- 実装計画: `docs/superpowers/plans/2026-10-13-kids-points.md`

## 構成

- `src/domain/`: ルール（残高・利息・取り消し・スタンプカード）。画面とDBに依存しない純粋関数。現在時刻は引数で受け取る
- `src/storage/`: IndexedDB（Dexie）への読み書き、バックアップ、デモ用データ
- `src/ui/`: React の画面

## コマンド

- `npm test`: テスト（日本時間で実行）
- `npm run dev`: 開発サーバー
- `npm run build`: ビルド

## 守ること

- 残高は保存しない。取引記録から計算する。記録は消さず、取り消しは `voidedAt` をつける
- お金のルールを変えるときは、先に `src/domain/` のテストを書く
- ブラウザの alert / confirm / prompt は使わない
```

`CLAUDE.md`:

```markdown
@AGENTS.md
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: Vite + React + TypeScript の土台を作る"
```

---

### Task 2: 型・年月・残高・入力検証

**Files:**
- Create: `src/domain/types.ts`、`src/domain/month.ts`、`src/domain/balance.ts`、`src/domain/validate.ts`、`src/domain/fixtures.ts`
- Test: `src/domain/month.test.ts`、`src/domain/balance.test.ts`、`src/domain/validate.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `MonthKey`、`DisplayMode`、`Child`、`MenuItem`、`Settings`、`TxType`、`Transaction`、`Balances`
  - `month.ts`: `monthKey(d: Date): MonthKey`、`monthStart(key: MonthKey): Date`、`nextMonth(key): MonthKey`、`prevMonth(key): MonthKey`、`addMonths(d: Date, n: number): Date`
  - `balance.ts`: `byTime(a: Transaction, b: Transaction): number`、`balancesOf(txs: Transaction[], childId: string, before?: Date): Balances`
  - `validate.ts`: `type OpError = 'invalid_points' | 'insufficient'`、`validateOp(txs, childId, type: TxType, points: number): OpError | null`、`parsePoints(input: string): number | null`
  - `fixtures.ts`: `tx(type, points, at, extra?)`（テスト専用）

- [ ] **Step 1: 型とテスト用ビルダーを書く**

`src/domain/types.ts`:

```ts
export type MonthKey = string // 'YYYY-MM'
export type DisplayMode = 'young' | 'older'

export interface Child {
  id: string
  name: string
  avatar: string
  color: string
  displayMode: DisplayMode
  order: number
}

export interface MenuItem {
  id: string
  label: string
  icon: string
  points: number
  childIds: string[]
  order: number
}

export interface Settings {
  pinHash: string | null
  interestPercent: number
  soundOn: boolean
  lastBackupAt: string | null
}

export type TxType = 'opening' | 'stamp' | 'spend' | 'deposit' | 'withdraw' | 'interest'

export interface Transaction {
  id: string
  childId: string
  type: TxType
  points: number
  at: string // ISO 8601（toISOString）
  memo?: string
  menuItemId?: string
  icon?: string
  period?: MonthKey // interest のみ
  voidedAt?: string
}

export interface Balances {
  wallet: number
  savings: number
}
```

`src/domain/fixtures.ts`:

```ts
import type { Transaction, TxType } from './types'

let seq = 0

// at はローカル時刻の文字列（例: '2026-11-05T10:00'）
export function tx(type: TxType, points: number, at: string, extra: Partial<Transaction> = {}): Transaction {
  seq += 1
  return { id: `t${seq}`, childId: 'c1', type, points, at: new Date(at).toISOString(), ...extra }
}
```

- [ ] **Step 2: 失敗するテストを書く**

`src/domain/month.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addMonths, monthKey, monthStart, nextMonth, prevMonth } from './month'

describe('month', () => {
  it('monthKey はローカル時刻の年月を返す', () => {
    expect(monthKey(new Date('2026-11-30T23:59'))).toBe('2026-11')
    expect(monthKey(new Date('2026-12-01T00:00'))).toBe('2026-12')
  })

  it('nextMonth / prevMonth は年をまたぐ', () => {
    expect(nextMonth('2026-12')).toBe('2027-01')
    expect(prevMonth('2027-01')).toBe('2026-12')
  })

  it('monthStart はその月の1日0時', () => {
    expect(monthStart('2026-11').getTime()).toBe(new Date('2026-11-01T00:00').getTime())
  })

  it('addMonths は月末の日付を丸める', () => {
    const d = addMonths(new Date('2026-01-31T12:00'), 1)
    expect(monthKey(d)).toBe('2026-02')
    expect(d.getDate()).toBe(28)
    expect(monthKey(addMonths(new Date('2026-03-15T12:00'), -3))).toBe('2025-12')
  })
})
```

`src/domain/balance.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { balancesOf } from './balance'
import { tx } from './fixtures'

describe('balancesOf', () => {
  it('種類ごとにおさいふとちょきんばこを増減する', () => {
    const txs = [
      tx('opening', 30, '2026-11-01T09:00'),
      tx('stamp', 2, '2026-11-02T09:00'),
      tx('spend', 5, '2026-11-03T09:00'),
      tx('deposit', 10, '2026-11-04T09:00'),
      tx('withdraw', 4, '2026-11-05T09:00'),
      tx('interest', 1, '2026-11-06T09:00'),
    ]
    expect(balancesOf(txs, 'c1')).toEqual({ wallet: 21, savings: 7 })
  })

  it('取り消し済みと、ほかの子の記録は数えない', () => {
    const txs = [
      tx('stamp', 3, '2026-11-01T09:00'),
      tx('stamp', 5, '2026-11-01T10:00', { voidedAt: '2026-11-01T01:01:00.000Z' }),
      tx('stamp', 7, '2026-11-01T11:00', { childId: 'c2' }),
    ]
    expect(balancesOf(txs, 'c1')).toEqual({ wallet: 3, savings: 0 })
  })

  it('before を渡すと、その時刻より前の記録だけを数える', () => {
    const txs = [tx('opening', 10, '2026-11-01T09:00'), tx('stamp', 4, '2026-12-01T00:00')]
    expect(balancesOf(txs, 'c1', new Date('2026-12-01T00:00'))).toEqual({ wallet: 10, savings: 0 })
  })
})
```

`src/domain/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { tx } from './fixtures'
import { parsePoints, validateOp } from './validate'

describe('validateOp', () => {
  const txs = [tx('opening', 10, '2026-11-01T09:00'), tx('deposit', 4, '2026-11-02T09:00')]

  it('1以上の整数でなければ invalid_points', () => {
    expect(validateOp(txs, 'c1', 'stamp', 0)).toBe('invalid_points')
    expect(validateOp(txs, 'c1', 'stamp', -1)).toBe('invalid_points')
    expect(validateOp(txs, 'c1', 'stamp', 1.5)).toBe('invalid_points')
  })

  it('おさいふを超える spend / deposit は insufficient', () => {
    expect(validateOp(txs, 'c1', 'spend', 6)).toBe(null)
    expect(validateOp(txs, 'c1', 'spend', 7)).toBe('insufficient')
    expect(validateOp(txs, 'c1', 'deposit', 7)).toBe('insufficient')
  })

  it('ちょきんばこを超える withdraw は insufficient', () => {
    expect(validateOp(txs, 'c1', 'withdraw', 4)).toBe(null)
    expect(validateOp(txs, 'c1', 'withdraw', 5)).toBe('insufficient')
  })

  it('スタンプと開始残高は残高に関係なく受け付ける', () => {
    expect(validateOp([], 'c1', 'stamp', 3)).toBe(null)
    expect(validateOp([], 'c1', 'opening', 100)).toBe(null)
  })
})

describe('parsePoints', () => {
  it('半角・全角の正の整数を数値にする', () => {
    expect(parsePoints('10')).toBe(10)
    expect(parsePoints('１０')).toBe(10)
    expect(parsePoints(' 7 ')).toBe(7)
  })

  it('空・0・負数・小数・文字は null', () => {
    for (const s of ['', '0', '-3', '1.5', 'abc', '1e3']) expect(parsePoints(s)).toBe(null)
  })
})
```

- [ ] **Step 3: 失敗を確認する**

Run: `npm test -- src/domain`
Expected: FAIL（`./month` などが見つからない）

- [ ] **Step 4: 実装する**

`src/domain/month.ts`:

```ts
import type { MonthKey } from './types'

export function monthKey(d: Date): MonthKey {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthStart(key: MonthKey): Date {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1, 0, 0, 0, 0)
}

export function nextMonth(key: MonthKey): MonthKey {
  const d = monthStart(key)
  return monthKey(new Date(d.getFullYear(), d.getMonth() + 1, 1))
}

export function prevMonth(key: MonthKey): MonthKey {
  const d = monthStart(key)
  return monthKey(new Date(d.getFullYear(), d.getMonth() - 1, 1))
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getTime())
  const day = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + n)
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, lastDay))
  return r
}
```

`src/domain/balance.ts`:

```ts
import type { Balances, Transaction, TxType } from './types'

// [おさいふ, ちょきんばこ] に掛ける符号
const DELTA: Record<TxType, [number, number]> = {
  opening: [1, 0],
  stamp: [1, 0],
  spend: [-1, 0],
  deposit: [-1, 1],
  withdraw: [1, -1],
  interest: [0, 1],
}

export function byTime(a: Transaction, b: Transaction): number {
  return a.at < b.at ? -1 : a.at > b.at ? 1 : 0
}

export function balancesOf(txs: Transaction[], childId: string, before?: Date): Balances {
  let wallet = 0
  let savings = 0
  for (const t of txs) {
    if (t.childId !== childId || t.voidedAt) continue
    if (before && new Date(t.at) >= before) continue
    const [w, s] = DELTA[t.type]
    wallet += w * t.points
    savings += s * t.points
  }
  return { wallet, savings }
}
```

`src/domain/validate.ts`:

```ts
import { balancesOf } from './balance'
import type { Transaction, TxType } from './types'

export type OpError = 'invalid_points' | 'insufficient'

export function validateOp(txs: Transaction[], childId: string, type: TxType, points: number): OpError | null {
  if (!Number.isInteger(points) || points < 1) return 'invalid_points'
  const b = balancesOf(txs, childId)
  if ((type === 'spend' || type === 'deposit') && b.wallet < points) return 'insufficient'
  if (type === 'withdraw' && b.savings < points) return 'insufficient'
  return null
}

export function parsePoints(input: string): number | null {
  const s = input.trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return n >= 1 && Number.isSafeInteger(n) ? n : null
}
```

- [ ] **Step 5: 通ることを確認する**

Run: `npm test -- src/domain`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/domain
git commit -m "feat: 取引の型と残高計算、入力検証を追加"
```

---

### Task 3: 利息の計算

**Files:**
- Create: `src/domain/interest.ts`
- Test: `src/domain/interest.test.ts`

**Interfaces:**
- Consumes: `balancesOf`、`monthKey`、`monthStart`、`nextMonth`、`Transaction`
- Produces:
  - `interestFor(savings: number, percent: number): number`
  - `withdrewIn(txs: Transaction[], childId: string, m: MonthKey): boolean`
  - `pendingInterest(txs: Transaction[], childId: string, percent: number, now: Date, newId: () => string): Transaction[]`（まだ記録されていない利息の取引を、古い月から順に返す）
  - `type MonthOutcome = { kind: 'interest'; points: number } | { kind: 'rest' } | { kind: 'none' }`
  - `monthOutcome(txs, childId, m: MonthKey): MonthOutcome`
  - `projectedInterest(txs, childId, percent, now): { savings: number; points: number; blocked: boolean }`

- [ ] **Step 1: 失敗するテストを書く**

`src/domain/interest.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { tx } from './fixtures'
import { interestFor, monthOutcome, pendingInterest, projectedInterest } from './interest'
import type { Transaction } from './types'

let idSeq = 0
const newId = () => `i${++idSeq}`

describe('interestFor', () => {
  it('切り捨て、ただし1pt以上あれば最低1pt', () => {
    expect(interestFor(100, 5)).toBe(5)
    expect(interestFor(39, 5)).toBe(1)
    expect(interestFor(40, 5)).toBe(2)
    expect(interestFor(10, 5)).toBe(1)
    expect(interestFor(1, 5)).toBe(1)
  })

  it('残高0、または利率0なら0', () => {
    expect(interestFor(0, 5)).toBe(0)
    expect(interestFor(100, 0)).toBe(0)
  })
})

describe('pendingInterest', () => {
  it('前月末のちょきんばこ残高に利息をつけ、翌月1日0時で記録する', () => {
    const txs = [tx('opening', 100, '2026-11-01T09:00'), tx('deposit', 100, '2026-11-10T09:00')]
    const created = pendingInterest(txs, 'c1', 5, new Date('2026-12-02T09:00'), newId)
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      childId: 'c1',
      type: 'interest',
      points: 5,
      period: '2026-11',
      at: new Date('2026-12-01T00:00').toISOString(),
    })
  })

  it('今月の分はまだ計算しない', () => {
    const txs = [tx('opening', 100, '2026-11-01T09:00'), tx('deposit', 100, '2026-11-10T09:00')]
    expect(pendingInterest(txs, 'c1', 5, new Date('2026-11-30T23:59'), newId)).toEqual([])
  })

  it('その月に引き出していたら利息なし', () => {
    const txs = [
      tx('opening', 100, '2026-11-01T09:00'),
      tx('deposit', 100, '2026-11-10T09:00'),
      tx('withdraw', 1, '2026-11-20T09:00'),
    ]
    expect(pendingInterest(txs, 'c1', 5, new Date('2026-12-02T09:00'), newId)).toEqual([])
  })

  it('引き出しを取り消していれば利息あり', () => {
    const txs = [
      tx('opening', 100, '2026-11-01T09:00'),
      tx('deposit', 100, '2026-11-10T09:00'),
      tx('withdraw', 1, '2026-11-20T09:00', { voidedAt: '2026-11-20T01:00:00.000Z' }),
    ]
    expect(pendingInterest(txs, 'c1', 5, new Date('2026-12-02T09:00'), newId)).toHaveLength(1)
  })

  it('複数月をさかのぼって、前の月の利息を含めて複利で計算する', () => {
    const txs = [tx('opening', 1000, '2026-11-01T09:00'), tx('deposit', 1000, '2026-11-10T09:00')]
    const created = pendingInterest(txs, 'c1', 5, new Date('2027-02-15T09:00'), newId)
    expect(created.map((t) => [t.period, t.points])).toEqual([
      ['2026-11', 50],
      ['2026-12', 52],
      ['2027-01', 55],
    ])
  })

  it('計算済みの月は二重に計算しない', () => {
    const txs: Transaction[] = [tx('opening', 100, '2026-11-01T09:00'), tx('deposit', 100, '2026-11-10T09:00')]
    const now = new Date('2026-12-02T09:00')
    const first = pendingInterest(txs, 'c1', 5, now, newId)
    expect(pendingInterest([...txs, ...first], 'c1', 5, now, newId)).toEqual([])
  })

  it('残高0の月は飛ばし、あとの月は計算する', () => {
    const txs = [tx('opening', 100, '2026-11-01T09:00'), tx('deposit', 100, '2026-12-10T09:00')]
    const created = pendingInterest(txs, 'c1', 5, new Date('2027-01-05T09:00'), newId)
    expect(created.map((t) => t.period)).toEqual(['2026-12'])
  })

  it('ほかの子の記録は影響しない', () => {
    const txs = [
      tx('opening', 100, '2026-11-01T09:00'),
      tx('deposit', 100, '2026-11-10T09:00'),
      tx('withdraw', 50, '2026-11-20T09:00', { childId: 'c2' }),
    ]
    expect(pendingInterest(txs, 'c1', 5, new Date('2026-12-02T09:00'), newId)).toHaveLength(1)
    expect(pendingInterest(txs, 'c3', 5, new Date('2026-12-02T09:00'), newId)).toEqual([])
  })
})

describe('monthOutcome', () => {
  const base = [tx('opening', 100, '2026-11-01T09:00'), tx('deposit', 100, '2026-11-10T09:00')]

  it('利息があれば interest', () => {
    const txs = [...base, tx('interest', 5, '2026-12-01T00:00', { period: '2026-11' })]
    expect(monthOutcome(txs, 'c1', '2026-11')).toEqual({ kind: 'interest', points: 5 })
  })

  it('引き出して利息がなければ rest', () => {
    const txs = [...base, tx('withdraw', 1, '2026-11-20T09:00')]
    expect(monthOutcome(txs, 'c1', '2026-11')).toEqual({ kind: 'rest' })
  })

  it('どちらでもなければ none', () => {
    expect(monthOutcome([tx('opening', 5, '2026-11-01T09:00')], 'c1', '2026-11')).toEqual({ kind: 'none' })
  })
})

describe('projectedInterest', () => {
  it('今のちょきんばこ残高から来月の利息見込みを出す', () => {
    const txs = [tx('opening', 100, '2026-11-01T09:00'), tx('deposit', 60, '2026-11-10T09:00')]
    expect(projectedInterest(txs, 'c1', 5, new Date('2026-11-15T09:00'))).toEqual({ savings: 60, points: 3, blocked: false })
  })

  it('今月引き出していたら blocked', () => {
    const txs = [
      tx('opening', 100, '2026-11-01T09:00'),
      tx('deposit', 60, '2026-11-10T09:00'),
      tx('withdraw', 10, '2026-11-12T09:00'),
    ]
    expect(projectedInterest(txs, 'c1', 5, new Date('2026-11-15T09:00'))).toEqual({ savings: 50, points: 0, blocked: true })
  })
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/domain/interest`
Expected: FAIL（`./interest` が見つからない）

- [ ] **Step 3: 実装する**

`src/domain/interest.ts`:

```ts
import { balancesOf } from './balance'
import { monthKey, monthStart, nextMonth } from './month'
import type { MonthKey, Transaction } from './types'

export function interestFor(savings: number, percent: number): number {
  if (savings <= 0 || percent <= 0) return 0
  return Math.max(1, Math.floor((savings * percent) / 100))
}

export function withdrewIn(txs: Transaction[], childId: string, m: MonthKey): boolean {
  const start = monthStart(m)
  const end = monthStart(nextMonth(m))
  return txs.some((t) => {
    if (t.childId !== childId || t.voidedAt || t.type !== 'withdraw') return false
    const at = new Date(t.at)
    return at >= start && at < end
  })
}

export function pendingInterest(
  txs: Transaction[],
  childId: string,
  percent: number,
  now: Date,
  newId: () => string,
): Transaction[] {
  const mine = txs.filter((t) => t.childId === childId && !t.voidedAt)
  if (mine.length === 0) return []
  const firstAt = mine.reduce((min, t) => (t.at < min ? t.at : min), mine[0].at)
  const current = monthKey(now)
  const settled = new Set(mine.filter((t) => t.type === 'interest').map((t) => t.period))
  const working = [...txs]
  const created: Transaction[] = []
  for (let m = monthKey(new Date(firstAt)); m < current; m = nextMonth(m)) {
    if (settled.has(m) || withdrewIn(working, childId, m)) continue
    const end = monthStart(nextMonth(m))
    const points = interestFor(balancesOf(working, childId, end).savings, percent)
    if (points === 0) continue
    const t: Transaction = { id: newId(), childId, type: 'interest', points, at: end.toISOString(), period: m }
    working.push(t)
    created.push(t)
  }
  return created
}

export type MonthOutcome = { kind: 'interest'; points: number } | { kind: 'rest' } | { kind: 'none' }

export function monthOutcome(txs: Transaction[], childId: string, m: MonthKey): MonthOutcome {
  const it = txs.find((t) => t.childId === childId && !t.voidedAt && t.type === 'interest' && t.period === m)
  if (it) return { kind: 'interest', points: it.points }
  if (withdrewIn(txs, childId, m)) return { kind: 'rest' }
  return { kind: 'none' }
}

export function projectedInterest(
  txs: Transaction[],
  childId: string,
  percent: number,
  now: Date,
): { savings: number; points: number; blocked: boolean } {
  const { savings } = balancesOf(txs, childId)
  const blocked = withdrewIn(txs, childId, monthKey(now))
  return { savings, points: blocked ? 0 : interestFor(savings, percent), blocked }
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `npm test -- src/domain/interest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/interest.ts src/domain/interest.test.ts
git commit -m "feat: ちょきんばこの月末利息の計算を追加"
```

---

### Task 4: 取り消し・スタンプカード・取引の説明

**Files:**
- Create: `src/domain/undo.ts`、`src/domain/stampcard.ts`、`src/domain/describeTx.ts`
- Test: `src/domain/undo.test.ts`、`src/domain/stampcard.test.ts`、`src/domain/describeTx.test.ts`

**Interfaces:**
- Consumes: `balancesOf`、`byTime`、`monthKey`
- Produces:
  - `type UndoFailReason = 'none' | 'interest' | 'settled' | 'negative'`
  - `type UndoCheck = { ok: true; tx: Transaction } | { ok: false; reason: UndoFailReason; tx?: Transaction }`
  - `checkUndo(txs: Transaction[], now: Date): UndoCheck`
  - `CARD_SIZE = 20`、`stampCards(txs, childId): Transaction[][]`（最後の要素が今のカード）、`isCardCompletedBy(cards: Transaction[][], txId: string): boolean`
  - `describeTx(tx: Transaction, childName: string): string`

- [ ] **Step 1: 失敗するテストを書く**

`src/domain/undo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { tx } from './fixtures'
import { checkUndo } from './undo'

const now = new Date('2026-12-02T09:00')

describe('checkUndo', () => {
  it('記録がなければ none', () => {
    expect(checkUndo([], now)).toEqual({ ok: false, reason: 'none' })
  })

  it('時刻がいちばん新しい有効な記録が対象', () => {
    const a = tx('stamp', 1, '2026-12-01T10:00')
    const b = tx('stamp', 2, '2026-12-02T08:00', { childId: 'c2' })
    const c = tx('stamp', 3, '2026-12-02T08:30', { voidedAt: '2026-12-01T23:31:00.000Z' })
    const r = checkUndo([b, a, c], now)
    expect(r).toEqual({ ok: true, tx: b })
  })

  it('利息は取り消せない', () => {
    const it1 = tx('interest', 5, '2026-12-01T00:00', { period: '2026-11' })
    expect(checkUndo([tx('deposit', 100, '2026-11-10T09:00'), it1], now)).toMatchObject({ ok: false, reason: 'interest' })
  })

  it('前の月の記録は取り消せない', () => {
    expect(checkUndo([tx('stamp', 1, '2026-11-20T09:00')], now)).toMatchObject({ ok: false, reason: 'settled' })
  })

  it('取り消すと残高がマイナスになる場合は取り消せない', () => {
    // 読み込んだデータなどで、開始残高より前に使った記録がある場合
    const txs = [tx('spend', 10, '2026-12-01T09:00'), tx('opening', 10, '2026-12-02T08:00')]
    expect(checkUndo(txs, now)).toMatchObject({ ok: false, reason: 'negative' })
  })
})
```

`src/domain/stampcard.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { tx } from './fixtures'
import { CARD_SIZE, isCardCompletedBy, stampCards } from './stampcard'

const stamps = (n: number) =>
  Array.from({ length: n }, (_, i) => tx('stamp', 1, `2026-11-01T09:${String(i).padStart(2, '0')}`))

describe('stampCards', () => {
  it('スタンプがなければ空のカードが1枚', () => {
    expect(stampCards([], 'c1')).toEqual([[]])
  })

  it('20こまでは1枚目に入る', () => {
    expect(stampCards(stamps(3), 'c1').map((c) => c.length)).toEqual([3])
  })

  it('20こ埋まると次の空のカードに進む', () => {
    const s = stamps(CARD_SIZE)
    const cards = stampCards(s, 'c1')
    expect(cards.map((c) => c.length)).toEqual([20, 0])
    expect(isCardCompletedBy(cards, s[19].id)).toBe(true)
    expect(isCardCompletedBy(cards, s[18].id)).toBe(false)
  })

  it('21こ目は2枚目に入る', () => {
    expect(stampCards(stamps(21), 'c1').map((c) => c.length)).toEqual([20, 1])
  })

  it('取り消し済み・スタンプ以外・ほかの子は数えない', () => {
    const txs = [
      tx('stamp', 1, '2026-11-01T09:00'),
      tx('stamp', 1, '2026-11-01T09:01', { voidedAt: '2026-11-01T00:02:00.000Z' }),
      tx('opening', 10, '2026-11-01T09:02'),
      tx('stamp', 1, '2026-11-01T09:03', { childId: 'c2' }),
    ]
    expect(stampCards(txs, 'c1').map((c) => c.length)).toEqual([1])
  })
})
```

`src/domain/describeTx.test.ts`:

```ts
import { expect, it } from 'vitest'
import { describeTx } from './describeTx'
import { tx } from './fixtures'

it('子どもの名前・メモ・種類・pt数で説明する', () => {
  expect(describeTx(tx('stamp', 1, '2026-11-01T09:00', { memo: 'おてつだい' }), 'あおい')).toBe('あおい：おてつだい スタンプ 1pt')
  expect(describeTx(tx('deposit', 5, '2026-11-01T09:00'), 'そら')).toBe('そら：ちょきん 5pt')
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/domain`
Expected: FAIL（`./undo` などが見つからない）

- [ ] **Step 3: 実装する**

`src/domain/undo.ts`:

```ts
import { balancesOf } from './balance'
import { monthKey } from './month'
import type { Transaction } from './types'

export type UndoFailReason = 'none' | 'interest' | 'settled' | 'negative'
export type UndoCheck = { ok: true; tx: Transaction } | { ok: false; reason: UndoFailReason; tx?: Transaction }

export function checkUndo(txs: Transaction[], now: Date): UndoCheck {
  const active = txs.filter((t) => !t.voidedAt)
  if (active.length === 0) return { ok: false, reason: 'none' }
  const last = active.reduce((a, b) => (b.at >= a.at ? b : a))
  if (last.type === 'interest') return { ok: false, reason: 'interest', tx: last }
  if (monthKey(new Date(last.at)) < monthKey(now)) return { ok: false, reason: 'settled', tx: last }
  const b = balancesOf(
    txs.filter((t) => t.id !== last.id),
    last.childId,
  )
  if (b.wallet < 0 || b.savings < 0) return { ok: false, reason: 'negative', tx: last }
  return { ok: true, tx: last }
}
```

`src/domain/stampcard.ts`:

```ts
import { byTime } from './balance'
import type { Transaction } from './types'

export const CARD_SIZE = 20

export function stampCards(txs: Transaction[], childId: string): Transaction[][] {
  const stamps = txs.filter((t) => t.childId === childId && !t.voidedAt && t.type === 'stamp').sort(byTime)
  const cards: Transaction[][] = []
  for (let i = 0; i < stamps.length; i += CARD_SIZE) cards.push(stamps.slice(i, i + CARD_SIZE))
  if (cards.length === 0 || cards[cards.length - 1].length === CARD_SIZE) cards.push([])
  return cards
}

export function isCardCompletedBy(cards: Transaction[][], txId: string): boolean {
  return cards.some((c) => c.length === CARD_SIZE && c[CARD_SIZE - 1].id === txId)
}
```

`src/domain/describeTx.ts`:

```ts
import type { Transaction, TxType } from './types'

const TYPE_LABEL: Record<TxType, string> = {
  opening: 'はじめのポイント',
  stamp: 'スタンプ',
  spend: 'つかう',
  deposit: 'ちょきん',
  withdraw: 'ひきだし',
  interest: 'りそく',
}

export function describeTx(tx: Transaction, childName: string): string {
  return `${childName}：${tx.memo ? `${tx.memo} ` : ''}${TYPE_LABEL[tx.type]} ${tx.points}pt`
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `npm test -- src/domain`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: 取り消し可否、スタンプカード、取引の説明を追加"
```

---

### Task 5: 保存（Dexie）と Repo

**Files:**
- Create: `src/storage/db.ts`、`src/storage/ids.ts`、`src/storage/pin.ts`、`src/storage/defaults.ts`、`src/storage/repo.ts`
- Test: `src/storage/pin.test.ts`、`src/storage/repo.test.ts`

**Interfaces:**
- Consumes: domain の全関数
- Produces:
  - `db.ts`: `class KidsPointsDB`（テーブル `children` / `menuItems` / `transactions` / `kv`）、`REAL_DB = 'kids-points'`、`DEMO_DB = 'kids-points-demo'`
  - `ids.ts`: `newId(): string`
  - `pin.ts`: `isValidPin(pin: string): boolean`、`hashPin(pin: string): string`
  - `defaults.ts`: `AVATARS`、`COLORS`、`MENU_ICONS`（string[]）、`DEFAULT_MENU: { label: string; icon: string; points: number }[]`
  - `repo.ts`: `DEFAULT_SETTINGS`、`interface Snapshot { children; menuItems; transactions; settings; seen: Record<string, MonthKey> }`、`type NewTx`、`class OpFailed extends Error { reason }`、`class Repo`（`db`、`now()`、`settings()`、`updateSettings(patch)`、`setPin(pin)`、`checkPin(pin)`、`seen()`、`markSeen(childId, period)`、`saveChild(child)`、`saveMenuItem(item)`、`deleteMenuItem(id)`、`settle()`、`addTx(input)`、`previewUndo()`、`undoLast()`、`snapshot()`）

- [ ] **Step 1: DB 定義・id・初期値を書く**

`src/storage/db.ts`:

```ts
import Dexie, { type Table } from 'dexie'
import type { Child, MenuItem, Transaction } from '../domain/types'

export interface KV {
  key: string
  value: unknown
}

export const REAL_DB = 'kids-points'
export const DEMO_DB = 'kids-points-demo'

export class KidsPointsDB extends Dexie {
  // useDefineForClassFields で Dexie のテーブルが上書きされないよう declare を使う
  declare children: Table<Child, string>
  declare menuItems: Table<MenuItem, string>
  declare transactions: Table<Transaction, string>
  declare kv: Table<KV, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      children: 'id',
      menuItems: 'id',
      transactions: 'id, childId, at',
      kv: 'key',
    })
  }
}
```

`src/storage/ids.ts`:

```ts
let counter = 0

export function newId(): string {
  counter = (counter + 1) % 1_000_000
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
```

`src/storage/defaults.ts`:

```ts
export const AVATARS = ['🐶', '🐱', '🐰', '🦊', '🐼', '🐻', '🐸', '🦁', '🐧', '🦄']
export const COLORS = ['#ff8a5c', '#5cb8ff', '#62c47a', '#b38bff', '#f2b33d', '#ff7eb6']
export const MENU_ICONS = ['🧹', '📚', '🪥', '🧸', '🍽️', '👕', '🛁', '🌱', '🎹', '⚽', '💪', '⭐']

export const DEFAULT_MENU: { label: string; icon: string; points: number }[] = [
  { label: 'おてつだい', icon: '🧹', points: 1 },
  { label: 'しゅくだい', icon: '📚', points: 1 },
  { label: 'はみがき', icon: '🪥', points: 1 },
  { label: 'おかたづけ', icon: '🧸', points: 1 },
  { label: 'おさらあらい', icon: '🍽️', points: 2 },
]
```

- [ ] **Step 2: PIN の失敗するテストを書く**

`src/storage/pin.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hashPin, isValidPin } from './pin'

describe('pin', () => {
  it('4けたの数字だけ有効', () => {
    expect(isValidPin('0123')).toBe(true)
    for (const p of ['123', '12345', 'abcd', '12 3']) expect(isValidPin(p)).toBe(false)
  })

  it('同じPINは同じハッシュ、違うPINは違うハッシュ、PINそのものではない', () => {
    expect(hashPin('1234')).toBe(hashPin('1234'))
    expect(hashPin('1234')).not.toBe(hashPin('1235'))
    expect(hashPin('1234')).not.toContain('1234')
  })
})
```

- [ ] **Step 3: Repo の失敗するテストを書く**

`src/storage/repo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { balancesOf } from '../domain/balance'
import { KidsPointsDB } from './db'
import { newId } from './ids'
import { OpFailed, Repo } from './repo'

function makeRepo(start: string) {
  const clock = { now: new Date(start) }
  const repo = new Repo(new KidsPointsDB(`test-${newId()}`), () => clock.now)
  return { repo, clock }
}

describe('Repo', () => {
  it('取引を記録し、スナップショットから残高が出る', async () => {
    const { repo } = makeRepo('2026-11-05T09:00')
    await repo.addTx({ childId: 'c1', type: 'opening', points: 30 })
    await repo.addTx({ childId: 'c1', type: 'deposit', points: 10 })
    const snap = await repo.snapshot()
    expect(balancesOf(snap.transactions, 'c1')).toEqual({ wallet: 20, savings: 10 })
    expect(snap.transactions[0].at).toBe(new Date('2026-11-05T09:00').toISOString())
  })

  it('残高不足は OpFailed(insufficient) で拒否し、記録しない', async () => {
    const { repo } = makeRepo('2026-11-05T09:00')
    await repo.addTx({ childId: 'c1', type: 'opening', points: 3 })
    await expect(repo.addTx({ childId: 'c1', type: 'spend', points: 4 })).rejects.toMatchObject({ reason: 'insufficient' })
    expect((await repo.snapshot()).transactions).toHaveLength(1)
  })

  it('settle は前月の利息を1回だけ記録する', async () => {
    const { repo, clock } = makeRepo('2026-11-05T09:00')
    await repo.saveChild({ id: 'c1', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 })
    await repo.addTx({ childId: 'c1', type: 'opening', points: 100 })
    await repo.addTx({ childId: 'c1', type: 'deposit', points: 100 })
    clock.now = new Date('2026-12-03T09:00')
    expect(await repo.settle()).toHaveLength(1)
    expect(await repo.settle()).toHaveLength(0)
    expect(balancesOf((await repo.snapshot()).transactions, 'c1').savings).toBe(105)
  })

  it('月が変わった直後の操作では、先に前月の利息を確定させる', async () => {
    const { repo, clock } = makeRepo('2026-11-30T23:58')
    await repo.saveChild({ id: 'c1', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 })
    await repo.addTx({ childId: 'c1', type: 'opening', points: 100 })
    await repo.addTx({ childId: 'c1', type: 'deposit', points: 100 })
    clock.now = new Date('2026-12-01T00:00:05')
    await repo.addTx({ childId: 'c1', type: 'stamp', points: 1 })
    const interest = (await repo.snapshot()).transactions.filter((t) => t.type === 'interest')
    expect(interest).toMatchObject([{ period: '2026-11', points: 5 }])
  })

  it('undoLast は直前の記録に voidedAt をつける。利息は取り消せない', async () => {
    const { repo, clock } = makeRepo('2026-11-05T09:00')
    await repo.saveChild({ id: 'c1', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 })
    await repo.addTx({ childId: 'c1', type: 'opening', points: 100 })
    const stamp = await repo.addTx({ childId: 'c1', type: 'stamp', points: 2 })
    expect((await repo.undoLast()).id).toBe(stamp.id)
    const voided = (await repo.snapshot()).transactions.find((t) => t.id === stamp.id)
    expect(voided?.voidedAt).toBeDefined()

    await repo.addTx({ childId: 'c1', type: 'deposit', points: 100 })
    clock.now = new Date('2026-12-02T09:00')
    await expect(repo.undoLast()).rejects.toBeInstanceOf(OpFailed)
    await expect(repo.undoLast()).rejects.toMatchObject({ reason: 'interest' })
  })

  it('設定・PIN・既読を保存できる', async () => {
    const { repo } = makeRepo('2026-11-05T09:00')
    expect((await repo.settings()).interestPercent).toBe(5)
    await repo.setPin('1234')
    expect(await repo.checkPin('1234')).toBe(true)
    expect(await repo.checkPin('9999')).toBe(false)
    await expect(repo.setPin('12')).rejects.toThrow()
    await repo.markSeen('c1', '2026-10')
    expect((await repo.snapshot()).seen).toEqual({ c1: '2026-10' })
  })

  it('子どもとメニューは並び順でスナップショットに入る', async () => {
    const { repo } = makeRepo('2026-11-05T09:00')
    await repo.saveChild({ id: 'b', name: 'そら', avatar: '🐰', color: '#5cb8ff', displayMode: 'young', order: 1 })
    await repo.saveChild({ id: 'a', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 })
    await repo.saveMenuItem({ id: 'm1', label: 'はみがき', icon: '🪥', points: 1, childIds: ['a'], order: 0 })
    await repo.deleteMenuItem('m1')
    const snap = await repo.snapshot()
    expect(snap.children.map((c) => c.id)).toEqual(['a', 'b'])
    expect(snap.menuItems).toEqual([])
  })
})
```

- [ ] **Step 4: 失敗を確認する**

Run: `npm test -- src/storage`
Expected: FAIL（`./pin`、`./repo` が見つからない）

- [ ] **Step 5: 実装する**

`src/storage/pin.ts`:

```ts
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

// 子どもが勝手に親の操作をしないための鍵。強固な暗号ではなく FNV-1a で十分とする
export function hashPin(pin: string): string {
  let h = 0x811c9dc5
  for (const ch of `kids-points:${pin}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
```

`src/storage/repo.ts`:

```ts
import { byTime } from '../domain/balance'
import { pendingInterest } from '../domain/interest'
import type { Child, MenuItem, MonthKey, Settings, Transaction, TxType } from '../domain/types'
import { checkUndo, type UndoCheck, type UndoFailReason } from '../domain/undo'
import { validateOp, type OpError } from '../domain/validate'
import type { KidsPointsDB } from './db'
import { newId } from './ids'
import { hashPin, isValidPin } from './pin'

export const DEFAULT_SETTINGS: Settings = {
  pinHash: null,
  interestPercent: 5,
  soundOn: true,
  lastBackupAt: null,
}

export interface Snapshot {
  children: Child[]
  menuItems: MenuItem[]
  transactions: Transaction[]
  settings: Settings
  seen: Record<string, MonthKey>
}

export type NewTx = {
  childId: string
  type: Exclude<TxType, 'interest'>
  points: number
  memo?: string
  menuItemId?: string
  icon?: string
}

export class OpFailed extends Error {
  readonly reason: OpError | UndoFailReason

  constructor(reason: OpError | UndoFailReason) {
    super(reason)
    this.name = 'OpFailed'
    this.reason = reason
  }
}

export class Repo {
  readonly db: KidsPointsDB
  private readonly clock: () => Date

  constructor(db: KidsPointsDB, clock: () => Date) {
    this.db = db
    this.clock = clock
  }

  now(): Date {
    return this.clock()
  }

  async settings(): Promise<Settings> {
    const row = await this.db.kv.get('settings')
    return { ...DEFAULT_SETTINGS, ...(row?.value as Partial<Settings> | undefined) }
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    await this.db.transaction('rw', [this.db.kv], async () => {
      const current = await this.settings()
      await this.db.kv.put({ key: 'settings', value: { ...current, ...patch } })
    })
  }

  async setPin(pin: string): Promise<void> {
    if (!isValidPin(pin)) throw new Error('PIN は4けたの数字です')
    await this.updateSettings({ pinHash: hashPin(pin) })
  }

  async checkPin(pin: string): Promise<boolean> {
    return (await this.settings()).pinHash === hashPin(pin)
  }

  async seen(): Promise<Record<string, MonthKey>> {
    const row = await this.db.kv.get('seen')
    return (row?.value as Record<string, MonthKey> | undefined) ?? {}
  }

  async markSeen(childId: string, period: MonthKey): Promise<void> {
    await this.db.transaction('rw', [this.db.kv], async () => {
      const seen = await this.seen()
      await this.db.kv.put({ key: 'seen', value: { ...seen, [childId]: period } })
    })
  }

  async saveChild(child: Child): Promise<void> {
    await this.db.children.put(child)
  }

  async saveMenuItem(item: MenuItem): Promise<void> {
    await this.db.menuItems.put(item)
  }

  async deleteMenuItem(id: string): Promise<void> {
    await this.db.menuItems.delete(id)
  }

  // 未計算の月の利息をすべて記録する。起動時・画面復帰時・各操作の前に呼ぶ
  async settle(): Promise<Transaction[]> {
    return this.db.transaction('rw', [this.db.children, this.db.transactions, this.db.kv], async () => {
      const [children, txs, settings] = await Promise.all([
        this.db.children.toArray(),
        this.db.transactions.toArray(),
        this.settings(),
      ])
      const now = this.clock()
      const created = children.flatMap((c) => pendingInterest(txs, c.id, settings.interestPercent, now, newId))
      if (created.length > 0) await this.db.transactions.bulkAdd(created)
      return created
    })
  }

  async addTx(input: NewTx): Promise<Transaction> {
    await this.settle()
    return this.db.transaction('rw', [this.db.transactions], async () => {
      const txs = await this.db.transactions.where('childId').equals(input.childId).toArray()
      const error = validateOp(txs, input.childId, input.type, input.points)
      if (error) throw new OpFailed(error)
      const tx: Transaction = { id: newId(), at: this.clock().toISOString(), ...input }
      await this.db.transactions.add(tx)
      return tx
    })
  }

  async previewUndo(): Promise<UndoCheck> {
    await this.settle()
    return checkUndo(await this.db.transactions.toArray(), this.clock())
  }

  async undoLast(): Promise<Transaction> {
    await this.settle()
    return this.db.transaction('rw', [this.db.transactions], async () => {
      const result = checkUndo(await this.db.transactions.toArray(), this.clock())
      if (!result.ok) throw new OpFailed(result.reason)
      await this.db.transactions.update(result.tx.id, { voidedAt: this.clock().toISOString() })
      return result.tx
    })
  }

  async snapshot(): Promise<Snapshot> {
    const [children, menuItems, transactions, settings, seen] = await Promise.all([
      this.db.children.toArray(),
      this.db.menuItems.toArray(),
      this.db.transactions.toArray(),
      this.settings(),
      this.seen(),
    ])
    return {
      children: children.sort((a, b) => a.order - b.order),
      menuItems: menuItems.sort((a, b) => a.order - b.order),
      transactions: transactions.sort(byTime),
      settings,
      seen,
    }
  }
}
```

- [ ] **Step 6: 通ることを確認する**

Run: `npm test -- src/storage`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/storage
git commit -m "feat: IndexedDB への保存と Repo を追加"
```

---

### Task 6: バックアップとデモ用データ

**Files:**
- Create: `src/storage/backup.ts`、`src/storage/demo.ts`
- Test: `src/storage/backup.test.ts`、`src/storage/demo.test.ts`

**Interfaces:**
- Consumes: `Repo`、`KidsPointsDB`、`DEFAULT_SETTINGS`、`DEFAULT_MENU`、`hashPin`、`pendingInterest`、month 関数
- Produces:
  - `backup.ts`: `interface BackupFile { app: 'kids-points'; version: 1; exportedAt: string; children; menuItems; transactions; settings }`、`class BackupError extends Error`、`exportBackup(repo): Promise<string>`、`parseBackup(text: string): BackupFile`、`importBackup(repo, file): Promise<void>`、`needsBackupReminder(settings, now): boolean`
  - `demo.ts`: `DEMO_PIN = '0000'`、`DEMO_CHILD_IDS = ['demo-aoi', 'demo-sora']`、`getDemoOffset(db): Promise<number>`、`setDemoOffset(db, n): Promise<void>`、`demoClock(offset): () => Date`、`seedDemo(db, now): Promise<void>`

- [ ] **Step 1: 失敗するテストを書く**

`src/storage/backup.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BackupError, exportBackup, importBackup, needsBackupReminder, parseBackup } from './backup'
import { KidsPointsDB } from './db'
import { newId } from './ids'
import { DEFAULT_SETTINGS, Repo } from './repo'

const now = () => new Date('2026-11-05T09:00')
const makeRepo = () => new Repo(new KidsPointsDB(`test-${newId()}`), now)

async function seeded() {
  const repo = makeRepo()
  await repo.saveChild({ id: 'c1', name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 })
  await repo.saveMenuItem({ id: 'm1', label: 'はみがき', icon: '🪥', points: 1, childIds: ['c1'], order: 0 })
  await repo.addTx({ childId: 'c1', type: 'opening', points: 30 })
  await repo.setPin('1234')
  return repo
}

describe('backup', () => {
  it('書き出したものを別のDBに読み込むと同じ内容になり、書き出し日時が残る', async () => {
    const src = await seeded()
    const text = await exportBackup(src)
    expect((await src.settings()).lastBackupAt).toBe(now().toISOString())

    const dst = makeRepo()
    await importBackup(dst, parseBackup(text))
    const [a, b] = [await src.snapshot(), await dst.snapshot()]
    expect(b.children).toEqual(a.children)
    expect(b.menuItems).toEqual(a.menuItems)
    expect(b.transactions).toEqual(a.transactions)
    expect(await dst.checkPin('1234')).toBe(true)
  })

  it('読み込みは今のデータを丸ごと置き換える', async () => {
    const src = await seeded()
    const text = await exportBackup(src)
    const dst = makeRepo()
    await dst.saveChild({ id: 'old', name: 'まえの子', avatar: '🐶', color: '#000', displayMode: 'young', order: 0 })
    await importBackup(dst, parseBackup(text))
    expect((await dst.snapshot()).children.map((c) => c.id)).toEqual(['c1'])
  })

  it('壊れたファイルや別アプリのファイルは BackupError', async () => {
    const good = JSON.parse(await exportBackup(await seeded()))
    const bad = [
      'これはJSONではない',
      JSON.stringify({ app: 'other', version: 1 }),
      JSON.stringify({ ...good, transactions: 'x' }),
      JSON.stringify({ ...good, transactions: [{ ...good.transactions[0], points: 1.5 }] }),
      JSON.stringify({ ...good, transactions: [{ ...good.transactions[0], type: 'steal' }] }),
      JSON.stringify({ ...good, transactions: [{ ...good.transactions[0], childId: 'nobody' }] }),
    ]
    for (const text of bad) expect(() => parseBackup(text)).toThrow(BackupError)
  })

  it('最後の書き出しから30日以上、または一度も書き出していなければリマインドする', () => {
    const base = new Date('2026-11-05T09:00')
    expect(needsBackupReminder({ ...DEFAULT_SETTINGS, lastBackupAt: null }, base)).toBe(true)
    expect(needsBackupReminder({ ...DEFAULT_SETTINGS, lastBackupAt: new Date('2026-10-07T09:00').toISOString() }, base)).toBe(false)
    expect(needsBackupReminder({ ...DEFAULT_SETTINGS, lastBackupAt: new Date('2026-10-06T09:00').toISOString() }, base)).toBe(true)
  })
})
```

`src/storage/demo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { balancesOf } from '../domain/balance'
import { monthOutcome } from '../domain/interest'
import { addMonths, monthKey } from '../domain/month'
import { KidsPointsDB } from './db'
import { DEMO_CHILD_IDS, DEMO_PIN, demoClock, getDemoOffset, seedDemo, setDemoOffset } from './demo'
import { newId } from './ids'
import { Repo } from './repo'

const now = new Date('2026-11-05T09:00')

describe('demo', () => {
  it('子ども2人と過去3ヶ月分の記録・利息を作る', async () => {
    const db = new KidsPointsDB(`test-${newId()}`)
    await seedDemo(db, now)
    const repo = new Repo(db, () => now)
    const snap = await repo.snapshot()
    expect(snap.children.map((c) => c.id)).toEqual(DEMO_CHILD_IDS)
    expect(await repo.checkPin(DEMO_PIN)).toBe(true)
    for (const id of DEMO_CHILD_IDS) {
      const b = balancesOf(snap.transactions, id)
      expect(b.wallet).toBeGreaterThanOrEqual(0)
      expect(b.savings).toBeGreaterThan(0)
    }
    expect(monthOutcome(snap.transactions, 'demo-aoi', '2026-10')).toMatchObject({ kind: 'interest' })
    expect(monthOutcome(snap.transactions, 'demo-sora', '2026-09')).toEqual({ kind: 'rest' })
    expect(snap.seen).toEqual({ 'demo-aoi': '2026-10', 'demo-sora': '2026-10' })
    // 既に計算済みなので、同じ時刻で settle しても増えない
    expect(await repo.settle()).toHaveLength(0)
  })

  it('もう一度 seed すると初期状態に戻る', async () => {
    const db = new KidsPointsDB(`test-${newId()}`)
    await seedDemo(db, now)
    const count = await db.transactions.count()
    await setDemoOffset(db, 2)
    await seedDemo(db, now)
    expect(await db.transactions.count()).toBe(count)
    expect(await getDemoOffset(db)).toBe(0)
  })

  it('demoClock は月をずらし、1ヶ月すすめると今月分の利息がつく', async () => {
    expect(monthKey(demoClock(1)())).toBe(monthKey(addMonths(new Date(), 1)))
    const db = new KidsPointsDB(`test-${newId()}`)
    await seedDemo(db, now)
    const repo = new Repo(db, () => addMonths(now, 1))
    const created = await repo.settle()
    expect(created.map((t) => [t.childId, t.period])).toEqual([
      ['demo-aoi', '2026-11'],
      ['demo-sora', '2026-11'],
    ])
  })
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/storage`
Expected: FAIL（`./backup`、`./demo` が見つからない）

- [ ] **Step 3: 実装する**

`src/storage/backup.ts`:

```ts
import type { Child, MenuItem, Settings, Transaction, TxType } from '../domain/types'
import { DEFAULT_SETTINGS, type Repo } from './repo'

export interface BackupFile {
  app: 'kids-points'
  version: 1
  exportedAt: string
  children: Child[]
  menuItems: MenuItem[]
  transactions: Transaction[]
  settings: Settings
}

export class BackupError extends Error {}

const TX_TYPES: TxType[] = ['opening', 'stamp', 'spend', 'deposit', 'withdraw', 'interest']
const DAY_MS = 24 * 60 * 60 * 1000
export const BACKUP_REMINDER_DAYS = 30

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isPositiveInt(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1
}

export async function exportBackup(repo: Repo): Promise<string> {
  const exportedAt = repo.now().toISOString()
  await repo.updateSettings({ lastBackupAt: exportedAt })
  const s = await repo.snapshot()
  const file: BackupFile = {
    app: 'kids-points',
    version: 1,
    exportedAt,
    children: s.children,
    menuItems: s.menuItems,
    transactions: s.transactions,
    settings: s.settings,
  }
  return JSON.stringify(file, null, 2)
}

export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('JSON として読めないファイルです')
  }
  if (!isObj(data) || data.app !== 'kids-points' || data.version !== 1) {
    throw new BackupError('このアプリのバックアップではありません')
  }
  const { children, menuItems, transactions, settings, exportedAt } = data
  if (!Array.isArray(children) || !Array.isArray(menuItems) || !Array.isArray(transactions) || !isObj(settings) || typeof exportedAt !== 'string') {
    throw new BackupError('ファイルの中身が足りません')
  }
  const childIds = new Set<string>()
  for (const c of children) {
    if (!isObj(c) || typeof c.id !== 'string' || typeof c.name !== 'string') throw new BackupError('こどものデータが壊れています')
    childIds.add(c.id)
  }
  for (const m of menuItems) {
    if (!isObj(m) || typeof m.id !== 'string' || typeof m.label !== 'string' || !isPositiveInt(m.points)) {
      throw new BackupError('メニューのデータが壊れています')
    }
  }
  for (const t of transactions) {
    if (
      !isObj(t) ||
      typeof t.id !== 'string' ||
      typeof t.childId !== 'string' ||
      !childIds.has(t.childId) ||
      !TX_TYPES.includes(t.type as TxType) ||
      !isPositiveInt(t.points) ||
      typeof t.at !== 'string' ||
      Number.isNaN(Date.parse(t.at))
    ) {
      throw new BackupError('きろくのデータが壊れています')
    }
  }
  return data as unknown as BackupFile
}

export async function importBackup(repo: Repo, file: BackupFile): Promise<void> {
  const db = repo.db
  await db.transaction('rw', [db.children, db.menuItems, db.transactions, db.kv], async () => {
    await Promise.all([db.children.clear(), db.menuItems.clear(), db.transactions.clear()])
    await db.children.bulkAdd(file.children)
    await db.menuItems.bulkAdd(file.menuItems)
    await db.transactions.bulkAdd(file.transactions)
    await db.kv.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, ...file.settings } })
  })
}

export function needsBackupReminder(settings: Settings, now: Date): boolean {
  if (!settings.lastBackupAt) return true
  return now.getTime() - Date.parse(settings.lastBackupAt) >= BACKUP_REMINDER_DAYS * DAY_MS
}
```

`src/storage/demo.ts`:

```ts
import { pendingInterest } from '../domain/interest'
import { addMonths, monthKey, monthStart } from '../domain/month'
import type { Child, MenuItem, MonthKey, Transaction, TxType } from '../domain/types'
import type { KidsPointsDB } from './db'
import { DEFAULT_MENU } from './defaults'
import { hashPin } from './pin'
import { DEFAULT_SETTINGS } from './repo'

export const DEMO_PIN = '0000'
export const DEMO_CHILD_IDS = ['demo-aoi', 'demo-sora']
const OFFSET_KEY = 'demoMonthOffset'

export async function getDemoOffset(db: KidsPointsDB): Promise<number> {
  const row = await db.kv.get(OFFSET_KEY)
  return typeof row?.value === 'number' ? row.value : 0
}

export async function setDemoOffset(db: KidsPointsDB, offset: number): Promise<void> {
  await db.kv.put({ key: OFFSET_KEY, value: offset })
}

export function demoClock(offset: number): () => Date {
  return () => addMonths(new Date(), offset)
}

// デモ用の子ども2人と、過去3ヶ月分の記録を作り直す。進めた月数もリセットする
export async function seedDemo(db: KidsPointsDB, now: Date): Promise<void> {
  const [aoi, sora] = DEMO_CHILD_IDS
  const children: Child[] = [
    { id: aoi, name: 'あおい', avatar: '🦊', color: '#ff8a5c', displayMode: 'older', order: 0 },
    { id: sora, name: 'そら', avatar: '🐰', color: '#5cb8ff', displayMode: 'young', order: 1 },
  ]
  const menuItems: MenuItem[] = DEFAULT_MENU.map((m, i) => ({ id: `demo-menu-${i}`, ...m, childIds: DEMO_CHILD_IDS, order: i }))

  const txs: Transaction[] = []
  let seq = 0
  const add = (childId: string, type: TxType, points: number, at: Date, extra: Partial<Transaction> = {}) => {
    seq += 1
    txs.push({ id: `demo-tx-${seq}`, childId, type, points, at: at.toISOString(), ...extra })
  }
  const thisMonth = monthKey(now)
  const months: MonthKey[] = [3, 2, 1].map((n) => monthKey(addMonths(monthStart(thisMonth), -n)))
  const day = (m: MonthKey, d: number) => {
    const s = monthStart(m)
    return new Date(s.getFullYear(), s.getMonth(), d, 18, 0)
  }

  add(aoi, 'opening', 30, day(months[0], 1))
  add(sora, 'opening', 10, day(months[0], 1))
  months.forEach((m, i) => {
    for (let d = 2; d <= 24; d += 3) {
      const item = DEFAULT_MENU[d % DEFAULT_MENU.length]
      add(aoi, 'stamp', item.points, day(m, d), { memo: item.label, icon: item.icon })
    }
    for (let d = 3; d <= 19; d += 4) {
      const item = DEFAULT_MENU[(d + 1) % DEFAULT_MENU.length]
      add(sora, 'stamp', item.points, day(m, d), { memo: item.label, icon: item.icon })
    }
    add(aoi, 'deposit', 10, day(m, 25))
    add(sora, 'deposit', 5, day(m, 25))
    if (i === 1) {
      add(aoi, 'spend', 5, day(m, 27), { memo: 'おかし' })
      add(sora, 'withdraw', 3, day(m, 27))
    }
  })
  let interestSeq = 0
  for (const c of children) {
    txs.push(...pendingInterest(txs, c.id, DEFAULT_SETTINGS.interestPercent, now, () => `demo-int-${++interestSeq}`))
  }

  await db.transaction('rw', [db.children, db.menuItems, db.transactions, db.kv], async () => {
    await Promise.all([db.children.clear(), db.menuItems.clear(), db.transactions.clear(), db.kv.clear()])
    await db.children.bulkPut(children)
    await db.menuItems.bulkPut(menuItems)
    await db.transactions.bulkPut(txs)
    await db.kv.bulkPut([
      { key: 'settings', value: { ...DEFAULT_SETTINGS, pinHash: hashPin(DEMO_PIN), lastBackupAt: now.toISOString() } },
      // 最初に開いたときは演出を出さず、「1ヶ月すすめる」で初めて出す
      { key: 'seen', value: { [aoi]: months[2], [sora]: months[2] } },
    ])
  })
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `npm test`
Expected: 全件 PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage
git commit -m "feat: バックアップの書き出し・読み込みとデモ用データを追加"
```

---

### Task 7: 画面の土台（ストア・PIN・はじめの設定）

**Files:**
- Create: `src/ui/app.css`、`src/ui/store.tsx`、`src/ui/sound.ts`、`src/ui/App.tsx`、`src/ui/Setup.tsx`、`src/ui/Top.tsx`、`src/ui/PinReset.tsx`、`src/ui/common/PinPad.tsx`、`src/ui/common/Overlay.tsx`、`src/ui/common/ChildForm.tsx`、`src/ui/common/HomeScreenGuide.tsx`
- Create（Task 8・9 で中身を作る仮のもの）: `src/ui/child/ChildHome.tsx`、`src/ui/parent/ParentHome.tsx`
- Modify: `src/main.tsx`
- Test: `src/ui/common/PinPad.test.tsx`、`src/ui/App.test.tsx`

**Interfaces:**
- Consumes: `Repo`、`Snapshot`、`KidsPointsDB`、`REAL_DB`、`DEMO_DB`、`seedDemo`、`getDemoOffset`、`setDemoOffset`、`demoClock`、`hashPin`、`parsePoints`、`newId`、`AVATARS`、`COLORS`、`DEFAULT_MENU`
- Produces:
  - `store.tsx`: `type Mode = 'real' | 'demo'`、`StoreProvider({ children, dbNames?, initialMode? })`、`useStore(): Store`（`repo`、`snap`、`mode`、`demoOffset`、`reload()`、`switchMode(mode)`、`advanceDemo()`、`resetDemo()`）
  - `sound.ts`: `playSound(kind: 'stamp' | 'coin' | 'fanfare', enabled: boolean): void`
  - `common/PinPad.tsx`: `PinPad({ title, onSubmit: (pin) => boolean, onCancel? })`
  - `common/Overlay.tsx`: `Overlay({ emoji, title, children?, onClose })`
  - `common/ChildForm.tsx`: `interface ChildDraft { name; avatar; color; displayMode; opening: string }`、`ChildForm({ label, value, onChange, showOpening })`
  - `common/HomeScreenGuide.tsx`: `HomeScreenGuide()`、`isStandalone(): boolean`
  - `App.tsx`: `App()`。画面は `top` / `child`（`childId`、`celebrateTxId?`）/ `pin` / `pinReset` / `parent`
  - 仮の `ChildHome({ childId, celebrateTxId?, onBack, onParent })`、`ParentHome({ onExit, onShowChild: (childId: string, celebrateTxId?: string) => void })`

- [ ] **Step 1: スタイルを書く**

`src/ui/app.css`:

```css
:root {
  --bg: #fff8ec;
  --surface: #ffffff;
  --text: #3b2f2a;
  --muted: #8a7a70;
  --primary: #ff8a5c;
  --primary-text: #ffffff;
  --danger: #e5484d;
  --ok: #2f7d4f;
  --line: #f0dfcc;
  --child-color: #ff8a5c;
  font-family: 'Hiragino Maru Gothic ProN', 'Hiragino Sans', system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
  -webkit-text-size-adjust: 100%;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; overscroll-behavior: none; }
input { -webkit-user-select: text; user-select: text; font: inherit; font-size: 20px; padding: 10px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--surface); color: var(--text); }
button { font: inherit; color: inherit; cursor: pointer; touch-action: manipulation; }
button:disabled { opacity: 0.4; cursor: default; }
h1, h2, h3 { line-height: 1.3; }

.screen { min-height: 100dvh; padding: 24px; padding-top: max(24px, env(safe-area-inset-top)); position: relative; }
.center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
.loading { padding: 40px; text-align: center; }
.row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 12px 0; }
.btn { border: 2px solid var(--line); background: var(--surface); border-radius: 14px; padding: 12px 20px; font-size: 18px; min-height: 52px; display: inline-flex; align-items: center; }
.btn.primary { background: var(--primary); border-color: var(--primary); color: var(--primary-text); }
.btn.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
.btn.small { min-height: 44px; padding: 8px 14px; }
.big-btn { border: none; background: var(--child-color); color: #fff; border-radius: 20px; font-size: 26px; font-weight: bold; padding: 16px 28px; min-height: 72px; min-width: 110px; box-shadow: 0 4px 0 rgba(0, 0, 0, 0.15); }
.big-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.15); }
.error { color: var(--danger); }
.message { color: var(--ok); }
.note, .hint { color: var(--muted); }
.card { background: var(--surface); border: 2px solid var(--line); border-radius: 18px; padding: 16px 20px; margin: 12px 0; }
.card label { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
.field-label { margin: 10px 0 6px; }
.choice-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.choice { width: 56px; height: 56px; font-size: 28px; border-radius: 14px; border: 3px solid transparent; background: var(--surface); }
.choice.on { border-color: var(--text); }
.choice.wide { width: auto; font-size: 18px; padding: 0 16px; border-color: var(--line); }
.choice.wide.on { border-color: var(--primary); background: #fff0e6; }
.choice.swatch { width: 48px; height: 48px; }

/* トップ */
.title { text-align: center; font-size: 40px; margin: 40px 0; }
.lock-btn { position: absolute; top: 16px; right: 16px; font-size: 28px; width: 56px; height: 56px; border-radius: 50%; border: none; background: transparent; opacity: 0.6; }
.lock-btn.static { position: static; }
.child-picker { display: flex; gap: 40px; justify-content: center; flex-wrap: wrap; }
.child-btn { border: none; border-radius: 40px; width: 280px; height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #fff; box-shadow: 0 8px 0 rgba(0, 0, 0, 0.15); }
.child-avatar { font-size: 140px; line-height: 1; }
.child-avatar.small { font-size: 40px; margin-right: 8px; }
.child-name { font-size: 36px; font-weight: bold; }

/* PIN */
.pin-dots { display: flex; gap: 16px; }
.dot { width: 22px; height: 22px; border-radius: 50%; border: 3px solid var(--text); }
.dot.on { background: var(--text); }
.pin-grid { display: grid; grid-template-columns: repeat(3, 88px); gap: 14px; }
.pin-key { height: 88px; border-radius: 50%; border: 2px solid var(--line); background: var(--surface); font-size: 32px; }
.pin-key.small { font-size: 18px; }
.shake { animation: shake 0.4s; }
.question { font-size: 40px; font-weight: bold; }
.num-input { width: 140px; }

/* 子どもホーム */
.child-header { display: flex; align-items: center; justify-content: space-between; }
.child-header h1 { display: flex; align-items: center; margin: 0; font-size: 32px; }
.child-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px; margin-top: 16px; }
@media (orientation: portrait) { .child-grid { grid-template-columns: 1fr; } }
.stamp-card { background: var(--surface); border: 4px solid var(--child-color); border-radius: 24px; padding: 16px; }
.card-head { display: flex; justify-content: space-between; align-items: center; font-size: 20px; margin-bottom: 12px; }
.stamp-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
.stamp-cell { aspect-ratio: 1; border-radius: 50%; border: 3px dashed var(--line); display: flex; align-items: center; justify-content: center; color: var(--line); font-size: 18px; }
.stamp-cell.filled { border: 3px solid var(--child-color); background: #fff3ea; font-size: 40px; color: inherit; }
.pockets { display: grid; gap: 16px; }
.pocket { background: var(--surface); border-radius: 20px; padding: 16px; border: 2px solid var(--line); }
.pocket h2 { margin: 0 0 8px; font-size: 24px; }
.amount { font-size: 36px; font-weight: bold; margin: 0; }
.amount small { font-size: 18px; color: var(--muted); }
.coins { display: flex; flex-wrap: wrap; gap: 4px; font-size: 32px; }
.coins .more { font-size: 24px; align-self: center; }
.coins .empty { font-size: 20px; color: var(--muted); }
.deposit h2 { font-size: 24px; margin: 16px 0 0; }

/* 演出 */
.overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); display: flex; align-items: center; justify-content: center; z-index: 10; }
.overlay-card { background: var(--surface); border-radius: 32px; padding: 32px 48px; text-align: center; min-width: 360px; }
.overlay-emoji { font-size: 96px; }
.big-number { font-size: 64px; font-weight: bold; color: var(--primary); margin: 0; }
.pop { animation: stamp-pop 0.6s cubic-bezier(0.2, 1.6, 0.4, 1); }

/* 親メニュー */
.parent-header { display: flex; justify-content: space-between; align-items: center; }
.tabs { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
.tab { border: 2px solid var(--line); background: var(--surface); border-radius: 999px; padding: 10px 18px; font-size: 18px; }
.tab.on { background: var(--text); color: #fff; border-color: var(--text); }
.banner { background: #fff3c4; border-radius: 12px; padding: 12px 16px; }
.menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.menu-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px; border-radius: 18px; border: 2px solid var(--line); background: var(--surface); font-size: 18px; }
.menu-icon { font-size: 44px; }
.menu-list { list-style: none; padding: 0; }
.menu-list li { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--line); }
.demo-badge { position: fixed; bottom: 12px; left: 12px; background: #3b2f2a; color: #fff; padding: 6px 12px; border-radius: 999px; font-size: 14px; z-index: 20; }

@keyframes stamp-pop { 0% { transform: scale(2.2) rotate(-20deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
@media (prefers-reduced-motion: reduce) { .pop, .shake { animation: none; } }
```

- [ ] **Step 2: ストアと効果音を書く**

`src/ui/sound.ts`:

```ts
type SoundKind = 'stamp' | 'coin' | 'fanfare'

const NOTES: Record<SoundKind, number[]> = {
  stamp: [660, 880],
  coin: [988, 1319],
  fanfare: [523, 659, 784, 1047],
}

let ctx: AudioContext | null = null

export function playSound(kind: SoundKind, enabled: boolean): void {
  if (!enabled) return
  try {
    const ac = (ctx ??= new AudioContext())
    const start = ac.currentTime
    NOTES[kind].forEach((freq, i) => {
      const t = start + i * 0.12
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.connect(gain).connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.3)
    })
  } catch {
    // 音が出せない環境（テストなど）では何もしない
  }
}
```

`src/ui/store.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { DEMO_DB, KidsPointsDB, REAL_DB } from '../storage/db'
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
    await repo.settle()
    return { repo, snap: await repo.snapshot(), mode, demoOffset: 0 }
  }
  const db = new KidsPointsDB(names.demo)
  if ((await db.children.count()) === 0) await seedDemo(db, new Date())
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
```

- [ ] **Step 3: PinPad の失敗するテストを書く**

`src/ui/common/PinPad.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PinPad } from './PinPad'

describe('PinPad', () => {
  it('4けた入れると onSubmit を呼び、false ならエラーを出して消す', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => false)
    render(<PinPad title="PIN" onSubmit={onSubmit} />)
    for (const d of '1234') await user.click(screen.getByRole('button', { name: d }))
    expect(onSubmit).toHaveBeenCalledWith('1234')
    expect(screen.getByText('ちがうよ')).toBeInTheDocument()
    expect(screen.getByLabelText('0けた にゅうりょくずみ')).toBeInTheDocument()
  })

  it('けす ボタンで1けた戻せる', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => true)
    render(<PinPad title="PIN" onSubmit={onSubmit} />)
    for (const d of '129') await user.click(screen.getByRole('button', { name: d }))
    await user.click(screen.getByRole('button', { name: 'けす' }))
    await user.click(screen.getByRole('button', { name: '3' }))
    await user.click(screen.getByRole('button', { name: '4' }))
    expect(onSubmit).toHaveBeenCalledWith('1234')
  })
})
```

- [ ] **Step 4: 失敗を確認する**

Run: `npm test -- src/ui/common`
Expected: FAIL（`./PinPad` が見つからない）

- [ ] **Step 5: 共通部品を書く**

`src/ui/common/PinPad.tsx`:

```tsx
import { useState } from 'react'

export function PinPad({
  title,
  onSubmit,
  onCancel,
}: {
  title: string
  onSubmit: (pin: string) => boolean
  onCancel?: () => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const press = (digit: string) => {
    if (pin.length >= 4) return
    const next = pin + digit
    setError(false)
    if (next.length < 4) {
      setPin(next)
      return
    }
    setPin('')
    if (!onSubmit(next)) setError(true)
  }

  return (
    <div className="screen center">
      <h2>{title}</h2>
      <div className={error ? 'pin-dots shake' : 'pin-dots'} aria-label={`${pin.length}けた にゅうりょくずみ`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? 'dot on' : 'dot'} />
        ))}
      </div>
      {error && <p className="error">ちがうよ</p>}
      <div className="pin-grid">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="pin-key" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button className="pin-key" aria-label="けす" onClick={() => setPin(pin.slice(0, -1))}>
          ⌫
        </button>
        <button className="pin-key" onClick={() => press('0')}>
          0
        </button>
        {onCancel ? (
          <button className="pin-key small" onClick={onCancel}>
            もどる
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  )
}
```

`src/ui/common/Overlay.tsx`:

```tsx
import type { ReactNode } from 'react'

export function Overlay({
  emoji,
  title,
  children,
  onClose,
}: {
  emoji: string
  title: string
  children?: ReactNode
  onClose: () => void
}) {
  return (
    <div className="overlay" role="dialog" aria-label={title} onClick={onClose}>
      <div className="overlay-card pop">
        <div className="overlay-emoji">{emoji}</div>
        <h2>{title}</h2>
        {children}
        <button className="big-btn" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  )
}
```

`src/ui/common/ChildForm.tsx`:

```tsx
import type { DisplayMode } from '../../domain/types'
import { AVATARS, COLORS } from '../../storage/defaults'

export interface ChildDraft {
  name: string
  avatar: string
  color: string
  displayMode: DisplayMode
  opening: string
}

export function ChildForm({
  label,
  value,
  onChange,
  showOpening,
}: {
  label: string
  value: ChildDraft
  onChange: (next: ChildDraft) => void
  showOpening: boolean
}) {
  const set = (patch: Partial<ChildDraft>) => onChange({ ...value, ...patch })
  return (
    <fieldset className="card">
      <legend>{label}</legend>
      <label>
        なまえ（ニックネーム）
        <input value={value.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <div className="field-label">アバター</div>
      <div className="choice-row">
        {AVATARS.map((a) => (
          <button type="button" key={a} className={a === value.avatar ? 'choice on' : 'choice'} onClick={() => set({ avatar: a })}>
            {a}
          </button>
        ))}
      </div>
      <div className="field-label">いろ</div>
      <div className="choice-row">
        {COLORS.map((c) => (
          <button
            type="button"
            key={c}
            aria-label={`いろ ${c}`}
            className={c === value.color ? 'choice swatch on' : 'choice swatch'}
            style={{ background: c }}
            onClick={() => set({ color: c })}
          />
        ))}
      </div>
      <div className="field-label">ひょうじ</div>
      <div className="choice-row">
        <button type="button" className={value.displayMode === 'young' ? 'choice wide on' : 'choice wide'} onClick={() => set({ displayMode: 'young' })}>
          おさない（アイコン中心）
        </button>
        <button type="button" className={value.displayMode === 'older' ? 'choice wide on' : 'choice wide'} onClick={() => set({ displayMode: 'older' })}>
          おおきい（数字も表示）
        </button>
      </div>
      {showOpening && (
        <label>
          いま貯まっているポイント
          <input inputMode="numeric" value={value.opening} onChange={(e) => set({ opening: e.target.value })} />
        </label>
      )}
    </fieldset>
  )
}
```

`src/ui/common/HomeScreenGuide.tsx`:

```tsx
export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

export function HomeScreenGuide() {
  if (isStandalone()) return <p>ホーム画面から起動しています。このまま使ってください。</p>
  return (
    <div className="card">
      <h3>ホーム画面に追加してください</h3>
      <ol>
        <li>Safari の共有ボタン（四角から矢印が出ているアイコン）をタップ</li>
        <li>「ホーム画面に追加」を選ぶ</li>
        <li>ホーム画面にできたアイコンから開く</li>
      </ol>
      <p className="note">ホーム画面に追加しないと、しばらく使わないあいだにデータが消えることがあります。</p>
    </div>
  )
}
```

- [ ] **Step 6: PinPad のテストが通ることを確認する**

Run: `npm test -- src/ui/common`
Expected: PASS

- [ ] **Step 7: App のはじめの設定の失敗するテストを書く**

`src/ui/App.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { newId } from '../storage/ids'
import { App } from './App'
import { StoreProvider } from './store'

export function renderApp() {
  const id = newId()
  return render(
    <StoreProvider dbNames={{ real: `real-${id}`, demo: `demo-${id}` }} initialMode="real">
      <App />
    </StoreProvider>,
  )
}

export async function typePin(user: ReturnType<typeof userEvent.setup>, pin: string) {
  for (const d of pin) await user.click(screen.getByRole('button', { name: d }))
}

export async function setUp(user: ReturnType<typeof userEvent.setup>) {
  renderApp()
  await screen.findByText('おやの PIN をきめてください（4けた）')
  await typePin(user, '1234')
  await screen.findByText('もういちど入れてください')
  await typePin(user, '1234')
  const names = await screen.findAllByLabelText('なまえ（ニックネーム）')
  await user.type(names[0], 'あおい')
  await user.type(names[1], 'そら')
  await user.type(screen.getAllByLabelText('いま貯まっているポイント')[0], '30')
  await user.click(screen.getByRole('button', { name: 'つぎへ' }))
  await user.click(await screen.findByRole('button', { name: 'はじめる' }))
}

it('はじめの設定を終えるとトップに2人が並ぶ', async () => {
  const user = userEvent.setup()
  await setUp(user)
  expect(await screen.findByRole('button', { name: /あおい/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /そら/ })).toBeInTheDocument()
})

it('なまえが空なら先に進めない', async () => {
  const user = userEvent.setup()
  renderApp()
  await screen.findByText('おやの PIN をきめてください（4けた）')
  await typePin(user, '1234')
  await screen.findByText('もういちど入れてください')
  await typePin(user, '1234')
  await user.click(await screen.findByRole('button', { name: 'つぎへ' }))
  expect(screen.getByText('なまえを入れてください')).toBeInTheDocument()
})
```

- [ ] **Step 8: 失敗を確認する**

Run: `npm test -- src/ui/App`
Expected: FAIL（`./App` が見つからない）

- [ ] **Step 9: 画面を書く**

`src/ui/Setup.tsx`:

```tsx
import { useState } from 'react'
import { parsePoints } from '../domain/validate'
import { AVATARS, COLORS, DEFAULT_MENU } from '../storage/defaults'
import { newId } from '../storage/ids'
import { ChildForm, type ChildDraft } from './common/ChildForm'
import { HomeScreenGuide } from './common/HomeScreenGuide'
import { PinPad } from './common/PinPad'
import { useStore } from './store'

type Step = 'pin' | 'pinConfirm' | 'children' | 'guide'

const INITIAL: ChildDraft[] = [
  { name: '', avatar: AVATARS[3], color: COLORS[0], displayMode: 'older', opening: '' },
  { name: '', avatar: AVATARS[2], color: COLORS[1], displayMode: 'young', opening: '' },
]

function openingError(text: string): boolean {
  const t = text.trim()
  return t !== '' && t !== '0' && parsePoints(t) === null
}

export function Setup() {
  const { repo, reload } = useStore()
  const [step, setStep] = useState<Step>('pin')
  const [pin, setPin] = useState('')
  const [drafts, setDrafts] = useState(INITIAL)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const next = () => {
    if (drafts.some((d) => !d.name.trim())) return setError('なまえを入れてください')
    if (drafts.some((d) => openingError(d.opening))) return setError('いま貯まっているポイントは 0 以上の整数で入れてください')
    setError('')
    setStep('guide')
  }

  const finish = async () => {
    setSaving(true)
    const ids = drafts.map(() => newId())
    for (const [i, d] of drafts.entries()) {
      await repo.saveChild({ id: ids[i], name: d.name.trim(), avatar: d.avatar, color: d.color, displayMode: d.displayMode, order: i })
    }
    for (const [i, m] of DEFAULT_MENU.entries()) {
      await repo.saveMenuItem({ id: newId(), ...m, childIds: ids, order: i })
    }
    for (const [i, d] of drafts.entries()) {
      const points = parsePoints(d.opening)
      if (points !== null) await repo.addTx({ childId: ids[i], type: 'opening', points })
    }
    // PIN があることを「設定ずみ」の印にしているので、最後に保存する
    await repo.setPin(pin)
    await reload()
  }

  if (step === 'pin') {
    return (
      <PinPad
        title="おやの PIN をきめてください（4けた）"
        onSubmit={(p) => {
          setPin(p)
          setStep('pinConfirm')
          return true
        }}
      />
    )
  }
  if (step === 'pinConfirm') {
    return (
      <PinPad
        title="もういちど入れてください"
        onSubmit={(p) => {
          if (p !== pin) return false
          setStep('children')
          return true
        }}
        onCancel={() => setStep('pin')}
      />
    )
  }
  return (
    <div className="screen">
      <h1>はじめの せってい</h1>
      {step === 'children' ? (
        <>
          {drafts.map((d, i) => (
            <ChildForm
              key={i}
              label={i === 0 ? '1人め' : '2人め'}
              value={d}
              showOpening
              onChange={(v) => setDrafts(drafts.map((x, j) => (j === i ? v : x)))}
            />
          ))}
          {error && <p className="error">{error}</p>}
          <button className="btn primary" onClick={next}>
            つぎへ
          </button>
        </>
      ) : (
        <>
          <HomeScreenGuide />
          <div className="row">
            <button className="btn" onClick={() => setStep('children')}>
              もどる
            </button>
            <button className="btn primary" disabled={saving} onClick={() => void finish()}>
              はじめる
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

`src/ui/Top.tsx`:

```tsx
import { useRef } from 'react'
import { useStore } from './store'

const LONG_PRESS_MS = 1500

export function Top({
  onSelectChild,
  onParent,
  onPinReset,
}: {
  onSelectChild: (childId: string) => void
  onParent: () => void
  onPinReset: () => void
}) {
  const { snap } = useStore()
  const timer = useRef<number | undefined>(undefined)
  const longPressed = useRef(false)

  const startPress = () => {
    longPressed.current = false
    timer.current = window.setTimeout(() => {
      longPressed.current = true
      onPinReset()
    }, LONG_PRESS_MS)
  }
  const endPress = () => window.clearTimeout(timer.current)

  return (
    <div className="screen">
      <button
        className="lock-btn"
        aria-label="おやのメニュー"
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onClick={() => {
          if (!longPressed.current) onParent()
        }}
      >
        🔒
      </button>
      <h1 className="title">だれの ページ？</h1>
      <div className="child-picker">
        {snap.children.map((c) => (
          <button key={c.id} className="child-btn" style={{ background: c.color }} onClick={() => onSelectChild(c.id)}>
            <span className="child-avatar">{c.avatar}</span>
            <span className="child-name">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

`src/ui/PinReset.tsx`:

```tsx
import { useState } from 'react'
import { parsePoints } from '../domain/validate'
import { PinPad } from './common/PinPad'
import { useStore } from './store'

const twoDigit = () => 10 + Math.floor(Math.random() * 90)

export function PinReset({ onDone }: { onDone: () => void }) {
  const { repo, reload } = useStore()
  const [question] = useState(() => ({ a: twoDigit(), b: twoDigit() }))
  const [answer, setAnswer] = useState('')
  const [passed, setPassed] = useState(false)
  const [error, setError] = useState(false)

  if (passed) {
    return (
      <PinPad
        title="あたらしい PIN（4けた）"
        onSubmit={(pin) => {
          void repo.setPin(pin).then(reload).then(onDone)
          return true
        }}
        onCancel={onDone}
      />
    )
  }
  return (
    <div className="screen center">
      <h2>PIN の再設定</h2>
      <p>おとなの人が答えてください</p>
      <p className="question">
        {question.a} + {question.b} = ?
      </p>
      <input className="num-input" inputMode="numeric" aria-label="こたえ" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      {error && <p className="error">ちがいます</p>}
      <div className="row">
        <button className="btn" onClick={onDone}>
          もどる
        </button>
        <button
          className="btn primary"
          onClick={() => {
            if (parsePoints(answer) === question.a + question.b) setPassed(true)
            else setError(true)
          }}
        >
          つぎへ
        </button>
      </div>
    </div>
  )
}
```

`src/ui/child/ChildHome.tsx`（仮。Task 8 で置き換える）:

```tsx
export function ChildHome({
  childId,
  onBack,
}: {
  childId: string
  celebrateTxId?: string
  onBack: () => void
  onParent: () => void
}) {
  return (
    <div className="screen">
      <button className="btn" onClick={onBack}>
        ◀ もどる
      </button>
      <p>{childId}</p>
    </div>
  )
}
```

`src/ui/parent/ParentHome.tsx`（仮。Task 9 で置き換える）:

```tsx
export function ParentHome({
  onExit,
}: {
  onExit: () => void
  onShowChild: (childId: string, celebrateTxId?: string) => void
}) {
  return (
    <div className="screen">
      <button className="btn" onClick={onExit}>
        🔒 とじる
      </button>
    </div>
  )
}
```

`src/ui/App.tsx`:

```tsx
import { useState } from 'react'
import { hashPin } from '../storage/pin'
import { ChildHome } from './child/ChildHome'
import { PinPad } from './common/PinPad'
import { ParentHome } from './parent/ParentHome'
import { PinReset } from './PinReset'
import { Setup } from './Setup'
import { useStore } from './store'
import { Top } from './Top'

type Screen =
  | { name: 'top' }
  | { name: 'child'; childId: string; celebrateTxId?: string }
  | { name: 'pin' }
  | { name: 'pinReset' }
  | { name: 'parent' }

// 親メニューを閉じずに子どもの画面へ移ったとき、PIN を入れ直さずに戻れる時間
const UNLOCK_MS = 5 * 60 * 1000

export function App() {
  const { snap, mode } = useStore()
  const [screen, setScreen] = useState<Screen>({ name: 'top' })
  const [unlockedUntil, setUnlockedUntil] = useState(0)

  if (!snap.settings.pinHash) return <Setup />

  const openParent = () => setScreen(Date.now() < unlockedUntil ? { name: 'parent' } : { name: 'pin' })
  const goTop = () => setScreen({ name: 'top' })

  return (
    <>
      {mode === 'demo' && <div className="demo-badge">デモ（PIN 0000）</div>}
      {screen.name === 'top' && (
        <Top
          onSelectChild={(childId) => setScreen({ name: 'child', childId })}
          onParent={openParent}
          onPinReset={() => setScreen({ name: 'pinReset' })}
        />
      )}
      {screen.name === 'child' && (
        <ChildHome
          key={`${screen.childId}-${screen.celebrateTxId ?? ''}`}
          childId={screen.childId}
          celebrateTxId={screen.celebrateTxId}
          onBack={goTop}
          onParent={openParent}
        />
      )}
      {screen.name === 'pin' && (
        <PinPad
          title="おやの PIN"
          onCancel={goTop}
          onSubmit={(pin) => {
            if (hashPin(pin) !== snap.settings.pinHash) return false
            setUnlockedUntil(Date.now() + UNLOCK_MS)
            setScreen({ name: 'parent' })
            return true
          }}
        />
      )}
      {screen.name === 'pinReset' && <PinReset onDone={goTop} />}
      {screen.name === 'parent' && (
        <ParentHome
          onExit={() => {
            setUnlockedUntil(0)
            goTop()
          }}
          onShowChild={(childId, celebrateTxId) => setScreen({ name: 'child', childId, celebrateTxId })}
        />
      )}
    </>
  )
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { StoreProvider } from './ui/store'
import './ui/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
```

- [ ] **Step 10: 通ることを確認する**

Run: `npm test && npm run build`
Expected: 全件 PASS、ビルド成功

- [ ] **Step 11: ブラウザで確認する**

Run: `npm run dev` を起動し、表示されたURLを開く。PIN設定 → 2人の登録 → 「はじめる」でトップに2人が並び、鍵アイコン → PIN入力で仮の親メニューが出ることを見る。鍵アイコンを1.5秒長押しすると、足し算の画面が出ることも見る。

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: ストア、PIN、はじめの設定、トップ画面を追加"
```

---

### Task 8: 子どもの画面

**Files:**
- Create: `src/ui/child/StampCard.tsx`、`src/ui/child/Pockets.tsx`、`src/ui/child/DepositPanel.tsx`
- Modify: `src/ui/child/ChildHome.tsx`（仮のものを置き換える）
- Test: `src/ui/child/DepositPanel.test.tsx`、`src/ui/child/ChildHome.test.tsx`

**Interfaces:**
- Consumes: `useStore`、`balancesOf`、`stampCards`、`isCardCompletedBy`、`CARD_SIZE`、`monthOutcome`、`projectedInterest`、`monthKey`、`prevMonth`、`parsePoints`、`Overlay`、`playSound`
- Produces:
  - `StampCard({ cards: Transaction[][]; highlightId?: string })`（マスの aria-label は「スタンプ」または「あき」）
  - `Pockets({ balances, mode, projected, percent })`
  - `DepositPanel({ wallet: number; mode: DisplayMode; onDeposit: (points: number) => Promise<void> })`
  - `ChildHome({ childId, celebrateTxId?, onBack, onParent })`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/child/DepositPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DepositPanel } from './DepositPanel'

describe('DepositPanel', () => {
  it('連打しても1回だけ預け入れる', async () => {
    let resolve: () => void = () => {}
    const onDeposit = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    render(<DepositPanel wallet={10} mode="young" onDeposit={onDeposit} />)
    const all = screen.getByRole('button', { name: 'ぜんぶ' })
    fireEvent.click(all)
    fireEvent.click(all)
    expect(onDeposit).toHaveBeenCalledTimes(1)
    expect(onDeposit).toHaveBeenCalledWith(10)
    await act(async () => resolve())
  })

  it('おさいふより多いボタンは押せない', () => {
    render(<DepositPanel wallet={3} mode="young" onDeposit={vi.fn(async () => {})} />)
    expect(screen.getByRole('button', { name: '1こ' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '5こ' })).toBeDisabled()
  })

  it('おさないモードには数字の入力欄がなく、おおきいモードにはある', () => {
    const { unmount } = render(<DepositPanel wallet={3} mode="young" onDeposit={vi.fn(async () => {})} />)
    expect(screen.queryByLabelText('ちょきんする ポイント')).toBeNull()
    unmount()
    render(<DepositPanel wallet={3} mode="older" onDeposit={vi.fn(async () => {})} />)
    expect(screen.getByLabelText('ちょきんする ポイント')).toBeInTheDocument()
  })

  it('失敗したらメッセージを出し、また押せるようになる', async () => {
    const onDeposit = vi.fn(async () => {
      throw new Error('x')
    })
    render(<DepositPanel wallet={3} mode="young" onDeposit={onDeposit} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '1こ' })))
    expect(screen.getByText('ちょきん できなかったよ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1こ' })).toBeEnabled()
  })
})
```

`src/ui/child/ChildHome.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { KidsPointsDB } from '../../storage/db'
import { newId } from '../../storage/ids'
import { Repo } from '../../storage/repo'
import { StoreProvider } from '../store'
import { ChildHome } from './ChildHome'

async function seed(name: string) {
  const repo = new Repo(new KidsPointsDB(name), () => new Date())
  await repo.saveChild({ id: 'c1', name: 'そら', avatar: '🐰', color: '#5cb8ff', displayMode: 'young', order: 0 })
  await repo.setPin('1234')
  await repo.addTx({ childId: 'c1', type: 'opening', points: 6 })
  await repo.addTx({ childId: 'c1', type: 'stamp', points: 1, icon: '🪥' })
  repo.db.close()
}

it('スタンプとコインを表示し、ちょきんするとちょきんばこに移る', async () => {
  const name = `real-${newId()}`
  await seed(name)
  const user = userEvent.setup()
  render(
    <StoreProvider dbNames={{ real: name, demo: `demo-${newId()}` }} initialMode="real">
      <ChildHome childId="c1" onBack={() => {}} onParent={() => {}} />
    </StoreProvider>,
  )
  expect(await screen.findAllByLabelText('スタンプ')).toHaveLength(1)
  expect(screen.getAllByLabelText('あき')).toHaveLength(19)
  expect(screen.getByLabelText('おさいふ コイン 7こ')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '5こ' }))
  expect(await screen.findByLabelText('ちょきんばこ コイン 5こ')).toBeInTheDocument()
  expect(screen.getByLabelText('おさいふ コイン 2こ')).toBeInTheDocument()
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/ui/child`
Expected: FAIL（`./DepositPanel` が見つからない、ChildHome が仮のもの）

- [ ] **Step 3: 実装する**

`src/ui/child/StampCard.tsx`:

```tsx
import { useState } from 'react'
import { CARD_SIZE } from '../../domain/stampcard'
import type { Transaction } from '../../domain/types'

export function StampCard({ cards, highlightId }: { cards: Transaction[][]; highlightId?: string }) {
  const found = highlightId ? cards.findIndex((c) => c.some((t) => t.id === highlightId)) : -1
  const [index, setIndex] = useState(found >= 0 ? found : cards.length - 1)
  const shown = Math.min(index, cards.length - 1)
  const card = cards[shown]

  return (
    <section className="stamp-card" aria-label="スタンプカード">
      <div className="card-head">
        <button className="btn small" aria-label="まえの カード" disabled={shown === 0} onClick={() => setIndex(shown - 1)}>
          ◀
        </button>
        <span>{shown + 1}まいめ</span>
        <button className="btn small" aria-label="つぎの カード" disabled={shown >= cards.length - 1} onClick={() => setIndex(shown + 1)}>
          ▶
        </button>
      </div>
      <div className="stamp-grid">
        {Array.from({ length: CARD_SIZE }, (_, i) => {
          const t = card[i]
          const className = ['stamp-cell', t ? 'filled' : '', t && t.id === highlightId ? 'pop' : ''].filter(Boolean).join(' ')
          return (
            <div key={i} className={className} aria-label={t ? 'スタンプ' : 'あき'} title={t?.memo}>
              {t ? (t.icon ?? '⭐') : i + 1}
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

`src/ui/child/Pockets.tsx`:

```tsx
import type { Balances, DisplayMode } from '../../domain/types'

const COIN_LIMIT = 20

function Coins({ label, count }: { label: string; count: number }) {
  const shown = Math.min(count, COIN_LIMIT)
  return (
    <div className="coins" aria-label={`${label} コイン ${count}こ`}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i}>🪙</span>
      ))}
      {count > COIN_LIMIT && <span className="more">+{count - COIN_LIMIT}</span>}
      {count === 0 && <span className="empty">からっぽ</span>}
    </div>
  )
}

function Amount({ points }: { points: number }) {
  return (
    <p className="amount">
      {points}pt <small>（{(points * 10).toLocaleString('ja-JP')}円）</small>
    </p>
  )
}

export function Pockets({
  balances,
  mode,
  projected,
  percent,
}: {
  balances: Balances
  mode: DisplayMode
  projected: { savings: number; points: number; blocked: boolean }
  percent: number
}) {
  return (
    <div className="pockets">
      <div className="pocket">
        <h2>👛 おさいふ</h2>
        {mode === 'young' ? <Coins label="おさいふ" count={balances.wallet} /> : <Amount points={balances.wallet} />}
      </div>
      <div className="pocket">
        <h2>🐷 ちょきんばこ</h2>
        {mode === 'young' ? (
          <Coins label="ちょきんばこ" count={balances.savings} />
        ) : (
          <>
            <Amount points={balances.savings} />
            {projected.blocked ? (
              <p className="hint">こんげつは ひきだしたので、りそくは おやすみ</p>
            ) : projected.points > 0 ? (
              <p className="hint">
                らいげつの りそく みこみ：{projected.savings}pt × {percent}% → {projected.points}pt
              </p>
            ) : (
              <p className="hint">ちょきんすると、まいつき {percent}% ふえるよ</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

`src/ui/child/DepositPanel.tsx`:

```tsx
import { useRef, useState } from 'react'
import type { DisplayMode } from '../../domain/types'
import { parsePoints } from '../../domain/validate'

export function DepositPanel({
  wallet,
  mode,
  onDeposit,
}: {
  wallet: number
  mode: DisplayMode
  onDeposit: (points: number) => Promise<void>
}) {
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [message, setMessage] = useState('')
  const typed = parsePoints(input)

  const run = async (points: number) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      await onDeposit(points)
      setInput('')
    } catch {
      setMessage('ちょきん できなかったよ')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <section className="deposit">
      <h2>ちょきんする</h2>
      <div className="row">
        {[1, 5].map((n) => (
          <button key={n} className="big-btn" disabled={busy || wallet < n} onClick={() => void run(n)}>
            {n}こ
          </button>
        ))}
        <button className="big-btn" disabled={busy || wallet < 1} onClick={() => void run(wallet)}>
          ぜんぶ
        </button>
      </div>
      {mode === 'older' && (
        <div className="row">
          <input className="num-input" inputMode="numeric" aria-label="ちょきんする ポイント" value={input} onChange={(e) => setInput(e.target.value)} />
          <button
            className="btn primary"
            disabled={busy || typed === null || typed > wallet}
            onClick={() => {
              if (typed !== null) void run(typed)
            }}
          >
            ちょきん
          </button>
        </div>
      )}
      {message && <p className="error">{message}</p>}
    </section>
  )
}
```

`src/ui/child/ChildHome.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { balancesOf } from '../../domain/balance'
import { monthOutcome, projectedInterest, type MonthOutcome } from '../../domain/interest'
import { monthKey, prevMonth } from '../../domain/month'
import { isCardCompletedBy, stampCards } from '../../domain/stampcard'
import { Overlay } from '../common/Overlay'
import { playSound } from '../sound'
import { useStore } from '../store'
import { DepositPanel } from './DepositPanel'
import { Pockets } from './Pockets'
import { StampCard } from './StampCard'

export function ChildHome({
  childId,
  celebrateTxId,
  onBack,
  onParent,
}: {
  childId: string
  celebrateTxId?: string
  onBack: () => void
  onParent: () => void
}) {
  const { repo, snap, reload } = useStore()
  const txs = snap.transactions
  const child = snap.children.find((c) => c.id === childId)
  const cards = useMemo(() => stampCards(txs, childId), [txs, childId])
  const now = repo.now()
  const lastMonth = prevMonth(monthKey(now))
  const [celebrate, setCelebrate] = useState<'stamp' | 'complete' | null>(() =>
    celebrateTxId ? (isCardCompletedBy(cards, celebrateTxId) ? 'complete' : 'stamp') : null,
  )
  const [outcome, setOutcome] = useState<MonthOutcome | null>(null)
  const outcomeChecked = useRef(false)
  const soundOn = snap.settings.soundOn

  useEffect(() => {
    if (celebrate) playSound(celebrate === 'complete' ? 'fanfare' : 'stamp', soundOn)
    // 開いたときに1回だけ鳴らす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 月が変わって初めて開いたときに、前月の結果（利息 or おやすみ）を見せる
  useEffect(() => {
    if (outcomeChecked.current || celebrateTxId) return
    outcomeChecked.current = true
    if (snap.seen[childId] === lastMonth) return
    const result = monthOutcome(txs, childId, lastMonth)
    if (result.kind !== 'none') {
      setOutcome(result)
      playSound(result.kind === 'interest' ? 'coin' : 'stamp', soundOn)
    }
    void repo.markSeen(childId, lastMonth).then(reload)
  }, [celebrateTxId, childId, lastMonth, reload, repo, snap.seen, soundOn, txs])

  if (!child) {
    return (
      <div className="screen">
        <button className="btn" onClick={onBack}>
          ◀ もどる
        </button>
      </div>
    )
  }

  const balances = balancesOf(txs, childId)
  const projected = projectedInterest(txs, childId, snap.settings.interestPercent, now)
  const deposit = async (points: number) => {
    await repo.addTx({ childId, type: 'deposit', points })
    playSound('coin', soundOn)
    await reload()
  }

  return (
    <div className="screen" style={{ '--child-color': child.color } as CSSProperties}>
      <header className="child-header">
        <button className="btn" onClick={onBack}>
          ◀ もどる
        </button>
        <h1>
          <span className="child-avatar small">{child.avatar}</span>
          {child.name}
        </h1>
        <button className="lock-btn static" aria-label="おやのメニュー" onClick={onParent}>
          🔒
        </button>
      </header>
      <div className="child-grid">
        <StampCard cards={cards} highlightId={celebrate ? celebrateTxId : undefined} />
        <div>
          <Pockets balances={balances} mode={child.displayMode} projected={projected} percent={snap.settings.interestPercent} />
          <DepositPanel wallet={balances.wallet} mode={child.displayMode} onDeposit={deposit} />
        </div>
      </div>
      {celebrate === 'complete' && (
        <Overlay emoji="🏆" title="カード コンプリート！" onClose={() => setCelebrate(null)}>
          <p>20こ あつめたよ！ つぎの カードに すすむよ</p>
        </Overlay>
      )}
      {outcome?.kind === 'interest' && (
        <Overlay emoji="🐷✨" title="ふえたよ！" onClose={() => setOutcome(null)}>
          <p className="big-number">+{outcome.points}pt</p>
          <p>ちょきんばこに りそくが ついたよ</p>
        </Overlay>
      )}
      {outcome?.kind === 'rest' && (
        <Overlay emoji="😴" title="こんげつは おやすみ" onClose={() => setOutcome(null)}>
          <p>ひきだしたから、りそくは つかなかったよ</p>
        </Overlay>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `npm test`
Expected: 全件 PASS

- [ ] **Step 5: ブラウザで確認する**

`npm run dev` で開き、子どもを選んで、スタンプカード・おさいふ・ちょきんばこが出ることを見る。2人の表示モード（おさない／おおきい）で見た目が変わること、「ちょきんする」で残高が移ることを見る。

- [ ] **Step 6: Commit**

```bash
git add src/ui/child
git commit -m "feat: 子どもの画面（スタンプカード、おさいふ、ちょきんばこ）を追加"
```

---

### Task 9: 親メニュー（スタンプ・つかう・ひきだす・とりけし・せってい）

**Files:**
- Create: `src/ui/parent/StampTab.tsx`、`src/ui/parent/MoneyTab.tsx`、`src/ui/parent/UndoTab.tsx`、`src/ui/parent/DemoTab.tsx`（仮。Task 10 で中身を作る）、`src/ui/parent/settings/SettingsTab.tsx`、`src/ui/parent/settings/ChildrenSettings.tsx`、`src/ui/parent/settings/MenuSettings.tsx`、`src/ui/parent/settings/GeneralSettings.tsx`、`src/ui/parent/settings/BackupSettings.tsx`
- Modify: `src/ui/parent/ParentHome.tsx`（仮のものを置き換える）、`src/ui/App.test.tsx`（テスト追加）

**Interfaces:**
- Consumes: `useStore`、`OpFailed`、`describeTx`、`balancesOf`、`parsePoints`、`isValidPin`、`newId`、`MENU_ICONS`、`ChildForm`、`exportBackup`、`parseBackup`、`importBackup`、`needsBackupReminder`、`BackupFile`、`UndoCheck`、`UndoFailReason`、`playSound`
- Produces:
  - `ParentHome({ onExit, onShowChild })`（Task 7 の仮と同じ props）
  - `StampTab({ childId, onStamped: (childId: string, txId: string) => void })`
  - `MoneyTab({ childId, type: 'spend' | 'withdraw' })`
  - `UndoTab()`、`SettingsTab()`
  - `DemoTab({ onExit, onShowChild })`

- [ ] **Step 1: 失敗するテストを追加する**

`src/ui/App.test.tsx` の末尾に追加:

```tsx
it('親がスタンプを押すと子どもの画面にスタンプが出て、とりけしでは誰の何かを表示する', async () => {
  const user = userEvent.setup()
  await setUp(user)
  await user.click(await screen.findByRole('button', { name: 'おやのメニュー' }))
  await typePin(user, '1234')
  await user.click(await screen.findByRole('button', { name: /おてつだい/ }))

  expect(await screen.findAllByLabelText('スタンプ')).toHaveLength(1)
  expect(screen.getByText(/31pt/)).toBeInTheDocument()

  // 5分以内なら PIN なしで親メニューに戻れる
  await user.click(screen.getByRole('button', { name: 'おやのメニュー' }))
  await user.click(await screen.findByRole('button', { name: 'とりけし' }))
  expect(await screen.findByText('あおい：おてつだい スタンプ 1pt')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'これを とりけす' }))
  expect(await screen.findByText('「あおい：おてつだい スタンプ 1pt」を とりけしました')).toBeInTheDocument()
})
```

実行ボタンの名前は「つかう を きろく」「ひきだす を きろく」にして、タブ名「つかう」「ひきだす」と区別する。

```tsx
it('つかう で残高より多いと押せず、正しい値なら減る', async () => {
  const user = userEvent.setup()
  await setUp(user)
  await user.click(await screen.findByRole('button', { name: 'おやのメニュー' }))
  await typePin(user, '1234')
  await user.click(await screen.findByRole('button', { name: 'つかう' }))
  const input = screen.getByLabelText('ポイント')
  await user.type(input, '31')
  expect(screen.getByRole('button', { name: 'つかう を きろく' })).toBeDisabled()
  expect(screen.getByText('ポイントが たりません')).toBeInTheDocument()
  await user.clear(input)
  await user.type(input, '１０')
  await user.type(screen.getByLabelText('つかいみち'), 'おかし')
  await user.click(screen.getByRole('button', { name: 'つかう を きろく' }))
  expect(await screen.findByText('10pt つかいました')).toBeInTheDocument()
  expect(screen.getByText(/おさいふ：20pt/)).toBeInTheDocument()
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/ui/App`
Expected: 新しい2件が FAIL（ParentHome が仮のもの）

- [ ] **Step 3: 親メニューの各タブを書く**

`src/ui/parent/StampTab.tsx`:

```tsx
import { useRef, useState } from 'react'
import { parsePoints } from '../../domain/validate'
import { playSound } from '../sound'
import { useStore } from '../store'

export function StampTab({ childId, onStamped }: { childId: string; onStamped: (childId: string, txId: string) => void }) {
  const { repo, snap, reload } = useStore()
  const [points, setPoints] = useState('')
  const [memo, setMemo] = useState('')
  const [message, setMessage] = useState('')
  const busy = useRef(false)
  const menu = snap.menuItems.filter((m) => m.childIds.includes(childId))
  const special = parsePoints(points)

  const stamp = async (input: { points: number; memo: string; icon: string; menuItemId?: string }) => {
    if (busy.current) return
    busy.current = true
    try {
      const tx = await repo.addTx({ childId, type: 'stamp', ...input })
      playSound('stamp', snap.settings.soundOn)
      await reload()
      onStamped(childId, tx.id)
    } catch {
      setMessage('スタンプを おせませんでした')
    } finally {
      busy.current = false
    }
  }

  return (
    <div>
      <h2>ていばん</h2>
      {menu.length === 0 && <p>ていばんメニューがありません。せってい から追加してください。</p>}
      <div className="menu-grid">
        {menu.map((m) => (
          <button key={m.id} className="menu-btn" onClick={() => void stamp({ points: m.points, memo: m.label, icon: m.icon, menuItemId: m.id })}>
            <span className="menu-icon">{m.icon}</span>
            {m.label}
            <small>{m.points}pt</small>
          </button>
        ))}
      </div>
      <h2>とくべつスタンプ</h2>
      <div className="row">
        <input className="num-input" inputMode="numeric" aria-label="とくべつ ポイント" placeholder="pt" value={points} onChange={(e) => setPoints(e.target.value)} />
        <input aria-label="とくべつ メモ" placeholder="なにが できた？" value={memo} onChange={(e) => setMemo(e.target.value)} />
        <button
          className="btn primary"
          disabled={special === null}
          onClick={() => {
            if (special !== null) void stamp({ points: special, memo: memo.trim() || 'とくべつ', icon: '🌟' })
          }}
        >
          おす
        </button>
      </div>
      {points.trim() !== '' && special === null && <p className="error">1以上の整数で入れてください</p>}
      {message && <p className="error">{message}</p>}
    </div>
  )
}
```

`src/ui/parent/MoneyTab.tsx`:

```tsx
import { useRef, useState } from 'react'
import { balancesOf } from '../../domain/balance'
import { parsePoints } from '../../domain/validate'
import { OpFailed } from '../../storage/repo'
import { useStore } from '../store'

export function MoneyTab({ childId, type }: { childId: string; type: 'spend' | 'withdraw' }) {
  const { repo, snap, reload } = useStore()
  const [points, setPoints] = useState('')
  const [memo, setMemo] = useState('')
  const [message, setMessage] = useState('')
  const busy = useRef(false)
  const b = balancesOf(snap.transactions, childId)
  const available = type === 'spend' ? b.wallet : b.savings
  const parsed = parsePoints(points)
  const verb = type === 'spend' ? 'つかう' : 'ひきだす'

  const submit = async () => {
    if (parsed === null || busy.current) return
    busy.current = true
    try {
      await repo.addTx({ childId, type, points: parsed, memo: memo.trim() || undefined })
      await reload()
      setPoints('')
      setMemo('')
      setMessage(type === 'spend' ? `${parsed}pt つかいました` : `${parsed}pt ひきだしました`)
    } catch (e) {
      setMessage(e instanceof OpFailed && e.reason === 'insufficient' ? 'ポイントが たりません' : 'できませんでした')
    } finally {
      busy.current = false
    }
  }

  return (
    <div>
      <p className="amount">
        {type === 'spend' ? '👛 おさいふ' : '🐷 ちょきんばこ'}：{available}pt <small>（{(available * 10).toLocaleString('ja-JP')}円）</small>
      </p>
      {type === 'withdraw' && <p className="note">ひきだすと、今月の利息はつきません。</p>}
      <div className="row">
        <input className="num-input" inputMode="numeric" aria-label="ポイント" placeholder="pt" value={points} onChange={(e) => setPoints(e.target.value)} />
        {type === 'spend' && <input aria-label="つかいみち" placeholder="なにに つかった？" value={memo} onChange={(e) => setMemo(e.target.value)} />}
        <button className="btn primary" disabled={parsed === null || parsed > available} onClick={() => void submit()}>
          {verb} を きろく
        </button>
      </div>
      {parsed !== null && parsed > available && <p className="error">ポイントが たりません</p>}
      {points.trim() !== '' && parsed === null && <p className="error">1以上の整数で入れてください</p>}
      {message && <p className="message">{message}</p>}
    </div>
  )
}
```

`src/ui/parent/UndoTab.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { describeTx } from '../../domain/describeTx'
import type { UndoCheck, UndoFailReason } from '../../domain/undo'
import { OpFailed } from '../../storage/repo'
import { useStore } from '../store'

const REASON: Record<UndoFailReason, string> = {
  none: 'とりけせる操作がありません',
  interest: '利息は とりけせません',
  settled: '先月より前の操作は とりけせません',
  negative: 'とりけすと ポイントがマイナスになるので、とりけせません',
}

export function UndoTab() {
  const { repo, snap, reload } = useStore()
  const [check, setCheck] = useState<UndoCheck | null>(null)
  const [message, setMessage] = useState('')
  const name = (id: string) => snap.children.find((c) => c.id === id)?.name ?? ''

  useEffect(() => {
    let alive = true
    void repo.previewUndo().then((r) => {
      if (alive) setCheck(r)
    })
    return () => {
      alive = false
    }
  }, [repo, snap])

  const undo = async () => {
    try {
      const t = await repo.undoLast()
      setMessage(`「${describeTx(t, name(t.childId))}」を とりけしました`)
      await reload()
    } catch (e) {
      setMessage(e instanceof OpFailed ? (REASON[e.reason as UndoFailReason] ?? 'できませんでした') : 'できませんでした')
    }
  }

  return (
    <div>
      {message && <p className="message">{message}</p>}
      {check?.ok && (
        <>
          <p>さいごの操作：</p>
          <p className="amount">{describeTx(check.tx, name(check.tx.childId))}</p>
          <button className="btn danger" onClick={() => void undo()}>
            これを とりけす
          </button>
        </>
      )}
      {check && !check.ok && (
        <p>
          {REASON[check.reason]}
          {check.tx && `（さいごの操作：${describeTx(check.tx, name(check.tx.childId))}）`}
        </p>
      )}
    </div>
  )
}
```

`src/ui/parent/DemoTab.tsx`（仮。Task 10 で置き換える）:

```tsx
export function DemoTab(_: { onExit: () => void; onShowChild: (childId: string) => void }) {
  return <p>デモモードは じゅんびちゅうです。</p>
}
```

- [ ] **Step 4: せっていタブを書く**

`src/ui/parent/settings/ChildrenSettings.tsx`:

```tsx
import { useState } from 'react'
import type { Child } from '../../../domain/types'
import { parsePoints } from '../../../domain/validate'
import { ChildForm, type ChildDraft } from '../../common/ChildForm'
import { useStore } from '../../store'

function ChildEditor({ child }: { child: Child }) {
  const { repo, snap, reload } = useStore()
  const hasOpening = snap.transactions.some((t) => t.childId === child.id && t.type === 'opening' && !t.voidedAt)
  const [draft, setDraft] = useState<ChildDraft>({ name: child.name, avatar: child.avatar, color: child.color, displayMode: child.displayMode, opening: '' })
  const [message, setMessage] = useState('')

  const save = async () => {
    if (!draft.name.trim()) return setMessage('なまえを入れてください')
    const openingText = draft.opening.trim()
    const opening = openingText === '' ? null : parsePoints(openingText)
    if (openingText !== '' && opening === null) return setMessage('いま貯まっているポイントは1以上の整数で入れてください')
    await repo.saveChild({ ...child, name: draft.name.trim(), avatar: draft.avatar, color: draft.color, displayMode: draft.displayMode })
    if (opening !== null && !hasOpening) await repo.addTx({ childId: child.id, type: 'opening', points: opening })
    await reload()
    setDraft({ ...draft, opening: '' })
    setMessage('保存しました')
  }

  return (
    <div>
      <ChildForm label={child.name} value={draft} onChange={setDraft} showOpening={!hasOpening} />
      <button className="btn primary" onClick={() => void save()}>
        保存
      </button>
      {message && <p className="message">{message}</p>}
    </div>
  )
}

export function ChildrenSettings() {
  const { snap } = useStore()
  return (
    <section>
      <h2>こども</h2>
      {snap.children.map((c) => (
        <ChildEditor key={c.id} child={c} />
      ))}
    </section>
  )
}
```

`src/ui/parent/settings/MenuSettings.tsx`:

```tsx
import { useState } from 'react'
import type { MenuItem } from '../../../domain/types'
import { parsePoints } from '../../../domain/validate'
import { MENU_ICONS } from '../../../storage/defaults'
import { newId } from '../../../storage/ids'
import { useStore } from '../../store'

function MenuEditor({ item, onClose, onSaved }: { item: MenuItem; onClose: () => void; onSaved: () => Promise<void> }) {
  const { repo, snap } = useStore()
  const [label, setLabel] = useState(item.label)
  const [icon, setIcon] = useState(item.icon)
  const [points, setPoints] = useState(String(item.points))
  const [childIds, setChildIds] = useState(item.childIds)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const parsed = parsePoints(points)
  const valid = label.trim() !== '' && parsed !== null && childIds.length > 0
  const exists = snap.menuItems.some((m) => m.id === item.id)
  const toggle = (id: string) => setChildIds(childIds.includes(id) ? childIds.filter((x) => x !== id) : [...childIds, id])

  return (
    <div className="card">
      <label>
        なまえ
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <div className="field-label">アイコン</div>
      <div className="choice-row">
        {MENU_ICONS.map((i) => (
          <button type="button" key={i} className={i === icon ? 'choice on' : 'choice'} onClick={() => setIcon(i)}>
            {i}
          </button>
        ))}
      </div>
      <label>
        ポイント
        <input inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} />
      </label>
      <div className="field-label">だれ向け</div>
      <div className="choice-row">
        {snap.children.map((c) => (
          <button type="button" key={c.id} className={childIds.includes(c.id) ? 'choice wide on' : 'choice wide'} onClick={() => toggle(c.id)}>
            {c.avatar} {c.name}
          </button>
        ))}
      </div>
      <div className="row">
        <button className="btn" onClick={onClose}>
          キャンセル
        </button>
        <button
          className="btn primary"
          disabled={!valid}
          onClick={async () => {
            if (parsed === null) return
            await repo.saveMenuItem({ ...item, label: label.trim(), icon, points: parsed, childIds })
            await onSaved()
          }}
        >
          保存
        </button>
        {exists &&
          (confirmDelete ? (
            <button
              className="btn danger"
              onClick={async () => {
                await repo.deleteMenuItem(item.id)
                await onSaved()
              }}
            >
              ほんとうに消す
            </button>
          ) : (
            <button className="btn danger" onClick={() => setConfirmDelete(true)}>
              消す
            </button>
          ))}
      </div>
    </div>
  )
}

export function MenuSettings() {
  const { snap, reload } = useStore()
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const childName = (id: string) => snap.children.find((c) => c.id === id)?.name

  return (
    <section>
      <h2>ていばんメニュー</h2>
      <ul className="menu-list">
        {snap.menuItems.map((m) => (
          <li key={m.id}>
            <span>
              {m.icon} {m.label}（{m.points}pt）・{m.childIds.map(childName).filter(Boolean).join('、')}
            </span>
            <button className="btn small" onClick={() => setEditing(m)}>
              編集
            </button>
          </li>
        ))}
      </ul>
      <button
        className="btn"
        onClick={() =>
          setEditing({ id: newId(), label: '', icon: MENU_ICONS[0], points: 1, childIds: snap.children.map((c) => c.id), order: snap.menuItems.length })
        }
      >
        ＋ 追加
      </button>
      {editing && (
        <MenuEditor
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await reload()
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}
```

`src/ui/parent/settings/GeneralSettings.tsx`:

```tsx
import { useState } from 'react'
import { parsePoints } from '../../../domain/validate'
import { isValidPin } from '../../../storage/pin'
import { useStore } from '../../store'

export function GeneralSettings() {
  const { repo, snap, reload } = useStore()
  const [rate, setRate] = useState(String(snap.settings.interestPercent))
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  const rateValue = rate.trim() === '0' ? 0 : parsePoints(rate)
  const rateValid = rateValue !== null && rateValue <= 100

  return (
    <section>
      <h2>そのほか</h2>
      <div className="row">
        <label>
          利率（月 %）
          <input className="num-input" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <button
          className="btn primary"
          disabled={!rateValid}
          onClick={async () => {
            if (rateValue === null) return
            await repo.updateSettings({ interestPercent: rateValue })
            await reload()
            setMessage('利率を変えました（これから計算する月から使われます）')
          }}
        >
          保存
        </button>
      </div>
      <div className="row">
        <label>
          新しい PIN（4けた）
          <input className="num-input" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
        </label>
        <button
          className="btn primary"
          disabled={!isValidPin(pin)}
          onClick={async () => {
            await repo.setPin(pin)
            setPin('')
            await reload()
            setMessage('PIN を変えました')
          }}
        >
          保存
        </button>
      </div>
      <label className="row">
        <input
          type="checkbox"
          checked={snap.settings.soundOn}
          onChange={async (e) => {
            await repo.updateSettings({ soundOn: e.target.checked })
            await reload()
          }}
        />
        効果音
      </label>
      {message && <p className="message">{message}</p>}
    </section>
  )
}
```

`src/ui/parent/settings/BackupSettings.tsx`:

```tsx
import { useState } from 'react'
import { exportBackup, importBackup, parseBackup, type BackupFile } from '../../../storage/backup'
import { useStore } from '../../store'

export function BackupSettings() {
  const { repo, snap, reload } = useStore()
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [message, setMessage] = useState('')

  const download = async () => {
    const text = await exportBackup(repo)
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `kids-points-${repo.now().toISOString().slice(0, 10)}.json`
    a.click()
    // iPad で保存が終わる前に消さないよう、少し待ってから解放する
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    await reload()
    setMessage('書き出しました')
  }

  const pick = async (file: File) => {
    try {
      setPending(parseBackup(await file.text()))
      setMessage('')
    } catch (e) {
      setPending(null)
      setMessage(e instanceof Error ? e.message : '読み込めませんでした')
    }
  }

  return (
    <section>
      <h2>バックアップ</h2>
      <p>最後の書き出し：{snap.settings.lastBackupAt ? new Date(snap.settings.lastBackupAt).toLocaleDateString('ja-JP') : 'まだありません'}</p>
      <div className="row">
        <button className="btn primary" onClick={() => void download()}>
          書き出す
        </button>
        <label className="btn">
          読み込む
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void pick(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {pending && (
        <div className="card">
          <p>このファイルの内容で、今のデータをすべて置き換えます。</p>
          <ul>
            <li>書き出した日時：{new Date(pending.exportedAt).toLocaleString('ja-JP')}</li>
            <li>こども：{pending.children.map((c) => c.name).join('、')}</li>
            <li>記録：{pending.transactions.length}件</li>
          </ul>
          <div className="row">
            <button className="btn" onClick={() => setPending(null)}>
              やめる
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                await importBackup(repo, pending)
                setPending(null)
                await reload()
                setMessage('読み込みました')
              }}
            >
              置き換える
            </button>
          </div>
        </div>
      )}
      {message && <p className="message">{message}</p>}
    </section>
  )
}
```

`src/ui/parent/settings/SettingsTab.tsx`:

```tsx
import { BackupSettings } from './BackupSettings'
import { ChildrenSettings } from './ChildrenSettings'
import { GeneralSettings } from './GeneralSettings'
import { MenuSettings } from './MenuSettings'

export function SettingsTab() {
  return (
    <div>
      <ChildrenSettings />
      <MenuSettings />
      <GeneralSettings />
      <BackupSettings />
    </div>
  )
}
```

- [ ] **Step 5: ParentHome を書く**

`src/ui/parent/ParentHome.tsx`:

```tsx
import { useState } from 'react'
import { needsBackupReminder } from '../../storage/backup'
import { useStore } from '../store'
import { DemoTab } from './DemoTab'
import { MoneyTab } from './MoneyTab'
import { SettingsTab } from './settings/SettingsTab'
import { StampTab } from './StampTab'
import { UndoTab } from './UndoTab'

type Tab = 'stamp' | 'spend' | 'withdraw' | 'undo' | 'settings' | 'demo'

const TABS: { id: Tab; label: string }[] = [
  { id: 'stamp', label: 'スタンプ' },
  { id: 'spend', label: 'つかう' },
  { id: 'withdraw', label: 'ひきだす' },
  { id: 'undo', label: 'とりけし' },
  { id: 'settings', label: 'せってい' },
  { id: 'demo', label: 'デモ' },
]

export function ParentHome({
  onExit,
  onShowChild,
}: {
  onExit: () => void
  onShowChild: (childId: string, celebrateTxId?: string) => void
}) {
  const { snap, repo, mode } = useStore()
  const [tab, setTab] = useState<Tab>('stamp')
  const [childId, setChildId] = useState(snap.children[0]?.id ?? '')
  const needsChild = tab === 'stamp' || tab === 'spend' || tab === 'withdraw'

  return (
    <div className="screen">
      <header className="parent-header">
        <h1>おやの メニュー</h1>
        <button className="btn" onClick={onExit}>
          🔒 とじる
        </button>
      </header>
      {mode === 'real' && needsBackupReminder(snap.settings, repo.now()) && (
        <p className="banner">最後のバックアップから30日以上たっています。「せってい」→「バックアップ」から書き出してください。</p>
      )}
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'tab on' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      {needsChild && (
        <div className="choice-row">
          {snap.children.map((c) => (
            <button key={c.id} className={c.id === childId ? 'choice wide on' : 'choice wide'} onClick={() => setChildId(c.id)}>
              {c.avatar} {c.name}
            </button>
          ))}
        </div>
      )}
      {tab === 'stamp' && <StampTab childId={childId} onStamped={onShowChild} />}
      {tab === 'spend' && <MoneyTab key={`spend-${childId}`} childId={childId} type="spend" />}
      {tab === 'withdraw' && <MoneyTab key={`withdraw-${childId}`} childId={childId} type="withdraw" />}
      {tab === 'undo' && <UndoTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'demo' && <DemoTab onExit={onExit} onShowChild={(id) => onShowChild(id)} />}
    </div>
  )
}
```

- [ ] **Step 6: 通ることを確認する**

Run: `npm test && npm run build`
Expected: 全件 PASS、ビルド成功

- [ ] **Step 7: ブラウザで確認する**

`npm run dev` で、親メニューから: 定番スタンプ → 子どもの画面でスタンプがポンと出る／とくべつスタンプ／つかう／ひきだす（ひきだした子の利息見込みが「おやすみ」になる）／とりけし／せってい（名前・アバター・色・表示モード・メニュー追加と削除・利率・PIN・効果音・バックアップの書き出し）を一通り触る。

- [ ] **Step 8: Commit**

```bash
git add src/ui
git commit -m "feat: 親メニュー（スタンプ・つかう・ひきだす・とりけし・せってい）を追加"
```

---

### Task 10: デモモードと PWA

**Files:**
- Modify: `src/ui/parent/DemoTab.tsx`（仮のものを置き換える）、`vite.config.ts`、`index.html`
- Create: `public/icon.svg`、生成した PNG アイコン
- Test: `src/ui/parent/DemoTab.test.tsx`

**Interfaces:**
- Consumes: `useStore`（`mode`、`demoOffset`、`snap`、`switchMode`、`advanceDemo`、`resetDemo`）、`DEMO_PIN`
- Produces: `DemoTab({ onExit, onShowChild })`、PWA マニフェスト（名前「ポイントちょきん」）

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/parent/DemoTab.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { newId } from '../../storage/ids'
import { StoreProvider, useStore } from '../store'
import { DemoTab } from './DemoTab'

function Offset() {
  const { demoOffset, mode } = useStore()
  return (
    <p>
      {mode}:{demoOffset}
    </p>
  )
}

it('デモで1ヶ月すすめると月がずれ、最初の子の画面を開く。リセットで0に戻る', async () => {
  const user = userEvent.setup()
  const onShowChild = vi.fn()
  render(
    <StoreProvider dbNames={{ real: `real-${newId()}`, demo: `demo-${newId()}` }} initialMode="demo">
      <Offset />
      <DemoTab onExit={() => {}} onShowChild={onShowChild} />
    </StoreProvider>,
  )
  expect(await screen.findByText('demo:0')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '1ヶ月 すすめる' }))
  expect(await screen.findByText('demo:1')).toBeInTheDocument()
  expect(onShowChild).toHaveBeenCalledWith('demo-aoi')
  await user.click(screen.getByRole('button', { name: 'デモを リセット' }))
  expect(await screen.findByText('demo:0')).toBeInTheDocument()
})
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- src/ui/parent/DemoTab`
Expected: FAIL（ボタンが見つからない）

- [ ] **Step 3: DemoTab を書く**

`src/ui/parent/DemoTab.tsx`:

```tsx
import { useState } from 'react'
import { DEMO_CHILD_IDS, DEMO_PIN } from '../../storage/demo'
import { useStore } from '../store'

export function DemoTab({ onExit, onShowChild }: { onExit: () => void; onShowChild: (childId: string) => void }) {
  const { mode, demoOffset, switchMode, advanceDemo, resetDemo } = useStore()
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<void>, after: () => void) => {
    setBusy(true)
    try {
      await action()
      after()
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'real') {
    return (
      <div>
        <p>LT などで見せるためのデモモードです。今のデータには影響しません。</p>
        <p>デモの PIN は {DEMO_PIN} です。</p>
        <button className="btn primary" disabled={busy} onClick={() => void run(() => switchMode('demo'), onExit)}>
          デモモードにする
        </button>
      </div>
    )
  }
  return (
    <div>
      <p>デモモード中です（{demoOffset}ヶ月 すすめています）。</p>
      <div className="row">
        <button className="btn primary" disabled={busy} onClick={() => void run(advanceDemo, () => onShowChild(DEMO_CHILD_IDS[0]))}>
          1ヶ月 すすめる
        </button>
        <button className="btn" disabled={busy} onClick={() => void run(resetDemo, () => {})}>
          デモを リセット
        </button>
        <button className="btn" disabled={busy} onClick={() => void run(() => switchMode('real'), onExit)}>
          ふだんのモードに もどる
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `npm test`
Expected: 全件 PASS

- [ ] **Step 5: アイコンを作る**

`public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#ff8a5c"/>
  <circle cx="256" cy="270" r="150" fill="#fff8ec"/>
  <circle cx="256" cy="270" r="112" fill="none" stroke="#ff8a5c" stroke-width="18" stroke-dasharray="30 18"/>
  <path d="M256 196 L276 246 L330 248 L288 282 L302 334 L256 304 L210 334 L224 282 L182 248 L236 246 Z" fill="#f2b33d"/>
</svg>
```

```bash
npx pwa-assets-generator --preset minimal-2023 public/icon.svg
ls public
```

Expected: `pwa-64x64.png`、`pwa-192x192.png`、`pwa-512x512.png`、`maskable-icon-512x512.png`、`apple-touch-icon-180x180.png`、`favicon.ico` ができる。

- [ ] **Step 6: PWA の設定を入れる**

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/kids-points/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'ポイントちょきん',
        short_name: 'ポイント',
        lang: 'ja',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#fff8ec',
        theme_color: '#ff8a5c',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

`index.html` の `<head>` に追加:

```html
<link rel="icon" href="/kids-points/favicon.ico" sizes="any" />
<link rel="apple-touch-icon" href="/kids-points/apple-touch-icon-180x180.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="ポイント" />
<meta name="theme-color" content="#ff8a5c" />
```

- [ ] **Step 7: ビルドとプレビューで確認する**

Run: `npm test && npm run build && npm run preview`
Expected: ビルド成功。表示されたURL（`/kids-points/`）を開き、DevTools の Application タブで manifest と service worker が登録されていること、`?demo` を付けて開くとデモの2人が出ること、親メニュー（PIN 0000）→ デモ → 「1ヶ月 すすめる」で「ふえたよ！」が出ることを見る。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: デモモードと PWA 対応を追加"
```

---

### Task 11: GitHub Pages への公開と iPad での確認

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm test`、`npm run build`（出力 `dist/`）
- Produces: `https://<GitHubユーザー名>.github.io/kids-points/`

- [ ] **Step 1: デプロイ用のワークフローを書く**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

```bash
git add .github
git commit -m "ci: GitHub Pages へのデプロイを追加"
```

- [ ] **Step 2: リポジトリを作って push する（外部公開になるので、実行前にユーザーに確認する）**

確認すること: リポジトリを public で作ってよいか（無料プランの GitHub Pages は public が必要。コードは公開されるが、家族のデータは iPad の中だけにありリポジトリには入らない）。

```bash
gh repo create kids-points --public --source . --push
gh api -X POST "repos/{owner}/kids-points/pages" -f build_type=workflow
gh run watch --exit-status
```

Expected: ワークフローが成功し、`https://<GitHubユーザー名>.github.io/kids-points/` が開ける。

- [ ] **Step 3: iPad で確認する**

1. iPad の Safari で公開URLを開く → 共有 → 「ホーム画面に追加」
2. ホーム画面のアイコンから起動し、全画面で開くことを確認
3. はじめの設定（PIN、2人の名前・アバター・色・表示モード・今のポイント）を行う
4. 親メニューから定番スタンプを押す → 子どもの画面でスタンプの演出と効果音
5. 5歳の子の画面で「1こ／5こ／ぜんぶ」が指で押しやすいか、9歳の子の画面で円と利息見込みが出るか
6. 「せってい」→「バックアップ」→「書き出す」で、ファイルアプリに保存できるか
7. 機内モードにして、ホーム画面から開けるか（オフライン動作）

問題があれば、内容と再現手順を記録してから直す。

---

## 自己レビュー記録

- 仕様の網羅: 3.2 トップ（Task 7）、3.3 子どもホーム（Task 8）、3.4 親メニュー（Task 9）、デモ（Task 6・10）、4.3〜4.5 ルール（Task 2〜5）、4.7 PIN とリセット（Task 5・7）、4.8 バックアップ（Task 6・9）、5 技術構成と iPad の注意点（Task 1・7・10・11）、6 テスト（各 Task）。
- 仕様からの小さな具体化: スタンプ後の「子どもの画面に演出」は、親メニューから子どもの画面へ自動で移動して出す。そのとき親メニューへは5分間 PIN なしで戻れる。
