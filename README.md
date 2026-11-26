# timetree-to-ics

[![npm](https://img.shields.io/npm/v/timetree-to-ics)](https://www.npmjs.com/package/timetree-to-ics)
[![ci](https://github.com/sugurutakahashi-1234/timetree-to-ics/actions/workflows/ci.yml/badge.svg)](https://github.com/sugurutakahashi-1234/timetree-to-ics/actions/workflows/ci.yml)

TimeTree の公開カレンダーを、今後の予定だけを含む iCalendar（.ics）に変換するツールです。Google カレンダー・Apple カレンダー・Outlook で購読できる形式で出力します。

## English

Converts a [TimeTree](https://timetreeapp.com) public calendar into an iCalendar (.ics) file of upcoming events, so you can subscribe to it from Google Calendar, Apple Calendar, or Outlook.

```bash
npx timetree-to-ics https://timetreeapp.com/public_calendars/<name> -o calendar.ics   # Node 24+
```

```ts
import { timetreeToIcs } from "timetree-to-ics";
const { ics } = await timetreeToIcs("<name or URL>");
```

- Public calendars only. Private calendars are not supported.
- Unofficial: it reads the internal API used by the TimeTree web app, which may change without notice.
- To receive updates in your calendar app, serve the .ics file from a URL (see the examples below) and subscribe to that URL.
- Documentation and messages are in Japanese.

## 注意

> [!WARNING]
> TimeTree の公式ツールではありません。TimeTree には予定をエクスポートする公式の方法がありません（公式 API は 2023 年 12 月に終了しました）。このツールは TimeTree の Web 版が内部で使っている非公開 API を読み取ります。API が変更されると、予告なく動かなくなります。
> 予定の内容の著作権はカレンダーの作成者にあります。生成した .ics や、それを公開した URL は自分で購読するためだけに使い、第三者には共有しないでください。

## できること

- ログインなしで誰でも閲覧できる公開カレンダーを読み取り、今日以降の予定を .ics に変換します。過去の予定も含めたい場合は `--past-days` を指定します
- .ics に含めるのは、タイトル・メモ・場所・TimeTree の予定へのリンク・繰り返しの設定です
- 予定ごとに固定の ID を付けるので、購読している側では、変更された予定は更新され、削除された予定は消えます
- 時刻は UTC で出力します。カレンダーアプリが、利用者のタイムゾーンに合わせて表示します
- 予定には「空き時間をふさがない」設定を付けます。他人の予定で、自分の空き時間が埋まって見えないようにするためです

## できないこと

- 自分の（公開していない）カレンダーは読み取れません
- 通知（アラーム）は含めません
- .ics を生成するだけで、URL での配信は行いません。配信の方法は、下の「購読する」を参照してください

## 公開カレンダーの名前

ブラウザで公開カレンダーを開いたときの URL のうち、`public_calendars/` より後ろの部分が名前です。名前の代わりに、URL をそのまま渡すこともできます。

```text
https://timetreeapp.com/public_calendars/example_band
                                         ^^^^^^^^^^^^ 名前
```

## コマンド

Node 24 以上で動作します。

```bash
npx timetree-to-ics <名前か URL> -o calendar.ics
```

| オプション | 説明 |
|---|---|
| `-o, --output <ファイル>` | 出力先のファイル。省略すると標準出力 |
| `--past-days <日数>` | 今日より何日前までの予定を含めるか（デフォルト 0） |
| `--future-days <日数>` | 今日から何日先までの予定を含めるか（デフォルト 365） |

## ライブラリ

```bash
npm install timetree-to-ics
```

```ts
import { timetreeToIcs } from "timetree-to-ics";

// デフォルトは、今日から 365 日先まで
const { ics, calendar, events } = await timetreeToIcs("<名前か URL>");
// ics: .ics の内容（文字列） / calendar: カレンダーの名前など / events: 含めた予定（開始日時の順）
```

- 依存しているのは `fetch` だけなので、`fetch` が使える環境（Node・Bun・Deno・Cloudflare Workers）で動作します。動作を確認しているのは Node 24 です
- スローするエラーは 3 種類です
  - `TimeTreeError`: TimeTree から取得できなかった（接続できない・指定した名前のカレンダーがない・レスポンスの形式が変わった）。空の .ics は返しません
  - `TypeError`: 名前または URL の形式が正しくない
  - `RangeError`: 日数が負の値
- 予定の一覧だけが必要な場合は `fetchPublicEvents(名前, { from, to })`、予定の配列を .ics に変換するだけなら `toIcs(予定の配列, { calendarName })` を使います

## 購読する

手元で生成した .ics をカレンダーアプリにインポートしても、その時点のコピーが取り込まれるだけで、以降の変更は反映されません。変更を反映させるには、.ics を URL で配信し、その URL を購読します。

1. 下の例のいずれかの方法で、.ics を URL で配信します
2. Google カレンダーの場合は、左の「他のカレンダー」の「＋」→「URL で追加」に、その URL を入力します
3. Google カレンダーは半日〜1 日おきに再取得します（間隔は変更できません）

URL は自分で購読するためだけに使い、第三者には教えないでください。

### 例 1: Cloudflare Workers で、リクエスト時に生成する

定期実行が不要で、再生成を忘れる心配もありません。

```ts
import { TimeTreeError, timetreeToIcs } from "timetree-to-ics";

const CALENDARS = new Set(["<名前>"]); // 配信してよいカレンダーだけを通す

export default {
  async fetch(request: Request): Promise<Response> {
    const name = new URL(request.url).pathname.match(/^\/([\w-]+)\.ics$/)?.[1];
    if (!name || !CALENDARS.has(name)) return new Response("Not Found", { status: 404 });
    try {
      const { ics } = await timetreeToIcs(name);
      return new Response(ics, {
        headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store" },
      });
    } catch (error) {
      // エラーを返せば、購読している側には前回の内容が残る。原因はログにだけ出力する
      if (error instanceof TimeTreeError) {
        console.log(error.message);
        return new Response("Bad Gateway", { status: 502 });
      }
      throw error;
    }
  },
};
```

### 例 2: GitHub Actions で毎日生成し、GitHub Pages で配信する

最小限のひな形です。Pages の設定は、リポジトリの Settings → Pages で「GitHub Actions」を選んでおきます。

```yaml
on:
  schedule: [{ cron: "0 21 * * *" }] # UTC の 21 時 = 日本時間の 6 時
permissions: { pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/setup-node@v7
        with: { node-version: 24 }
      - run: mkdir -p public && npx timetree-to-ics <名前> -o public/calendar.ics
      - uses: actions/upload-pages-artifact@v5
        with: { path: public }
      - uses: actions/deploy-pages@v5
```

手元のマシンの `cron` や `launchd` から上のコマンドを実行し、任意の場所に配置する方法でもかまいません。

## 動かなくなったら

TimeTree の API が変更されると動かなくなります。気づいた場合は、[issue](https://github.com/sugurutakahashi-1234/timetree-to-ics/issues) で報告していただけると助かります。修正方法が分かる場合は、PR も歓迎します。手順は [CONTRIBUTING.md](CONTRIBUTING.md) にあります。

issue に書くカレンダーの名前は、誰でも閲覧できる公開カレンダーのものだけにしてください。

## ライセンス

MIT
