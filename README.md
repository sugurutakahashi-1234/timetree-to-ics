# timetree-to-ics

[![npm](https://img.shields.io/npm/v/timetree-to-ics)](https://www.npmjs.com/package/timetree-to-ics)
[![ci](https://github.com/sugurutakahashi-1234/timetree-to-ics/actions/workflows/ci.yml/badge.svg)](https://github.com/sugurutakahashi-1234/timetree-to-ics/actions/workflows/ci.yml)

TimeTree の公開カレンダーを、今後の予定だけの iCalendar（.ics）にする道具。Google カレンダー・Apple のカレンダー・Outlook で購読できる形で出す。

## English

Converts a [TimeTree](https://timetreeapp.com) public calendar into an iCalendar (.ics) file of upcoming events, so you can subscribe to it from Google Calendar, Apple Calendar or Outlook.

```bash
npx timetree-to-ics https://timetreeapp.com/public_calendars/<name> -o calendar.ics   # Node 24+
```

```ts
import { timetreeToIcs } from "timetree-to-ics";
const { ics } = await timetreeToIcs("<name or URL>");
```

- Public calendars only. Your private calendars are not supported.
- Unofficial: it reads the internal API used by the TimeTree web app, which may change without notice.
- To get updates in your calendar app, serve the .ics from a URL (see the examples below) and subscribe to that URL.
- Documentation and messages are in Japanese.

## 注意

> [!WARNING]
> TimeTree の公式の道具ではありません。TimeTree には予定を外へ出す公式の方法が無く（公式の API は 2023 年 12 月に終了）、この道具は TimeTree のウェブ版が内部で使っている非公開の API を読みます。API が変われば、予告なく動かなくなります。
> 予定の内容の著作権はカレンダーの持ち主にあります。作った .ics や、それを置いた URL は自分の購読にだけ使い、人に配らないでください。

## できること

- ログインなしで誰でも見られる公開カレンダーを読み、今日以降の予定を .ics にする（過ぎた予定も載せたいときは `--past-days`）
- .ics に載せるのは、題・メモ・場所・TimeTree の予定へのリンク・繰り返しの指定
- 予定ごとに変わらない ID を付けるので、購読した側では、変わった予定は書き換わり、消えた予定は消える
- 時刻は UTC で書く。カレンダーのアプリが、見ている人の時刻に直して出す
- 予定は「空き時間を埋めない」印を付ける（人の予定なので、自分の空き時間が埋まって見えないように）

## できないこと

- 自分の（公開していない）カレンダーは読めない
- 通知（アラーム）は載せない
- .ics を作るだけで、URL として配ることはしない（下の「購読する」）

## 公開カレンダーの名前

ブラウザで公開カレンダーを開いたときの URL の `public_calendars/` の後ろが名前です。名前の代わりに、URL をそのまま渡しても使えます。

```text
https://timetreeapp.com/public_calendars/example_band
                                         ^^^^^^^^^^^^ 名前
```

## コマンド

Node 24 以上で動く。

```bash
npx timetree-to-ics <名前か URL> -o calendar.ics
```

| オプション | 意味 |
|---|---|
| `-o, --output <ファイル>` | 書き出す先。省くと標準出力 |
| `--past-days <日数>` | 今日より前を何日ぶん載せるか（既定 0） |
| `--future-days <日数>` | 今日から何日先まで載せるか（既定 365） |

## ライブラリ

```bash
npm install timetree-to-ics
```

```ts
import { timetreeToIcs } from "timetree-to-ics";

// 既定は、今日から 365 日先まで
const { ics, calendar, events } = await timetreeToIcs("<名前か URL>");
// ics: .ics の中身（文字列） / calendar: カレンダーの名前など / events: 載せた予定（始まりの順）
```

- 使うのは `fetch` だけなので、`fetch` のある環境（Node・Bun・Deno・Cloudflare Workers）で動く。確かめているのは Node 24
- 投げるエラーは 3 つ
  - `TimeTreeError`: TimeTree を読めなかった（届かない・名前が無い・返事の形が変わった）。空の .ics は返さない
  - `TypeError`: 名前か URL の形が違う
  - `RangeError`: 日数が負
- 予定の一覧だけが要るときは `fetchPublicEvents(名前, { from, to })`、予定の配列を .ics にするだけなら `toIcs(予定の配列, { calendarName })`

## 購読する

手元で作った .ics をカレンダーのアプリに取り込むと、その時点の写しが入るだけで、後の変更は追いかけません。追いかけるには、.ics を URL で配り、その URL を購読します。

1. 下の例のどれかで、.ics を URL で配る
2. Google カレンダーなら、左の「他のカレンダー」の「＋」→「URL で追加」に、その URL を入れる
3. Google カレンダーは半日〜1 日おきに読み直す（間隔は選べない）

URL は自分の購読にだけ使い、人に教えないでください。

### 例 1: Cloudflare Workers で、読まれた時に作る

定期実行が要らず、作り直しを忘れることもない。

```ts
import { TimeTreeError, timetreeToIcs } from "timetree-to-ics";

const CALENDARS = new Set(["<名前>"]); // 配ってよいカレンダーだけを通す

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
      // 失敗を返せば、購読した側は前の内容を残す。理由はログにだけ出す
      if (error instanceof TimeTreeError) {
        console.log(error.message);
        return new Response("Bad Gateway", { status: 502 });
      }
      throw error;
    }
  },
};
```

### 例 2: GitHub Actions で毎日作り、GitHub Pages に置く

骨組みです。Pages の設定は、リポジトリの Settings → Pages で「GitHub Actions」を選んでおく。

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

手元のパソコンの `cron` や `launchd` から上のコマンドを流し、どこかへ置く形でもよい。

## 動かなくなったら

TimeTree の API が変わると動かなくなります。気づいたら [issue](https://github.com/sugurutakahashi-1234/timetree-to-ics/issues) で知らせてもらえると助かります。直し方が分かっていれば、PR も歓迎します（手順は [CONTRIBUTING.md](CONTRIBUTING.md)）。

issue に書いてよいカレンダーの名前は、誰でも見られる公開カレンダーの物だけにしてください。

## ライセンス

MIT
