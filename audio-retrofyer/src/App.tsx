import { useState } from "react";
import { decodeAudioFile } from "@/audio/decode";
import { transcribe } from "@/audio/transcribe";
import { DropZone } from "@/components/DropZone";
import { PianoRoll } from "@/components/PianoRoll";
import { Waveform } from "@/components/Waveform";
import type { Note } from "@/types";

type Status =
  | { status: "idle" }
  | { status: "decoding"; fileName: string }
  | {
      status: "transcribing";
      fileName: string;
      buffer: AudioBuffer;
      progress: number;
    }
  | { status: "ready"; fileName: string; buffer: AudioBuffer; notes: Note[] }
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
      setState({
        status: "transcribing",
        fileName: file.name,
        buffer,
        progress: 0,
      });

      const notes = await transcribe(buffer, (progress) => {
        // 進捗更新。transcribing 状態でない場合は無視する。
        setState((prev) =>
          prev.status === "transcribing" ? { ...prev, progress } : prev,
        );
      });

      setState({ status: "ready", fileName: file.name, buffer, notes });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ status: "error", fileName: file.name, message });
    }
  }

  const busy = state.status === "decoding" || state.status === "transcribing";

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Audio retrofyer</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          音源を採譜して、好きな音色で鳴らし直すツール（開発中）。
        </p>
      </header>

      {/* デコード中は二重投入を防ぐため disabled にする */}
      <DropZone onFile={handleFile} disabled={busy} />

      {state.status === "decoding" && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          デコード中… <span className="font-medium">{state.fileName}</span>
        </p>
      )}

      {state.status === "transcribing" && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>
            採譜中… <span className="font-medium">{state.fileName}</span>（
            {Math.floor(state.progress * 100)}%）
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-800">
            <div
              className="h-full bg-indigo-500 transition-[width]"
              style={{ width: `${state.progress * 100}%` }}
            ></div>
          </div>
        </div>
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

          {/* 採譜結果を描画するコンポーネント */}
          <PianoRoll notes={state.notes} />

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
