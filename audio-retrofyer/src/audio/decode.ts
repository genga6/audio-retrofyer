// 入力層: Fileを受け取り、Web Audio の AudioBuffer（生の波形データ） に変換する。

// --- AudioContext とは ---
// Web Audio API の中心オブジェクト＝「音を扱う作業場（工房）」。
// デコード・音の生成・エフェクト・再生・出力先へのルーティングは、すべてこの中で行う
// （音源 → エフェクト → 出力(destination) というノードのグラフを組み立てる器）。
// 出力ハードウェアとも繋がっていて、再生時刻のクロック(currentTime)や出力サンプルレートも持つ。
// ブラウザは同時に持てる AudioContext 数に上限があるため、1つ作って使い回す。
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// --- なぜドロップしただけで長さ・サンプルレートが分かる？ ---
// File はただの「圧縮されたバイト列」。その先頭(ヘッダ)にサンプルレートやチャンネル数が書かれている。
//   1. file.arrayBuffer() … ファイルの中身を生バイト(ArrayBuffer)として読み出す
//   2. decodeAudioData()  … mp3/wav を解凍し、生サンプル(各chのFloat32配列)＋メタ情報を持つ
//                           AudioBuffer を生成する
// なので audioBuffer.sampleRate / numberOfChannels / length は「ファイルシステムから取得」ではなく
// 「デコード結果の AudioBuffer が構造として保持している値」。duration は length ÷ sampleRate で求まる。
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = getAudioContext();
  return await ctx.decodeAudioData(arrayBuffer);
}
