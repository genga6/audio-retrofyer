import { useState } from "react";
import { decodeAudioFile } from "@/audio/decode";
import { transcribe } from "@/audio/transcribe";
import { DropZone } from "@/components/DropZone";
import { Waveform } from "@/components/Waveform";

type Status =
  | { status: "idle" }
  | { status: "decoding"; fileName: string }
  | { status: "ready"; fileName: string; buffer: AudioBuffer }
  | { status: "error"; fileName: string; message: string };

// 秒数を m:ss に整形（例: 83.4 → "1:23"）
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function App() {
  const [state, setState] = useState<Status>({ status: "idle" });

  async function handleFile(file: File) {
    setState({ status: "decoding", fileName: file.name });

    try {
      const buffer = await decodeAudioFile(file);
      setState({ status: "ready", fileName: file.name, buffer });

      // --- スモークテスト: 採譜が動作するか確認する ---
      console.time("transcribe");
      const notes = await transcribe(buffer, (p) =>
        console.log(`採譜進捗: ${Math.round(p * 100)}%`),
      );
      console.timeEnd("transcribe");
      console.log("採譜ノート数:", notes.length, notes.slice(0, 5));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ status: "error", fileName: file.name, message });
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Audio retrofyer</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          音源を採譜して、好きな音色で鳴らし直すツール（開発中）。
        </p>
      </header>

      {/* デコード中は二重投入を防ぐため disabled にする */}
      <DropZone onFile={handleFile} disabled={state.status === "decoding"} />

      {state.status === "decoding" && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          デコード中… <span className="font-medium">{state.fileName}</span>
        </p>
      )}

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          読み込みに失敗しました: {state.message}
        </p>
      )}

      {state.status === "ready" && (
        <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <h2 className="mb-3 font-medium break-all">{state.fileName}</h2>

          {/* 波形を描画するコンポーネント */}
          <Waveform buffer={state.buffer} />

          {/* dt=項目名 / dd=値 を 2 カラムで */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-500 dark:text-gray-400">長さ</dt>
            <dd>{formatDuration(state.buffer.duration)}</dd>
            <dt className="text-gray-500 dark:text-gray-400">サンプルレート</dt>
            <dd>{state.buffer.sampleRate.toLocaleString()} Hz</dd>
            <dt className="text-gray-500 dark:text-gray-400">チャンネル数</dt>
            <dd>{state.buffer.numberOfChannels}</dd>
          </dl>
        </section>
      )}
    </main>
  );
}

export default App;
