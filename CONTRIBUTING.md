# 貢献のしかた

issue も PR も歓迎します。特に、TimeTree の API が変わって動かなくなったときの報告と修正は助かります。

## 手元で動かす

[Bun](https://bun.sh) と Node.js 24 以上が必要です。

```bash
bun install
bun run check     # テスト・型の検査・ビルド・Node での起動
node dist/cli.js <公開カレンダーの名前か URL>   # 実物で確かめる
```

GitHub Actions の設定（`.github/workflows`）を変えるときは、[mise](https://mise.jdx.dev) で点検ツール（`mise.toml`）を入れておくと、commit の前に同じ点検が動きます。入れなくても、PR の CI が同じ点検をします。

## 決まり

- テストは TimeTree の API を呼ばない。レスポンスは `test/fixtures.ts` のテスト用データで再現する
- 実在の公開カレンダーの名前をリポジトリに入れない。見本の名前は `example_team` だけ（テストが止める）
- 使う人に入る依存（`dependencies`）は足さない
- commit の 1 行目は `type(scope): subject` の形（type の一覧は `lefthook.yml`）
- 文書・コメント・メッセージは日本語。README の「English」の節だけ英語
