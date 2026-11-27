# timetree-to-ics

[![npm](https://img.shields.io/npm/v/timetree-to-ics)](https://www.npmjs.com/package/timetree-to-ics)
[![ci](https://github.com/sugurutakahashi-1234/timetree-to-ics/actions/workflows/ci.yml/badge.svg)](https://github.com/sugurutakahashi-1234/timetree-to-ics/actions/workflows/ci.yml)

TimeTree の公開カレンダーを iCalendar（.ics）形式に変換するツールです。デフォルトでは今後の予定のみを出力します。Google カレンダー・Apple カレンダー・Outlook で購読できます。

## English

Converts a [TimeTree](https://timetreeapp.com) public calendar into an iCalendar (.ics) file containing upcoming events, so you can subscribe to it in Google Calendar, Apple Calendar, or Outlook.

```bash
npx timetree-to-ics https://timetr.ee/p/<name> -o calendar.ics   # Node 24+
```

```ts
import { timetreeToIcs } from "timetree-to-ics";
const { ics } = await timetreeToIcs("<name or URL>");
```

- Accepts a calendar name, `https://timetreeapp.com/public_calendars/<name>`, or the share URL `https://timetr.ee/p/<name>`.
- Public calendars only. Private calendars are not supported.
- Unofficial tool: uses the internal API of the TimeTree web app, which may change without notice.
- To receive automatic updates in your calendar app, host the .ics file at a URL (see "購読する" below) and subscribe to that URL.
- Documentation and messages are in Japanese.

## 注意事項

> [!WARNING]
> - **非公式ツールです**: TimeTree には予定をエクスポートする公式機能がありません（公式 API は 2023 年 12 月に終了しました）。このツールは Web 版の非公開 API からデータを取得します。API の仕様変更により、予告なく動作しなくなることがあります。
> - **個人利用にとどめてください**: 予定の権利はカレンダーの作成者にあります。生成した .ics ファイルは、ご自身の購読にのみ使ってください。Web 上に置いた .ics ファイルは、URL を知る人なら誰でも閲覧できます。URL は第三者に共有せず、他人の予定を再配布するために公開しないでください。
> - **利用規約の確認**: TimeTree の利用規約に沿うかどうかは、利用者ご自身で判断してください。

## できること

- ログインなしで閲覧できる公開カレンダーを読み取り、進行中と今後の予定を .ics に変換します。終了時刻が現在より後の予定が対象です。過去の予定も含める場合は `--past-days` を指定してください。
- .ics に含まれる項目は、タイトル・メモ・場所・TimeTree の予定へのリンク・繰り返し設定です。
- 予定ごとに固定の ID を付与します。そのため購読先のカレンダーアプリでは、変更分は上書きされ、削除分は自動で消えます。
- 時刻は UTC で出力するため、アプリ側で利用者のタイムゾーンに合わせて表示されます。ただし繰り返し予定は、曜日ずれを防ぐため予定のタイムゾーン（例: `Asia/Tokyo`）で出力します。夏時間のないタイムゾーンに限ります。
- 各予定は「空き時間」扱いで出力します。他人の予定で自分の空き時間が埋まって見えないようにするためです。

## できないこと

- 非公開カレンダー（自分やグループ内のプライベートなカレンダー）は取得できません。
- 通知（アラーム）は含まれません。
- .ics ファイルの生成のみで、URL での配信機能はありません。配信方法は後述の「購読する」を参照してください。
- ブラウザからは直接呼び出せません。TimeTree の API が他サイトからのクロスオリジンアクセス（CORS）を許可していないためです。

## 使い方の例

目的に合った使い方を選んでください。自分で進める手順と、AI エージェント（Claude Code・Codex・Gemini CLI など）に渡せる指示文（プロンプト）の例を載せています。`https://timetr.ee/p/<名前>`（`<名前1>`・`<名前2>` も同様）は、TimeTree アプリの「共有」で取得した URL に置き換えてください。

### 取引先や団体の公開カレンダーを Google カレンダーに表示する

店舗の営業日、施設やコミュニティのイベント、チームの試合日程などの公開予定を、普段の Google カレンダーに重ねて表示できます。公開カレンダーの予定が追加・変更・中止されると自動で反映されるため、頻繁に更新されるカレンダーに向いています。自分で進める場合は、「購読する」の 3 つの方法から 1 つを選んで URL を用意し、Google カレンダーの「URL で追加」に登録します。

```text
TimeTree の公開カレンダー https://timetr.ee/p/<名前> を、Google カレンダーで購読して更新に追従させたい。
npm の timetree-to-ics の README の「購読する」から方法を 1 つ選んで、URL を作るところまでやって。
```

### 複数の公開カレンダーをまとめて購読する

カレンダーごとに配信用 URL を用意し、それぞれ購読します。「購読する」の例 1（Cloudflare Workers）なら、コードの `CALENDARS` に名前を並べるだけで、1 つの Worker から複数配信できます。

```text
TimeTree の公開カレンダー https://timetr.ee/p/<名前1> と https://timetr.ee/p/<名前2> を、Google カレンダーでそれぞれ購読したい。
npm の timetree-to-ics の README の例 1 で、1 つの Worker から両方を配信するようにして。
```

### 現在の予定を一度だけ取り込む

自動更新が不要で、現在の予定だけを取り込みたいなら配信用 URL は用意する必要はありません。生成した .ics ファイルを、Google カレンダーの「設定」→「インポート」から取り込みます。

```bash
npx -y timetree-to-ics https://timetr.ee/p/<名前> -o calendar.ics
```

### 時刻のある予定だけに絞る・過去の予定も残す

コマンドに `--past-days 30` を付けると、終了から 30 日以内の過去の予定も残せます。終日の予定を除外するなど細かく絞り込む場合は、ライブラリの `filter` オプションを使います。

```text
timetree-to-ics のライブラリで、https://timetr.ee/p/<名前> の予定のうち、時刻のある予定だけを .ics にするスクリプトを書いて。
```

## よくある質問

| 質問 | 回答 |
|---|---|
| 予定が追加・変更されたら反映されますか？ | はい。URL で購読していれば、次回の再取得時に反映されます。Google カレンダーの再取得間隔は半日〜1 日です。 |
| TimeTree で削除された予定は消えますか？ | はい。.ics からなくなった予定は、購読先のカレンダーからも削除されます。 |
| 終了した予定はどうなりますか？ | デフォルトでは終了した予定が .ics から除外され、購読先からも消えます。過去の予定を残す場合は `--past-days` を指定してください。 |
| 時刻のある予定が終日の予定として表示されます | TimeTree 側で終日の予定として登録されている可能性があります。このツールは TimeTree に登録された日時をそのまま出力します。メモに書かれた時刻は、予定の説明欄で確認できます。 |
| 繰り返しの予定は扱えますか？ | はい。繰り返し設定をそのまま .ics に出力するため、カレンダーアプリ側で展開して表示されます。 |
| 通知は届きますか？ | .ics 自体には通知を含めません。Google カレンダーでは、購読したカレンダー設定の「予定の通知」からカレンダー単位で設定できます。 |
| 更新をすぐに反映させたいです | Google カレンダーでは再取得の間隔を変更できません。Apple カレンダーと Outlook は、.ics に記載された間隔（6 時間）を目安に再取得します。 |
| インポートした予定は自動更新されますか？ | いいえ。インポートはその時点のコピーを取り込む操作です。更新を自動反映させたい場合は、URL で購読してください。 |

## 公開カレンダーの指定方法

公開カレンダーは、次のどの形式でも指定できます。TimeTree アプリの「共有」で取得できる短縮 URL を、そのまま貼り付けるのが最も簡単です。

この README の `<名前>` は、URL の `/p/` や `/public_calendars/` の後ろの部分を指します。カレンダーの表示名とは別です。

| 形式 | 例 |
|---|---|
| アプリの「共有」で取得できる短縮 URL | `https://timetr.ee/p/example_team` |
| ブラウザで開いたときの URL | `https://timetreeapp.com/public_calendars/example_team` |
| 名前のみ | `example_team` |

## コマンド（CLI）

Node.js 24 以上で動作します。

```bash
npx timetree-to-ics https://timetr.ee/p/<名前> -o calendar.ics
```

| オプション | 説明 |
|---|---|
| `-o, --output <ファイル>` | 出力先のファイルパス。省略時は標準出力に出力 |
| `--past-days <日数>` | 現在より何日前までに終了した予定を含めるか（デフォルト: 0） |
| `--future-days <日数>` | 現在より何日先までに開始する予定を含めるか（デフォルト: 365） |
| `-v, --version` | バージョンを表示 |

終了コードは次のとおりです。

- `0`: 成功
- `1`: TimeTree からの取得失敗・入力値の不正・ファイルへの書き込み失敗
- `2`: 引数やオプション指定の誤り

出力例は次のとおりです（一部の行を省略しています）。

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//timetree-to-ics//EN
X-WR-CALNAME:Example Team
REFRESH-INTERVAL;VALUE=DURATION:PT6H
BEGIN:VEVENT
UID:100@timetree-to-ics
DTSTART:20261201T090000Z
DTEND:20261201T110000Z
SUMMARY:定例ミーティング
DESCRIPTION:会場 3F 会議室 / 資料は前日に共有\n\nhttps://timetr.ee/p/example_team/100
TRANSP:TRANSPARENT
END:VEVENT
END:VCALENDAR
```

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

`timetreeToIcs` の主なオプションは次のとおりです。全て省略できます。

| オプション | 説明 |
|---|---|
| `pastDays` / `futureDays` | 取得対象とする範囲の日数（デフォルト: 0 / 365、指定可能範囲: 0〜3650） |
| `filter` | 含める予定を絞り込むフィルタ関数（例: `(event) => !event.allDay`） |
| `ics` | .ics の生成オプション。`calendarName`（表示名の上書き）、`refreshInterval`（例: `PT6H`） |
| `signal` | 処理を中断するための `AbortSignal` |

失敗時はエラーをスローし、空の .ics は返しません。空の .ics を配信すると、購読先のカレンダーアプリから既存の予定が全て消えてしまうためです。

| エラー | スローされる場合 |
|---|---|
| `TimeTreeError` | TimeTree から取得できなかった場合（原因は `kind` プロパティで判別できます） |
| `TypeError` | 名前または URL の形式が正しくない場合 |
| `RangeError` | 日数や日付が指定可能範囲外の場合と、範囲内の予定が 6000 件を超えた場合 |

各プロパティの詳細は、型定義のコメントに記載しています。

予定の一覧のみを取得する場合は `fetchPublicEvents(名前, { from, to })` を使えます。予定の配列から .ics 文字列を生成する場合は `toIcs(予定の配列, { calendarName })` を使ってください。動作環境は `fetch` が使えるランタイム（Node.js・Bun・Deno・Cloudflare Workers）で、Node.js 24 で動作確認済みです。

## 購読する

手元で作った .ics をインポートしても、その時点のコピーが取り込まれるだけで、以降の変更は反映されません。変更を自動反映させるには、インターネット上からアクセスできる URL で .ics を配信し、カレンダーアプリで購読します。

配信用 URL を用意する方法は次の 3 つです。いずれも各サービスの無料枠内で利用できます。

| 方法 | 向いている人 | 定期実行 | 必要なもの |
|---|---|---|---|
| 例 1: Cloudflare Workers | 一度設定したら放置したい | 不要（アクセス時に生成） | Cloudflare アカウント |
| 例 2: 手元のパソコンで定期実行し、Gist で配信 | サーバーを用意したくない | 手元の `cron` など | GitHub アカウントと `gh` コマンド |
| 例 3: GitHub Actions で毎日生成し、GitHub Pages で配信 | パソコンを起動していない日も更新したい | GitHub Actions | GitHub の公開リポジトリ |

定期実行で行うのは、同じコマンドの再実行だけです。

URL を用意できたら、Google カレンダーでは左メニューの「他のカレンダー」横の「＋」→「URL で追加」から登録します。Google カレンダーの再取得間隔は半日〜1 日おきで、この間隔は変更できません。なお、URL はご自身の購読のみに使い、第三者には共有しないでください。

### 例 1: Cloudflare Workers でアクセス時に生成する

定期実行が不要で、再生成を忘れる心配もありません。[Cloudflare Workers のプロジェクトを作り](https://developers.cloudflare.com/workers/get-started/guide/)、`npm install timetree-to-ics` を実行してから `src/index.ts` を次のように書き換えてデプロイします。購読用 URL は `https://<Worker の名前>.<アカウントのサブドメイン>.workers.dev/<名前>.ics` です。コードと URL の `<名前>` には、公開カレンダーの名前（共有 URL の末尾）を入れてください。

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

### 例 2: 手元のパソコンで定期実行し、Gist で配信する

初回のみ、.ics ファイルを生成してシークレット Gist（非公開 Gist）にアップロードします。

```bash
mkdir -p ~/timetree && cd ~/timetree
npx -y timetree-to-ics https://timetr.ee/p/<名前> -o calendar.ics
gh gist create --secret calendar.ics   # 出てきた URL の最後の部分が Gist の ID
```

購読用 URL は `https://gist.githubusercontent.com/<GitHub のユーザー名>/<Gist の ID>/raw/calendar.ics` です。シークレット Gist は検索結果に出ませんが、URL を知っていれば誰でも閲覧できます。

あとは次のコマンドを、`cron`（macOS では `launchd` でも可）で 1 日 1 回実行するよう設定します。パソコンが起動していない日は更新されません。

```bash
cd ~/timetree && npx -y timetree-to-ics https://timetr.ee/p/<名前> -o calendar.ics && gh gist edit <Gist の ID> --filename calendar.ics calendar.ics
```

### 例 3: GitHub Actions で毎日生成し、GitHub Pages で配信する

GitHub の公開リポジトリに `.github/workflows/calendar.yml` を作成し、次の内容を保存します。リポジトリの Settings → Pages で Source に「GitHub Actions」を選び、初回は Actions タブから手動実行してください。購読用 URL は `https://<GitHub のユーザー名>.github.io/<リポジトリ名>/calendar.ics` です。

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

GitHub Pages の URL は誰でも閲覧できます。また、リポジトリに 60 日間コミットがないと、GitHub の仕様で定期実行が自動停止されます。停止した場合は、Actions タブからワークフローを再度有効にしてください。

## AI エージェント向けの手順

ユーザーからの指示文の例は「使い方の例」にあります。依頼を受けた AI エージェントは、次の手順で進めてください。ユーザーに任せるのは、方法の選択とアカウントの作成・サインインだけです。それ以外の作業は、エージェントが最後まで行います。

1. Node.js 24 以上が使えることを確認します。Node.js や必要なコマンド（`gh` など）がない場合は、ユーザーに伝えた上でインストールします。
2. `npx -y timetree-to-ics <名前か URL> | grep -c BEGIN:VEVENT` を実行し、予定が取得できることと件数を確認します。
3. 「購読する」にある 3 つの方法から、ユーザーに 1 つ選んでもらいます。その際、各サービスのアカウントの有無と、パソコンを起動していない日も更新したいかを確認します。
4. 配信用 URL を作成し、`curl -s <URL> | head -3` で `BEGIN:VCALENDAR` が返ることを確認します。
5. 配信用 URL をカレンダーアプリに登録します。ブラウザを操作できる場合は、Google カレンダーの「[URL で追加](https://calendar.google.com/calendar/r/settings/addbyurl)」に入力し、追加を確認します。操作できない場合は、URL と登録方法をユーザーに伝えます。

## 動かなくなったら

TimeTree の API 仕様が変わると、このツールは動かなくなることがあります。気づいた場合は、[Issue](https://github.com/sugurutakahashi-1234/timetree-to-ics/issues) から報告していただけると助かります。修正方法が分かる場合は Pull Request（PR）も歓迎します。手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

Issue に書くカレンダーの名前は、誰でも閲覧できる公開カレンダーのものだけにしてください。

## バージョンと後方互換性

後方互換性は重視していません。バージョン番号は Semantic Versioning に従いますが、不要な機能やオプションは移行期間なく削除するため、メジャーバージョンが頻繁に上がります。安定して使いたい場合は、バージョンを固定してインストールしてください（例: `npm install timetree-to-ics@2.0.3`）。変更内容は [Releases](https://github.com/sugurutakahashi-1234/timetree-to-ics/releases) で確認できます。

## ライセンス

MIT
