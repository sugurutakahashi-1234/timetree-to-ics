# 貢献のしかた

issue も PR も歓迎します。とくに、TimeTree の API が変わって動かなくなったときの知らせと直しは助かります。

## 手元で動かす

[Bun](https://bun.sh) と Node 24 以上が要ります。

```bash
bun install
bun run check     # テスト・型の検査・組み立て・Node での起動
node dist/cli.js <公開カレンダーの名前か URL>   # 実物で確かめる
```

GitHub Actions の設定（`.github/workflows`）を変えるときは、[mise](https://mise.jdx.dev) で点検の道具（`mise.toml`）を入れておくと、commit の前に同じ点検が流れます。入れなくても、PR の CI が同じ点検をします。

## 決まり

- テストは TimeTree に行かない。返事の形は `test/fixtures.ts` の作り物で再現する
- 実在の公開カレンダーの名前をリポジトリに入れない。見本の名前は `example_band` だけ（テストが止める）
- 使う人に入る依存（`dependencies`）は足さない
- commit の 1 行目は `type(scope): subject` の形（type の一覧は `lefthook.yml`）
- 文書・コメント・メッセージは日本語。README の「English」の節だけ英語
