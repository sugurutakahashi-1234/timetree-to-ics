# timetree-ics-feed

TimeTree の公開カレンダーを、今後の予定だけの .ics にする道具（TypeScript のライブラリとコマンド）。公開リポジトリで、誰でも読める。CLAUDE.md はこのファイルへのリンク。

## 持ち主として保つ

このリポジトリは、エージェント（Claude）が持ち主として作り、保つ。設計はエージェントが決め、人（リポジトリの持ち主の高橋）は方向と、外に出る操作の許可を出す。

- 頼まれた変更を今の構造に足すだけで終えない。似た処理はまとめ、近くで見つけた不具合と古い記述はその場で直す。次にここを触るのも自分なので、後で読みやすい形を選ぶ
- 外から見える振る舞い（コマンドの引数と出力・ライブラリの関数の形・.ics に書く欄）は、不具合の直しを除いて黙って変えない。変えるときは版を上げ、README を同じ commit で直す
- git で戻せる手（直す・テストを足す・まとめる）は聞かずに進め、報告に 1 件 1 行で書く。版の札（tag）を打つ・リポジトリの設定を変える・依存を足すは、先に聞く

## 守ること

- **道具は、読むことと .ics にすることだけを持つ。** どこに置くか・いつ作り直すか・止まりをどう見張るかは使う人が決める。README に例として書くのはよいが、置き場（Workers の設定・定期実行の設定）をこのリポジトリに入れない
- **`src/` は `fetch` と標準の関数だけで書く。** Bun・Deno・Cloudflare Workers のどれでも動くようにする。Node の API（`node:*`）は `src/cli.ts` だけで使う
- **テストは TimeTree に行かない。** 返事の形は `test/fixtures.ts` の作り物で再現する。実物の確かめは、手元でコマンドを 1 回流す
- **実在のカレンダーの名前・予定・人の名前をリポジトリに入れない。** 見本は作り物にする。公開リポジトリで、誰がどのカレンダーを見ているかが分かってしまうため
- **TimeTree に負担をかけない。** 読むのは 1 回の作成で 2〜3 回まで。並べて何度も読む・短い間隔で読み直す機能は足さない。非公式の口なので、負担が目立てば塞がれる
- **読めなかったときは、空の .ics を返さず `TimeTreeError` を投げる。** 空を返すと、購読した側の予定が全部消える

## TimeTree の口（2026-11 に確かめた形）

- `GET https://timetreeapp.com/api/v2/public_calendars/<名前>`: カレンダーの名前など
- `GET .../public_calendars/<名前>/public_events?from=<ミリ秒>&to=<ミリ秒>&utc_offset=<秒>`: 予定。1 回 300 件まで、続きは `paging.next` と `cursor=<paging.next_cursor>`
- 無い名前は 400。ログインも鍵も要らない
- 終日の予定は、始まりと終わりが UTC の 0 時で、終わりは最後の日を含む（.ics の DTEND は 1 日足す）
- 本文に U+2028 が入ることがある（.ics では改行にする）
- 口が変わったら `src/timetree.ts` だけを直し、`test/fixtures.ts` の形も合わせる

## 確かめ方

```bash
bun test && bunx tsc --noEmit
bun src/cli.ts <公開カレンダーの名前か URL> -o /tmp/feed.ics   # 実物の確かめ（名前は commit しない）
```

commit の前に lefthook が、commit の書き方・秘密の混入・テストを見る。

## 書き方

- 文書・コメント・エラーの文は日本語で書く（README の頭の 1 段落だけ英語を添える）
- commit の 1 行目は `type(scope): subject`。type は feat fix docs style refactor perf test build ci chore revert improve
- 版は `package.json` の `version` と、`v0.1.0` の形の tag でそろえる。使う側は tag を名指しで取り込む
