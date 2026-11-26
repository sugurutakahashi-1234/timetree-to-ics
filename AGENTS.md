# timetree-to-ics

TimeTree の公開カレンダーを、今後の予定だけの .ics にする道具（TypeScript のライブラリとコマンド。npm の `timetree-to-ics`）。公開リポジトリで、誰でも読める。CLAUDE.md はこのファイルへのリンク。人の貢献者向けの手順は CONTRIBUTING.md にあり、ここはエージェント向けの決まりを持つ。

## 持ち主として保つ

このリポジトリは、エージェント（Claude）が持ち主として作り、保つ。設計はエージェントが決め、リポジトリの持ち主（人）は方向と、外に出る操作の許可を出す。

- 頼まれた変更を今の構造に足すだけで終えない。似た処理はまとめ、近くで見つけた不具合と古い記述はその場で直す。次にここを触るのも自分なので、後で読みやすい形を選ぶ
- 外から見える振る舞いは、不具合の直しを除いて黙って変えない。変えるときは版を上げ、README を同じ commit で直す。外から見える振る舞いとは、`src/index.ts` から出している物すべて（関数と型）・コマンドの引数と出力・.ics に書く欄
- git で戻せる手（直す・テストを足す・まとめる・開発の依存を上げる）は聞かずに進め、報告に 1 件 1 行で書く。npm に出す（札を打つ）・リポジトリの設定を変える・使う人に入る依存を足すは、先に聞く
- 外の人の issue と PR は、決まり（CONTRIBUTING.md）に合っているかを見てから扱う。合わない所は直してもらうか、取り込んでからこちらで直す

## ファイルの地図

| ファイル | 役目 |
|---|---|
| `src/timetree.ts` | TimeTree の API を読む（名前の取り出し・カレンダー・予定）。API が変わったらここだけを直す |
| `src/ics.ts` | 予定を .ics の文字列にする（逃がし・75 バイトの折り返し） |
| `src/convert.ts` | 入口の `timetreeToIcs`（読む → 今日以降に絞る → .ics） |
| `src/cli.ts` | コマンド。Node の API（`node:*`）はここだけで使う |
| `src/index.ts` | 公開する物の一覧 |
| `test/fixtures.ts` | TimeTree の返事の作り物 |
| `test/cli.test.ts`・`test/ical-parse.test.ts` | コマンドの引数と終了コード・ical.js で .ics を読み直す確かめ |
| `scripts/live-check.ts` | 本物の公開カレンダーを読む確かめ（`live.yml` が流す） |

## 守ること

- **道具は、読むことと .ics にすることだけを持つ。** どこに置くか・いつ作り直すか・止まりをどう見張るかは使う人が決める。README に例として書くのはよいが、置き場（Workers の設定・定期実行）をこのリポジトリに入れない
- **`src/` は `fetch` と標準の関数だけで書く**（`src/cli.ts` を除く）。`fetch` のある環境ならどこでも動くようにする
- **支える Node は 24 以上の 1 つだけ。** 1 人で保つので、確かめる版を 1 つに絞る。`package.json` の `engines` と CI の `node-version` を同じ版にし、次の LTS に移るときは両方を上げる
- **使う人に入る依存は持たない（今は 0 個）。** 足すと、使う人の側の更新と脆弱性の確かめが増える
- **テストは TimeTree に行かない。** 返事の形は `test/fixtures.ts` の作り物で再現する
- **実在のカレンダーの名前・予定・人の名前をリポジトリに入れない。** 見本の名前は `example_band` だけ。`test/no-real-names.test.ts` が、`src`・`test`・README・CONTRIBUTING.md・このファイルの `public_calendars/<名前>` を見て止める。公開リポジトリと npm で、誰がどのカレンダーを見ているかが分かってしまうため
- **TimeTree に負担をかけない。** 読むのは 1 回の作成で 2〜3 回まで。並べて何度も読む・短い間隔で読み直す機能は足さない。非公式の API なので、負担が目立てば塞がれる
- **読めなかったときは、空の .ics を返さず `TimeTreeError` を投げる。** 空を返すと、購読した側の予定が全部消える

