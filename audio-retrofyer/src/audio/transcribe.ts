import {
	addPitchBendsToNoteEvents,
	BasicPitch,
	noteFramesToTime,
	outputToNotesPoly,
} from "@spotify/basic-pitch";
import type { Note } from "@/types";

// basic-pitch のモデルは 22050Hz・モノラル前提（evaluateModel の引数名も resampleBuffer）。
const BASIC_PITCH_SAMPLE_RATE = 22050;
// public/model/ に置いた静的ファイルを URL で読む。
const BASIC_PITCH_MODEL_URL = "/model/model.json";

// 入力 AudioBuffer を 22050Hz・モノラルに変換する。
// OfflineAudioContext = 「スピーカーを出さずに音声処理を行うコンテキスト」。
// 出力チャンネル数に 1 を指定すると、ステレオは自動でモノラルに変換される。
async function resampleToMono22050Hz(buffer: AudioBuffer): Promise<AudioBuffer> {
	const length = Math.ceil(buffer.duration * BASIC_PITCH_SAMPLE_RATE);
	const offlineCtx = new OfflineAudioContext(1, length, BASIC_PITCH_SAMPLE_RATE);

	const source = offlineCtx.createBufferSource();  // createBufferSource() は AudioBuffer を再生するためのノードを作る。
	source.buffer = buffer;
	source.connect(offlineCtx.destination);  // OfflineAudioContext の出力先に接続する。
	source.start();  // 再生する。
	return await offlineCtx.startRendering();  // 22050Hz・モノラルの音声データとして録音する。
}

export async function transcribe(
	buffer: AudioBuffer,
	onProgress?: (percent: number) => void,
): Promise<Note[]> {
	const resampledBuffer = await resampleToMono22050Hz(buffer);

	// モデルパス（URL）を指定して、内部で tf.loadGraphModel して読む込む。
	const basicPitch = new BasicPitch(BASIC_PITCH_MODEL_URL);

	// evaluateModel はチャンクごとに結果（frames/onsets/contours）をコールバックで返す。
	// 進捗（0..1）は percentCallback で受け取れる（進捗バーに使う）。
	const frames: number[][] = [];  // 各時刻における各ピッチの確率分布。
	const onsets: number[][] = [];  // 音の立ち上がりの確率分布。
	const contours: number[][] = [];  // ピッチの変化の確率分布。

	// ニューラルネットが「生の確率データ」を返すので、後でしきい値で量子化して NoteEvent に変換する。
	await basicPitch.evaluateModel(
		resampledBuffer,
		(f, o, c) => {
			frames.push(...f);
			onsets.push(...o);
			contours.push(...c);
		},
		(p) => onProgress?.(p),
	);

	// --- ここから先は、basic-pitch の出力をアプリ共通の Note[] に変換する処理 ---
	// frames/onsets -> ノート列（しきい値で量子化）-> ピッチベンド付与 -> フレーム番号を秒に変換
	const noteEvents = noteFramesToTime(
		addPitchBendsToNoteEvents(
			contours,
			outputToNotesPoly(frames, onsets, 0.25, 0.25, 5),
		),
	);

	// basic-pitch の NoteEventTime[] -> アプリ共通の Note[] に変換。
	return noteEvents.map((n) => ({
		pitch: n.pitchMidi,
		startTime: n.startTimeSeconds,
		endTime: n.startTimeSeconds + n.durationSeconds,
		velocity: n.amplitude,
	}));
}