# timetree-to-ics

[![npm](https://img.shields.io/npm/v/timetree-to-ics)](https://www.npmjs.com/package/timetree-to-ics)
[![ci](https://github.com/sugurutakahashi-1234/timetree-to-ics/actions/workflows/ci.yml/badge.svg)](https://github.com/sugurutakahashi-1234/timetree-to-ics/actions/workflows/ci.yml)

TimeTree の公開カレンダーを、今後の予定だけの iCalendar（.ics）にする道具。Google カレンダー・Apple のカレンダー・Outlook で、URL から購読できる形で出す。

Converts a TimeTree public calendar into an iCalendar (.ics) file of upcoming events, ready to be subscribed to from Google Calendar, Apple Calendar or Outlook.

> [!WARNING]
> TimeTree の公式の道具ではありません。TimeTree には予定を外へ出す公式の方法が無く（公式の API は 2023 年 12 月に終了）、この道具はウェブ版が公開カレンダーの表示に使っている口を読みます。口の形が変われば、予告なく動かなくなります。
> 読むのはログインなしで誰でも見られる公開カレンダーだけです。予定の文章の権利はカレンダーの持ち主にあるので、作った .ics を広く配らないでください。

## できること

- 公開カレンダーの名前か URL を渡すと、今日以降の予定を .ics にする（過ぎた予定は載せない。日数で変えられる）
- 予定の ID を UID にするので、購読した側では、変わった予定は上書きされ、消えた予定は消える
- 時刻は UTC で書く（時差の定義を持たないので、どのカレンダーでも同じ時刻に出る）
- 予定は「空き時間を埋めない」印を付ける（人の予定で、自分の予定が埋まって見えないように）

できないこと

- 自分の（非公開の）カレンダーは読まない
- 通知（アラーム）は載せない

## コマンド

Node 24 以上で動く。

```bash
npx timetree-to-ics https://timetreeapp.com/public_calendars/<名前> -o calendar.ics
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

const { ics, calendar, events } = await timetreeToIcs("<名前か URL>", { pastDays: 0, futureDays: 365 });
```

- 使うのは `fetch` だけなので、Node・Bun・Deno・Cloudflare Workers のどれでも動く
- 読めなかったときは `TimeTreeError` を投げる。空の .ics を返さないのは、購読した側の予定が全部消えるため
- 予定の一覧だけが要るときは `fetchPublicEvents`、予定の配列を .ics にするだけなら `toIcs` を使う

## 購読できる URL にする

カレンダーのアプリは、URL を決まった間隔で読み直す（Google カレンダーは半日〜1 日おきで、間隔は選べない）。この道具は .ics を作るだけなので、どこに置いて、いつ作り直すかは使う人が決める。例を 3 つ挙げる。

### 例 1: Cloudflare Workers で、読まれた時に作る

定期実行が要らず、作り直しを忘れることもない。

```ts
import { TimeTreeError, timetreeToIcs } from "timetree-to-ics";

const CALENDARS = new Set(["<名前>"]); // 自分の Worker で配るカレンダーだけを通す

export default {
  async fetch(request: Request): Promise<Response> {
    const name = new URL(request.url).pathname.match(/^\/([\w-]+)\.ics$/)?.[1];
    if (!name || !CALENDARS.has(name)) return new Response("Not Found", { status: 404 });
    try {
      const { ics } = await timetreeToIcs(name);
      return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8" } });
    } catch (error) {
      // 失敗を返せば、購読した側は前の内容を残す
      if (error instanceof TimeTreeError) return new Response(error.message, { status: 502 });
      throw error;
    }
  },
};
```

### 例 2: GitHub Actions で毎日作り、GitHub Pages に置く

```yaml
on:
  schedule: [{ cron: "0 21 * * *" }]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v7
        with: { node-version: 24 }
      - run: npx timetree-to-ics <名前> -o public/calendar.ics
      # このあと public/ を GitHub Pages に出す
```

### 例 3: 手元のパソコンで定期的に作り、どこかへ置く

`cron` や `launchd` から、上のコマンドを流す。

## 開発

```bash
bun install
bun run check     # テスト（偽の返事で確かめ、TimeTree には行かない）・型の検査・組み立て・Node での起動
```

## ライセンス

MIT