## 依存と仕組みの守り

版の乗っ取りへの備え。緩めるときは理由を報告に書く。

- 依存はちょうどの版で書き、公開から 7 日たっていない版は入れない（`bunfig.toml`。単位は秒）
- GitHub Actions は commit の SHA で固定する。足したら `mise exec -- pinact run` で固定する
- 仕組み（`.github/workflows`）は `actionlint`・`pinact run --check`・`zizmor` で点検する。道具の版は `mise.toml` で固定し、lefthook（仕組みを変えた commit）と CI の `workflows` が同じ版で流す
- 出す仕組み（`release.yml`）では、キャッシュを使わず、lockfile の外から物を入れない（zizmor の cache-poisoning・adhoc-packages）
- TimeTree の API の変化に気づくのは `live.yml`（毎週月曜）。本物の公開カレンダーを 1 回読む（`scripts/live-check.ts`）。読むカレンダーの名前は GitHub の秘密の設定 `TIMETREE_LIVE_CALENDAR` に置き、ログにも名前を出さない
- GitHub は、公開リポジトリに 60 日 commit が無いと、定期の仕組み（`live.yml`・`update.yml`）を止める。止まったら Actions のタブから有効に戻す
- 版を最新に保つのは `update.yml`（毎月 1 日）。npm の依存と点検の道具を、7 日たった版に上げ、確かめが通れば main に直接入れる。失敗したら GitHub が持ち主にメールで知らせる
- GitHub Actions の SHA は `update.yml` では上げられない（GitHub Actions の鍵では `.github/workflows` を書き換えて push できない）。上げられる版は `update` の実行の要約に出るので、手を入れるときに `mise exec -- pinact run --update --min-age 7` で上げる

## TimeTree の API（2026-11 に確かめた形）

- `GET https://timetreeapp.com/api/v2/public_calendars/<名前>`: カレンダーの名前など
- `GET .../public_calendars/<名前>/public_events?from=<ミリ秒>&to=<ミリ秒>&utc_offset=<秒>`: 予定。1 回 300 件まで、続きは `paging.next` と `cursor=<paging.next_cursor>`
- 無い名前は 400。ログインも鍵も要らない
- 名乗りは `X-Timetreea` と `User-Agent` の 2 つとも付ける。片方が欠けると、Cloudflare Workers からの予定の API は 400（`code: -401`）になる。家の回線からは欠けても返るので、API の読み方を直したら Workers の上でも 1 回確かめる
- 終日の予定は、始まりと終わりが UTC の 0 時で、終わりは最後の日を含む（.ics の DTEND は 1 日足す）
- 本文に U+2028 が入ることがある（.ics では改行にする）

## 確かめ方

```bash
bun run check                                              # テスト・型の検査・組み立て・Node での起動
node dist/cli.js <公開カレンダーの名前か URL> -o /tmp/out.ics   # 実物の確かめ（名前は commit しない）
```

commit の前に lefthook が、commit の書き方・秘密の混入・テスト・仕組みの点検を見る。push と PR では CI が同じ確かめを流す。

## npm に出す

1. `package.json` の `version` と `src/timetree.ts` の `VERSION` を上げる（ずれるとテストが落ちる）。外から見える振る舞いを壊す版は major、足す版は minor、直しだけなら patch
2. commit して push する
3. `git tag v<版> && git push origin v<版>` で札を打つと、`release.yml` が npm に出して GitHub の Release を作る

npm へは GitHub Actions の信頼された出し方（OIDC）で出すので、npm の鍵はどこにも置かない。信頼の設定は npm の側にある（`npm trust list timetree-to-ics`）。新しく出した版は、npm に見えるまで数分かかることがある。

## 書き方

- 文書・コメント・メッセージは日本語。README の「English」の節だけ英語で、使い方の要約にとどめる（中身を訳して 2 か所に持たない）
- commit の 1 行目は `type(scope): subject`。type は `lefthook.yml` の commit-message の検査に従う
- 版は `package.json` の `version` と、`v1.0.0` の形の札でそろえる
