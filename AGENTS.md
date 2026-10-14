# kids-points

子ども2人のお手伝いポイントを、スタンプカードと「ちょきんばこ」の複利で管理する iPad 向け PWA。

- 仕様: `docs/superpowers/specs/2026-10-13-kids-points-design.md`
- 実装計画: `docs/superpowers/plans/2026-10-13-kids-points.md`

## 構成

- `src/domain/`: ルール（残高・利息・取り消し・スタンプカード）。画面とDBに依存しない純粋関数。現在時刻は引数で受け取る
- `src/storage/`: IndexedDB（Dexie）への読み書き、バックアップ、デモ用データ
- `src/ui/`: React の画面

## コマンド

Node 22.12 以上が必要（Vite 8）。このマシンでは nodebrew の v22.23.3 を PATH の先頭に置いて使う（`.node-version` 参照。global の current は変えていない）:

```bash
export PATH=$HOME/.nodebrew/node/v22.23.3/bin:$PATH
```

- `npm test`: テスト（日本時間で実行）
- `npm run dev`: 開発サーバー
- `npm run build`: ビルド
- `npm run lint`: oxlint

## 守ること

- 残高は保存しない。取引記録から計算する。記録は消さず、取り消しは `voidedAt` をつける
- お金のルールを変えるときは、先に `src/domain/` のテストを書く
- ブラウザの alert / confirm / prompt は使わない
