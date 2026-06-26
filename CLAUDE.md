# AGENTS.md

**Audio retrofyer** — URL/ファイルの音源を採譜し、好きな音色（8bit・オルゴール・クラシック等）で鳴らし直して、楽譜（ピアノロール）を表示するツール。
**完全クライアント完結（バックエンドなし・静的サイト）**。コーディングエージェント向けの作業ガイド。

## このリポジトリの目的と進め方（重要）

**オーナーの学習が第一目的**。エージェントはコードを完成させる「作業者」ではなく、
オーナーの理解を助ける**伴奏役（ペアプロのナビ）**として振る舞うこと。

- **小さく進める**: 一度に大量のコードを書き切らない。1 ステップずつ、何を・なぜやるかを説明してから進む。
- **理由を説明する**: 採用した API・設計・記法の「なぜ」を都度ひとこと添える。特に Web Audio API（`AudioContext`/`decodeAudioData`）、採譜（basic-pitch の前処理・しきい値）、SoundFont 再生、`getDisplayMedia` のタブ音声キャプチャ、TypeScript の型まわりなど、つまずきやすい点は短く解説する。
- **手を動かす余地を残す**: 些末でない実装は、まず方針と雛形を示し、可能ならオーナー自身が書けるように促す。全部を勝手に埋めない。
- **質問を歓迎する**: オーナーの「なぜ？」には、コードを足す前にまず言葉で答える。
- **確認してから大きく動く**: ファイルの大量削除・依存追加・構成変更は、理由を述べて合意を取ってから。

## コンセプト（方針のブレを防ぐため）

「原曲を忠実に再演奏する」ツールではなく、**雰囲気を手軽に作り替えて遊ぶ**ツール。採譜は完璧ではなく多少崩れるが、別音色化では崩れがむしろ味になる。**「忠実さ」を売りにしない**。
相性が良いのは音数が少なく音が立っている素材（lo-fi / アンビエント / ループ / シンプルなピアノ・シンセ）。ボーカル+バンド+ドラムが密に重なるフルミックスは主対象にしない。

## アーキテクチャ制約（必ず守る）

**完全クライアント完結の静的 SPA。サーバを持たない。** この制約は最優先で、勝手に破らない。

- **「URL 貼り付けで即ダウンロード」は実装しない**。YouTube 等からの音声取得（yt-dlp 相当）はブラウザ JS では原理的に不可（CORS / 署名付きストリーム保護）。他ドメインの mp3 直リンクも CORS で fetch 不可なことが多い。**自前 yt-dlp サーバの導入は今回採らない**（やるなら必ず事前合意）。
- **入力経路はサーバなしで成立するもののみ**:
  1. **ファイル入力（MVP の本命）**: mp3/wav を D&D → `decodeAudioData`。最も堅牢。
  2. **タブ音声キャプチャ（拡張）**: `getDisplayMedia({ audio: true })` で別タブの再生音を取り込む。後段は共通なので入力の差し替えだけ。Chromium 系中心・リアルタイム再生が必要、という制約あり。
  3. マイク入力は本命にしない。

## スタック

アプリ本体は **`audio-retrofyer/` ディレクトリ**に置く**単一 Vite + TypeScript アプリ**（backend は無い）。リポジトリ直下はドキュメントや素材置き場として残す。静的出力なので GitHub Pages / Netlify 等にそのまま置ける。

| 役割 | 採用/候補 | メモ |
| --- | --- | --- |
| ビルド/SPA | **Vite 7 + TypeScript（strict）** | 静的出力。**Vite 8 は不可**（Rolldown の dev import 解析が basic-pitch/tfjs を壊す。`docs/notes/web-audio.md` 参照） |
| Lint/Format | **Biome 2** | ESLint・Prettier は使わない |
<!-- メモ: Vite 公式テンプレは現在 lint に oxlint を採用。本プロジェクトは Biome 一本に統一したが、
     oxlint（Oxc）は急成長中で Vite も推し始めている。lint 速度が問題化したら oxlint(lint) + Biome(format)
     構成を再検討する余地あり。時々ウォッチしておく。 -->

| 音声デコード | Web Audio API `decodeAudioData` | ネイティブ。追加依存なし |
| 採譜（音声→ノート） | **`@spotify/basic-pitch`** | `AudioBuffer` を渡せる。更新が止まり気味なので実装前に現状確認 |
| MIDI 生成/書き出し | **`@tonejs/midi`** | ノートイベント → `.mid` |
| 音色再生（SoundFont） | **spessasynth** 第一候補 / 代替 `js-synthesizer` | sf2/sf3 を Web Audio で再生。**採用は未決**（保守状況・API・ライセンスで判断） |
| 楽譜表示 | MVP: **ピアノロール（自前 canvas）** / ストレッチ: OpenSheetMusicDisplay | OSMD は MusicXML 必須で難所。五線譜は後回し |
| 音色素材 | `.sf2`（8bit / オルゴール / クラシック 等を数種同梱） | **各 sf2 の再配布ライセンス確認必須** |

