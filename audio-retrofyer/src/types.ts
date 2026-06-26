// 採譜結果の共通中間表現。
// 表示（ピアノロール）/ 再生（synth）/ 書き出し（MIDI）は、すべてこの Note[] を読む。
// この型を境界にすることで、各層を疎結合に保つ。

// 音符のデータ
export type Note = {
  pitch: number; // MIDI ノート番号 (0-127)
  startTime: number; // 開始（秒）
  endTime: number; // 終了（秒）
  velocity: number; // 強さ（0-1）
};
