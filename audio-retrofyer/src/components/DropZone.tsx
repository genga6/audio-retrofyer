import { type DragEvent, useState } from "react";
import { cn } from "@/lib/cn";

type DropZoneProps = {
  // ファイルが選択 / ドロップされたら、その File を親へ渡すだけ。
  // デコードなどの処理は親（App）の責務にして、この部品は「入力 UI」に徹する（関心の分離）。
  onFile: (file: File) => void;
  disabled?: boolean;
};

export function DropZone({ onFile, disabled }: DropZoneProps) {
  // ドラッグ中かどうか。見た目（枠線・背景）の切り替えに使うだけの状態。
  const [isDragOver, setIsDragOver] = useState(false);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault(); // ブラウザが既定でファイルを開いてしまうのを抑制。
    setIsDragOver(false);

    if (disabled) return;

    const file = event.dataTransfer.files[0]; // 複数ドロップされても先頭だけ扱う。
    if (file) onFile(file);
  }

  return (
    // <label> で全体を包むと、ボックスのどこをクリックしても中の <input type="file"> が開く。
    <label
      onDragOver={(event) => {
        event.preventDefault(); // これが無いと drop イベントが発火しない（ブラウザ仕様）。
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      // cn() で「基本クラス + 状態クラス」を合成。モバイル基準で書き、sm: 以上で余白を広げる。
      className={cn(
        "block w-full cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-10",
        "border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600",
        // ↓ ドラッグ中は枠線/背景を上書き。twMerge が border 色の競合を後勝ちで解決してくれる。
        isDragOver &&
          "border-indigo-500 bg-indigo-500/10 dark:border-indigo-400",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <p className="text-base sm:text-lg">
        🎵 音声ファイル（mp3 / wav）をドロップ
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        またはクリックして選択
      </p>

      <input
        type="file"
        accept="audio/*" // ファイル選択ダイアログを音声に絞る。
        disabled={disabled}
        aria-label="音声ファイルを選択" // スクリーンリーダー向けのラベル。
        className="sr-only" // 画面上には表示せず、ラベルのクリックで開く。
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          // 同じファイルをもう一度選んでも onChange が発火するよう値をリセット。
          event.target.value = "";
        }}
      />
    </label>
  );
}
