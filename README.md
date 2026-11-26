# timetree-to-ics

[![npm](https://img.shields.io/npm/v/timetree-to-ics)](https://www.npmjs.com/package/timetree-to-ics)
[![ci](https://github.com/sugurutakahashi-1234/timetree-to-ics/actions/workflows/ci.yml/badge.svg)](https://github.com/sugurutakahashi-1234/timetree-to-ics/actions/workflows/ci.yml)

TimeTree の公開カレンダーを、今後の予定だけを含む iCalendar（.ics）に変換するツールです。Google カレンダー・Apple カレンダー・Outlook で購読できる形式で出力します。

## English

Converts a [TimeTree](https://timetreeapp.com) public calendar into an iCalendar (.ics) file of upcoming events, so you can subscribe to it from Google Calendar, Apple Calendar, or Outlook.

```bash
npx timetree-to-ics https://timetr.ee/p/<name> -o calendar.ics   # Node 24+
```

```ts
import { timetreeToIcs } from "timetree-to-ics";
const { ics } = await timetreeToIcs("<name or URL>");
```

- Accepts a calendar name, `https://timetreeapp.com/public_calendars/<name>`, or the share URL `https://timetr.ee/p/<name>`.
- Public calendars only. Private calendars are not supported.
- Unofficial: it reads the internal API used by the TimeTree web app, which may change without notice.
- To receive updates in your calendar app, serve the .ics file from a URL (see "購読する" below) and subscribe to that URL.
- Documentation and messages are in Japanese.

## 注意

> [!WARNING]
> TimeTree の公式ツールではありません。TimeTree には予定をエクスポートする公式の方法がありません（公式 API は 2023 年 12 月に終了しました）。このツールは TimeTree の Web 版が内部で使っている非公開 API を読み取ります。API が変更されると、予告なく動かなくなります。
> 予定の内容の著作権はカレンダーの作成者にあります。生成した .ics や、それを公開した URL は自分で購読するためだけに使い、第三者には共有しないでください。

## できること

- ログインなしで誰でも閲覧できる公開カレンダーを読み取り、今より後に終わる予定を .ics に変換します。過去の予定も含めたい場合は `--past-days` を指定します
- .ics に含めるのは、タイトル・メモ・場所・TimeTree の予定へのリンク・繰り返しの設定です
- 予定ごとに固定の ID を付けるので、購読している側では、変更された予定は更新され、削除された予定は消えます
- 時刻は UTC で出力します。カレンダーアプリが、利用者のタイムゾーンに合わせて表示します
- 予定には「空き時間をふさがない」設定を付けます。他人の予定で、自分の空き時間が埋まって見えないようにするためです

## できないこと

- 自分の（公開していない）カレンダーは読み取れません
- 通知（アラーム）は含めません
- .ics を生成するだけで、URL での配信は行いません。配信の方法は、下の「購読する」を参照してください
- ブラウザからは呼べません。TimeTree の API がほかのサイトからの読み取りを許していないためです

## 使い方の例

好きなものを使ってください。どれも、AI エージェント（Claude Code・Codex・Gemini CLI など）にそのまま渡せる頼み方を付けています。`<名前>` の所は、TimeTree のアプリの「共有」で出る URL に置き換えてください。

### 推しのライブ予定を、Google カレンダーで追いかける

公開カレンダーに予定が足されたり、時間が変わったり、中止になったりしても、Google カレンダーが自動で追従します。毎週のように予定が増えるカレンダーに向いています。

```text
TimeTree の公開カレンダー https://timetr.ee/p/<名前> を、Google カレンダーで購読して更新に追従させたい。
npm の timetree-to-ics の README の「購読する」から方法を 1 つ選んで、URL を作るところまでやって。
```

### いくつかの公開カレンダーを、まとめて追いかける

カレンダーごとに URL を作り、それぞれを購読します。例 1（Cloudflare Workers）なら、1 つの Worker で全部を配信できます。

```text
TimeTree の公開カレンダー https://timetr.ee/p/<名前1> と https://timetr.ee/p/<名前2> を、Google カレンダーでそれぞれ購読したい。
npm の timetree-to-ics の README の例 1 で、1 つの Worker から両方を配信するようにして。
```

### 今ある予定を、一度だけ取り込む

追従は要らず、今の予定を写したいだけなら、URL は要りません。作った .ics を、Google カレンダーの「設定」→「インポート」で取り込みます。

```bash
npx -y timetree-to-ics https://timetr.ee/p/<名前> -o calendar.ics
```

### 時刻のある予定だけ・過ぎた予定も残す

コマンドなら `--past-days 30` で、過ぎてから 30 日以内の予定も残せます。終日の予定を外すなど、もっと細かく絞るときは、ライブラリの `filter` を使います。

```text
timetree-to-ics のライブラリで、https://timetr.ee/p/<名前> の予定のうち、時刻のある予定だけを .ics にするスクリプトを書いて。
```

## よくある疑問

| 疑問 | 答え |
|---|---|
| 予定が足されたり変わったりしたら、反映されますか | はい。URL で購読していれば、次の再取得で反映されます。Google カレンダーの再取得は半日〜1 日おきです |
| TimeTree で消えた予定は、消えますか | はい。.ics に無くなった予定は、購読している側からも消えます |
| 終わった予定はどうなりますか | 終わった予定は .ics から外れるので、購読している側からも消えます。残したいときは `--past-days` を指定します |
| 繰り返しの予定は扱えますか | はい。繰り返しの設定をそのまま .ics に含めるので、カレンダーアプリが展開して表示します |
| 通知は来ますか | .ics には通知を含めません。Google カレンダーなら、購読したカレンダーの設定の「予定の通知」で、カレンダーごとに通知を付けられます |
| すぐに反映させたいです | Google カレンダーでは、再取得の間隔を変えられません。Apple カレンダーと Outlook は、.ics に書いた間隔（6 時間）を目安に再取得します |
| インポートした予定は追従しますか | いいえ。インポートはその時点のコピーです。追従させたいときは、URL で購読します |

## 公開カレンダーの名前

次のどの形でも渡せます。TimeTree のアプリで公開カレンダーを「共有」すると出てくる短い URL を、そのまま貼るのがいちばん簡単です。

| 形 | 例 |
|---|---|
| アプリの共有で出る短い URL | `https://timetr.ee/p/example_band` |
| ブラウザで開いたときの URL | `https://timetreeapp.com/public_calendars/example_band` |
| 名前だけ | `example_band` |

## コマンド

Node 24 以上で動作します。

```bash
npx timetree-to-ics https://timetr.ee/p/<名前> -o calendar.ics
```

| オプション | 説明 |
|---|---|
| `-o, --output <ファイル>` | 出力先のファイル。省略すると標準出力 |
| `--past-days <日数>` | 今より何日前までに終わった予定も含めるか（デフォルト 0） |
| `--future-days <日数>` | 今から何日先までに始まる予定を含めるか（デフォルト 365） |

終了コードは、成功が 0、TimeTree を読めなかったときと入力が正しくないときが 1、使い方の誤りが 2 です。

## ライブラリ

```bash
npm install timetree-to-ics
```

```ts
import { ICS_CONTENT_TYPE, timetreeToIcs } from "timetree-to-ics";

const { ics, calendar, events } = await timetreeToIcs("https://timetr.ee/p/<名前>");
// ics: .ics の内容（文字列） / calendar: カレンダーの名前など / events: 含めた予定（開始時刻の順）

// HTTP で返すとき
return new Response(ics, { headers: { "content-type": ICS_CONTENT_TYPE } });
```

主なオプションは次のとおりです。すべて省略できます。

| オプション | 説明 |
|---|---|
| `pastDays` / `futureDays` | 含める範囲の日数（デフォルト 0 / 365。0〜3650） |
| `filter` | 含める予定をさらに絞る関数。例 `(event) => !event.allDay` |
| `ics` | .ics の作り方。`calendarName`（表示名の上書き）・`refreshInterval`（例 `PT6H`） |
| `signal` | 途中でやめるための `AbortSignal` |

スローするエラーは 3 種類です。

- `TimeTreeError`: TimeTree から取得できなかった。理由は `kind` で分かります
  - `network`: 接続できなかった（元のエラーは `cause`）
  - `http`: TimeTree がエラーを返した（番号は `status`。名前が違うと 400、読みすぎると 429）
  - `format`: レスポンスの形式が変わった
- `TypeError`: 名前または URL の形式が正しくない
- `RangeError`: 日数や日付が範囲の外

読み取れなかったときに空の .ics を返すことはありません。空の .ics を配信すると、購読している側の予定がすべて消えてしまうためです。

予定の一覧だけが必要な場合は `fetchPublicEvents(名前, { from, to })` を、予定の配列を .ics に変換するだけなら `toIcs(予定の配列, { calendarName })` を使います。使えるのは `fetch` がある環境（Node・Bun・Deno・Cloudflare Workers）で、動作を確認しているのは Node 24 です。

## 購読する

手元で生成した .ics をカレンダーアプリにインポートしても、その時点のコピーが取り込まれるだけで、以降の変更は反映されません。変更を反映させるには、.ics をインターネットから読める URL に置き、その URL をカレンダーアプリで購読します。

URL を作る方法は、次の 3 つから選べます。どれも無料の範囲で使えます。

| 方法 | 向いている人 | 定期実行 | 必要なもの |
|---|---|---|---|
| 例 1: Cloudflare Workers | 一度置いたら放っておきたい | 不要（読まれた時に生成） | Cloudflare のアカウント |
| 例 2: 手元のパソコンで定期実行し、Gist に置く | サーバーを持ちたくない | 手元の `cron` など | GitHub のアカウントと `gh` コマンド |
| 例 3: GitHub Actions で毎日生成し、Pages に置く | パソコンを開いていない日も更新したい | GitHub Actions | 公開リポジトリ |

定期実行は、同じコマンドを流すだけです。Claude Code や Gemini CLI のような AI エージェントの定期実行でも動かせますが、毎回 AI を動かす必要はありません。AI は最初の設定に使い、定期実行は `cron` や GitHub Actions に任せる方が安上がりです。

URL ができたら、Google カレンダーの場合は、左の「他のカレンダー」の「＋」→「URL で追加」に入力します。Google カレンダーは半日〜1 日おきに再取得し、この間隔は変更できません。URL は自分で購読するためだけに使い、第三者には教えないでください。

### 例 1: Cloudflare Workers で、読まれた時に生成する

定期実行が不要で、再生成を忘れる心配もありません。[Cloudflare Workers のプロジェクトを作り](https://developers.cloudflare.com/workers/get-started/guide/)、`npm install timetree-to-ics` をしてから、`src/index.ts` を次のようにして deploy します。購読する URL は `https://<Worker の名前>.<アカウントのサブドメイン>.workers.dev/<名前>.ics` です。

```ts
import { ICS_CONTENT_TYPE, TimeTreeError, timetreeToIcs } from "timetree-to-ics";

const CALENDARS = new Set(["<名前>"]); // 配信してよいカレンダーだけを通す

export default {
  async fetch(request: Request): Promise<Response> {
    const name = new URL(request.url).pathname.match(/^\/([\w-]+)\.ics$/)?.[1];
    if (!name || !CALENDARS.has(name)) return new Response("Not Found", { status: 404 });
    try {
      const { ics } = await timetreeToIcs(name);
      return new Response(ics, { headers: { "content-type": ICS_CONTENT_TYPE } });
    } catch (error) {
      // エラーを返せば、購読している側には前回の内容が残る。原因はログにだけ出力する
      if (error instanceof TimeTreeError) {
        console.log(error.kind, error.message);
        return new Response("Bad Gateway", { status: 502 });
      }
      throw error;
    }
  },
};
```

### 例 2: 手元のパソコンで定期実行し、Gist に置く

最初に 1 回だけ、.ics を作って非公開の Gist に上げます。

```bash
mkdir -p ~/timetree && cd ~/timetree
npx -y timetree-to-ics https://timetr.ee/p/<名前> -o calendar.ics
gh gist create --secret calendar.ics   # 出てきた URL の最後の部分が Gist の ID
```

購読する URL は `https://gist.githubusercontent.com/<GitHub のユーザー名>/<Gist の ID>/raw/calendar.ics` です。非公開の Gist は検索には出ませんが、URL を知っていれば誰でも読めます。

あとは次のコマンドを、`cron`（Mac なら `launchd` でも可）で 1 日 1 回実行します。パソコンが閉じている日は更新されません。

```bash
cd ~/timetree && npx -y timetree-to-ics https://timetr.ee/p/<名前> -o calendar.ics && gh gist edit <Gist の ID> --filename calendar.ics calendar.ics
```

### 例 3: GitHub Actions で毎日生成し、GitHub Pages に置く

公開リポジトリに `.github/workflows/calendar.yml` として置きます。リポジトリの Settings → Pages で「GitHub Actions」を選んでおき、最初の 1 回は Actions のタブから手動で実行します。購読する URL は `https://<GitHub のユーザー名>.github.io/<リポジトリ名>/calendar.ics` です。

```yaml
name: calendar
on:
  schedule: [{ cron: "0 21 * * *" }] # UTC の 21 時 = 日本時間の 6 時
  workflow_dispatch:
permissions: { pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/setup-node@v7
        with: { node-version: 24 }
      - run: mkdir -p public && npx -y timetree-to-ics https://timetr.ee/p/<名前> -o public/calendar.ics
      - uses: actions/upload-pages-artifact@v5
        with: { path: public }
      - uses: actions/deploy-pages@v5
```

GitHub Pages の URL は誰でも読めます。また、リポジトリに 60 日間 commit が無いと、GitHub が定期実行を止めます。止まったら、Actions のタブから有効に戻してください。

## AI エージェント向けの手順

頼み方の例は「使い方の例」にあります。頼まれた AI エージェントは、次の順に進めてください。

1. `npx -y timetree-to-ics <名前か URL> | grep -c BEGIN:VEVENT` で、予定が読めることと件数を確かめる
2. 「購読する」の 3 つの方法から、利用者に 1 つ選んでもらう。アカウントの有無と、パソコンを開いていない日も更新したいかを聞く
3. URL を作り、`curl -s <URL> | head -3` で `BEGIN:VCALENDAR` が返ることを確かめる
4. Google カレンダーへの登録（「URL で追加」）とアカウントの作成は、利用者に頼む

## 動かなくなったら

TimeTree の API が変更されると動かなくなります。気づいた場合は、[issue](https://github.com/sugurutakahashi-1234/timetree-to-ics/issues) で報告していただけると助かります。修正方法が分かる場合は、PR も歓迎します。手順は [CONTRIBUTING.md](CONTRIBUTING.md) にあります。

issue に書くカレンダーの名前は、誰でも閲覧できる公開カレンダーのものだけにしてください。

## ライセンス

MIT