> 注: 書くコードは TS のみだが、採譜モデル（tfjs/onnx）と音色再生（fluidsynth 系）は内部で WASM を使う。成果物に WASM/モデル/sf2 が含まれる。クライアント完結という目的には影響なし。

## パイプライン（MVP）

```
[ファイル入力] → decodeAudioData → AudioBuffer
  → basic-pitch (evaluateModel) → frames/onsets/contours
  → outputToNotesPoly + addPitchBends + noteFramesToTime → ノートイベント配列
  → ┬→ @tonejs/midi で MIDI 構築
     ├→ ピアノロール描画（canvas）
     └→ 選択中の .sf2 で再生（synth に MIDI を渡す）
```

## コマンド

（`audio-retrofyer/` で実行。`package.json` 作成後に整備。pnpm を使う想定。スクリプト名は実装時に確定）

| 用途 | コマンド（想定） |
| --- | --- |
| 開発サーバ起動（http://localhost:5173） | `pnpm dev` |
| 本番ビルド（型チェック込み） | `pnpm build` |
| ビルド結果のプレビュー | `pnpm preview` |
| Lint（チェックのみ） | `pnpm lint`（Biome） |
| Lint + 自動修正 | `pnpm exec biome check --write` |

## 規約

- **ディレクトリ構成**: type-based + ドメインコア隔離。`pages/`・`features/` は作らない（1 画面・ルーターなしのため）。深いネストは避ける（2〜3 階層まで）。
  ```
  src/
    components/   React UI 部品（Dropzone, PianoRoll, Player, ExportButton …）
    hooks/        カスタムフック（useAudioFile, useTranscription …）
    audio/        ドメイン中核（React 非依存）: decode.ts, transcribe.ts, synth.ts, midi.ts
    types.ts      共有型（Note など。増えたら types/ に昇格）
    App.tsx / main.tsx / index.css
  ```
  React の UI と音声処理コア（Web Audio / 採譜 / MIDI）を分ける。「2 つ以上で使うようになったら共有層へ昇格」（rule of three）。機能が育ったら `components/` の一部を `features/` に昇格して良い。
- **フォーマット**: インデント 2 スペース、Biome に従う。手で整形せず保存時整形か `biome check --write` に任せる。import の並びも Biome の organizeImports に任せ、手動で並べ替えない。
- **インポートエイリアス**: `@/*` → `src/*`（`tsconfig` と `vite.config.ts` の `paths`/`resolve.alias` を揃える）。
- **重い処理は分離**: 採譜は重い。チャンク処理＋進捗バー＋Web Worker 化を検討（メインスレッドを固めない）。
- **ライセンスの 2 種に注意**:
  - 入力素材（フリー BGM）: 採譜→別音色化は「改変」に当たる。CC0 や「改変・商用 OK」明記の素材を推奨。UI で「ライセンス確認した?」と一言出すと親切。
  - SoundFont(.sf2): 同梱するなら各 sf2 の再配布ライセンスを確認。

## 実装の進め方（推奨順）

1. **ファイル入力版の最小パイプラインを一本通す**（音色 1 つ＝ピアノ等で、`decodeAudioData → basic-pitch → ノート → ピアノロール表示 + sf2 再生` が繋がることを確認）。
2. **音色切り替え UI**（sf2 を複数同梱しドロップダウンで差し替え）。
3. **MIDI エクスポート**（`@tonejs/midi` で `.mid` ダウンロード）。
4. **タブ音声キャプチャ入力**を「おまけの手軽ルート」として追加。
5. （ストレッチ）五線譜表示：量子化 + MusicXML 生成 + OSMD。

最初の題材は「配信フリー BGM → オルゴール/8bit 切り替え」が相性・見栄え・通しやすさのバランス良し。

## 作業を終える前に

変更を加えたらコミット前に通すこと（`package.json` 整備後）:

```bash
pnpm lint     # Biome（エラーは pnpm exec biome check --write で修正）
pnpm build    # 型エラー・ビルドエラーの確認
```

## 未決事項（勝手に確定しない。決めるときは合意を取る）

- ピアノロールは自前 canvas か既存ライブラリか
- 音色再生は spessasynth か js-synthesizer か
- 同梱する sf2 の選定（ラインナップとライセンス）
- 採譜パラメータ（onset/frame しきい値、minDurationFrames）のデフォルトと UI 露出の有無
- 長尺音声のチャンク処理戦略

## 環境メモ

- devcontainer（`.devcontainer/`）で動作。Node 24 / pnpm（corepack）。**Go は不要**（このプロジェクトはバックエンドを持たない）。
- VS Code は Biome を既定フォーマッタにし、保存時に `source.fixAll.biome` と `source.organizeImports.biome` を実行する設定。
- ポート: dev サーバ = 5173（devcontainer の 8080 フォワードは旧構成の名残で未使用）。
