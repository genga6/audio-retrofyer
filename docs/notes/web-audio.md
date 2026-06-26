# 学習メモ: Web Audio と mp3 → AudioBuffer

> このプロジェクトの「入力層」（`src/audio/decode.ts`）で起きていることの仕組みメモ。
> コードの「なぜこの形か」は decode.ts のコメントに、概念の深掘りはここに。

## 1. mp3（MPEG Audio Layer-3）とは

一言でいうと「**人間の耳に聞こえにくい成分を捨ててデータを小さくした音声ファイル**」。

- **非可逆圧縮**: 圧縮時に一部の音声情報を間引く。元（CD 音源など）より音質は落ちるが、サイズは 1/10 程度まで小さくなる。元には戻せない（＝非可逆）。
- **心理音響モデル**: 「大きな音の直後の小さな音」「特定の高周波」など、人間が知覚しにくい部分をあえて記録しないことでデータを節約する。
- **wav** は対照的に基本「無圧縮（生サンプルそのまま）」。サイズは大きいが劣化なし。

要点: **mp3 は圧縮された状態のままでは「何番目の音がどんな波形か」を取り出せない**。編集・描画・再生するには解凍（デコード）が要る。

## 2. なぜ decodeAudioData が必要か

```ts
const arrayBuffer = await file.arrayBuffer();   // ① ファイル = 圧縮バイト列を読み出す
const audioBuffer = await ctx.decodeAudioData(arrayBuffer); // ② 解凍して生波形へ
```

- **① `file.arrayBuffer()`**: ドロップされたファイルの中身を、生バイト（`ArrayBuffer`）としてメモリへ。まだ「圧縮された塊」のまま。
- **② `decodeAudioData()`**: ブラウザエンジンが mp3/wav を**解凍し、全サンプルを数値（`Float32`）の配列に展開**して `AudioBuffer` を返す。

## 3. AudioBuffer = デコード後の「生の波形データの箱」

| プロパティ / メソッド | 意味 |
| --- | --- |
| `sampleRate` | 1 秒間を何個の数値（サンプル）で表すか（例: 44100 Hz） |
| `numberOfChannels` | モノラル(1) / ステレオ(2) など |
| `length` | サンプルの総数（データの点数） |
| `duration` | 秒数。`length ÷ sampleRate` で決まる |
| `getChannelData(ch)` | そのチャンネルの波形の高さ（-1.0〜1.0）の `Float32Array` |

`sampleRate` や `numberOfChannels` は**ファイルのヘッダ（冒頭のメタ情報）**に書かれた値で、デコード時に読み取られて `AudioBuffer` が保持する。
→ だから「ファイルシステムから取得」ではなく「**デコード結果の AudioBuffer が構造として持っている値**」。

## 4. よくある誤解の補正

- ❌「ヘッダだけ読むから一瞬で長さが分かる」
- ⭕ **`decodeAudioData` はファイル全体を解凍し、全サンプルをメモリに展開する**。一瞬に見えるのは単に速いから。
  - 帰結: **長尺音声はメモリ・時間ともに重い** → 本プロジェクトの「長尺はチャンク（窓）処理」という課題に直結する（[../overview.md](../overview.md) §7 / 採譜は特に重い）。

## 5. このメモが効く先

`getChannelData()` で取れる `Float32Array`（波形）は、次のステップで使う:

- **波形描画**: 値を縦軸、時間（インデックス）を横軸に canvas へ。
- **採譜**: basic-pitch に AudioBuffer を渡す（22050Hz・モノラルへ自前でリサンプルしてから。`src/audio/transcribe.ts`）。

## 6. ハマりどころ: Vite 8 で basic-pitch が壊れる（→ Vite 7 固定）

**症状**: basic-pitch 導入後、`pnpm dev` で画面が真っ白。コンソールに
`@spotify_basic-pitch.js:XXXXX Uncaught SyntaxError: Unexpected token '('`。本番ビルド(`pnpm build`)は通るのに dev だけ落ちる。

**真因**: `@tensorflow/tfjs` の `HashTable` クラスに `async import(keys, values) {}` という **`import` という名のメソッド**がある。
**Vite 8（Rolldown）の dev 配信時 import 解析（es-module-lexer）が、この `import(` を「動的 import 呼び出し」と誤検出**し、配信するファイルにこう注入して構文を壊す:

```js
// 元: async import(keys, values) {
// 配信時に壊れる ↓
async import(__vite__injectQuery(keys, 'import'), values) {
```

ディスク上のファイルは正常（`node --check` 通過）。**dev サーバが配信時に変換した版だけ**が壊れる、というのが切り分けの鍵だった。本番ビルドはフルパーサ＋minify の別経路なので誤検出しない。

**対処**: **Vite を 7 系に固定**（esbuild ベースの最適化器は誤検出しない）。
- `package.json`: `vite ^7.x` / `@vitejs/plugin-react ^5`（v6 は Vite 8 専用 peer）
- `vite.config.ts`: `optimizeDeps.include: ["@spotify/basic-pitch"]`（CJS・拡張子なし import を ESM 化させるため。tfjs は basic-pitch の依存なので直接 include しない＝解決不可で失敗する）

**将来 Vite 8 に上げたいとき**: この `import` メソッド誤検出が修正されたかを先に確認すること。
