# timetree-to-ics

TimeTree の公開カレンダーを、今後の予定だけの .ics にするツール（TypeScript のライブラリとコマンド。npm の `timetree-to-ics`）。公開リポジトリで、誰でも読める。CLAUDE.md はこのファイルへのリンク。人の貢献者向けの手順は CONTRIBUTING.md にあり、ここは AI エージェント向けの決まりを持つ。

## 進め方

方向と、外に出る操作（npm への公開・リポジトリの設定の変更）は、リポジトリの持ち主（人）が決める。エージェントは、その範囲でコードと文書を保つ。

- 頼まれた変更を今の構造に足すだけで終えない。似た処理はまとめ、近くで見つけた不具合と古い記述はその場で直す
- 外から見える振る舞いは、不具合の直しを除いて黙って変えない。変えるときは版を上げ、README を同じ commit で直す。外から見える振る舞いとは、`src/index.ts` から出している物すべて（関数と型）・コマンドの引数と出力・.ics に書く欄
- npm に出す（タグを打つ）・リポジトリの設定を変える・使う人に入る依存を足す、の 3 つは先に持ち主に聞く
- 外の人の issue と PR は、ふつうにレビューする。CONTRIBUTING.md の決まりに合わない所は、直してもらうか、取り込んでから直す

## ファイルの地図

| ファイル | 役目 |
|---|---|
| `src/timetree.ts` | TimeTree の API を読む（名前の取り出し・カレンダー・予定）。API が変わったらここだけを直す |
| `src/ics.ts` | 予定を .ics の文字列にする（エスケープ・75 バイトの折り返し・繰り返しの予定の時間帯） |
| `src/convert.ts` | 入口の `timetreeToIcs`（読む → 今日以降に絞る → .ics） |
| `src/cli.ts` | コマンド。Node の API（`node:*`）はここだけで使う |
| `src/index.ts` | 公開する物の一覧 |
| `test/fixtures.ts` | TimeTree の返事のテスト用データ |
| `test/cli.test.ts`・`test/ical-parse.test.ts` | コマンドの引数・出力・終了コード（`test/cli-preload.ts` で TimeTree の代わりにテスト用データを返す）・ical.js で .ics を読み直す確かめ |
| `scripts/live-check.ts` | 本物の公開カレンダーを読む確かめ（`live.yml` が流す） |

## 守ること

- **ツールは、読むことと .ics にすることだけを持つ。** どこに置くか・いつ作り直すか・止まったときにどう気づくかは使う人が決める。README に例として書くのはよいが、置き場（Workers の設定・定期実行）をこのリポジトリに入れない
- **`src/` は `fetch` と標準の関数だけで書く**（`src/cli.ts` を除く）。`fetch` のある環境ならどこでも動くようにする
- **対応する Node は 24 以上の 1 つだけ。** 1 人で保つので、確かめる版を 1 つに絞る。`package.json` の `engines` と CI の `node-version` を同じ版にし、次の LTS に移るときは両方を上げる
- **使う人に入る依存は持たない（今は 0 個）。** 足すと、使う人の側の更新と脆弱性の確かめが増える
- **テストは TimeTree に行かない。** 返事の形は `test/fixtures.ts` のテスト用データで再現する
- **実在のカレンダーの名前・予定・人の名前をリポジトリに入れない。** 見本の名前は `example_band` だけ。`test/no-real-names.test.ts` が、`src`・`test`・README・CONTRIBUTING.md・このファイルの `public_calendars/<名前>` と `timetr.ee/p/<名前>` を見て止める。公開リポジトリと npm で、誰がどのカレンダーを見ているかが分かってしまうため
- **TimeTree に負担をかけない。** 読むのは 1 回の作成で 2〜3 回まで。並べて何度も読む・短い間隔で読み直す機能は足さない。非公式の API なので、負担が目立てば塞がれる
- **読めなかったときは、空の .ics を返さず `TimeTreeError` を投げる。** 空を返すと、購読した側の予定が全部消える

## 依存と GitHub Actions の守り

依存の乗っ取りへの備え。緩めるときは理由を報告に書く。

- 依存はちょうどの版で書き、公開から 7 日たっていない版は入れない（`bunfig.toml`）。GitHub Actions は commit の SHA で固定する（`mise exec -- pinact run`）
- ワークフローは `actionlint`・`pinact run --check`・`zizmor` で点検する。ツールの版は `mise.toml` で固定し、lefthook と CI が同じ版で流す
- 定期のワークフローは 2 つ。`live.yml`（毎週月曜）が本物の公開カレンダーを 1 回読み、API の変化に気づく（名前は秘密の設定 `TIMETREE_LIVE_CALENDAR` に置き、ログに出さない）。`update.yml`（毎月 1 日）が依存を上げ、確かめが通れば main に直接入れる。Actions の SHA は `update.yml` では上げられないので、上げられる版が実行の要約に出たら手で上げる

## TimeTree の API（2026-11 に確かめた形）

- `GET https://timetreeapp.com/api/v2/public_calendars/<名前>`: カレンダーの名前など
- `GET .../public_calendars/<名前>/public_events?from=<ミリ秒>&to=<ミリ秒>&utc_offset=<秒>`: 予定。1 回 300 件まで、続きは `paging.next` と `cursor=<paging.next_cursor>`
- 無い名前は 400。ログインも鍵も要らない
- ヘッダーは `X-Timetreea` と `User-Agent` の 2 つとも付ける。片方が欠けると、Cloudflare Workers からの予定の API は 400（`code: -401`）になる。家の回線からは欠けても返るので、API の読み方を直したら Workers の上でも 1 回確かめる
- 終日の予定は、始まりと終わりが UTC の 0 時で、終わりは最後の日を含む（.ics の DTEND は 1 日足す）
- 予定の時間帯は `start_timezone`（例 `Asia/Tokyo`）。繰り返しの予定は、この時間帯の時刻で .ics に書く（UTC で書くと、曜日がずれる）
- 本文に U+2028 が入ることがある（.ics では改行にする）

## 確かめ方

```bash
bun run check                                              # テスト・型の検査・ビルド・Node での起動
node dist/cli.js <公開カレンダーの名前か URL> -o /tmp/out.ics   # 実物の確かめ（名前は commit しない）
```

commit の前に lefthook が、commit の書き方・秘密の混入・テスト・ワークフローの点検を見る。push と PR では CI が同じ確かめを流す。

## npm に出す

1. `package.json` の `version` と `src/timetree.ts` の `VERSION` を上げる（ずれるとテストが落ちる）。外から見える振る舞いを壊す版は major、足す版は minor、直しだけなら patch
2. commit して push する
3. `git tag v<版> && git push origin v<版>` でタグを打つと、`release.yml` が npm に出して GitHub の Release を作る（本文は前のタグからの commit の 1 行目）

npm へは GitHub Actions の Trusted Publishing（OIDC）で出すので、npm の鍵はどこにも置かない。信頼の設定は npm の側にある（`npm trust list timetree-to-ics`）。新しく出した版は、npm に見えるまで数分かかることがある。

## 書き方

- 文書・コメント・メッセージは日本語。README の「English」の節だけ英語で、使い方の要約にとどめる（中身を訳して 2 か所に持たない）
- commit の 1 行目は `type(scope): subject`。type は `lefthook.yml` の commit-message の検査に従う
- 版は `package.json` の `version` と、`v1.0.0` の形のタグでそろえる
