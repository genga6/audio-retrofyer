import { useEffect, useRef } from "react";
import type { Note } from "@/types";

type PianoRollProps = {
  notes: Note[];
  height?: number;
};

// 採譜結果 Note[] をピアノロールとして描画するコンポーネント
export function PianoRoll({ notes, height = 240 }: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // NOTE: canvasの定型処理は Waveform.tsx と同じなので、共通化できるかも。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      if (!notes || notes.length === 0) return; // ノートがない場合は描画しない

      // 時間と音高の範囲を 1つのループで計算する。
      let endTime = 0;
      let minPitch = 127;
      let maxPitch = 0;
      for (const note of notes) {
        if (note.endTime > endTime) endTime = note.endTime;
        if (note.pitch < minPitch) minPitch = note.pitch;
        if (note.pitch > maxPitch) maxPitch = note.pitch;
      }

      const pitchRange = Math.max(1, maxPitch - minPitch + 1);
      const rowHeight = height / pitchRange; // 1ピッチあたりの高さ
      const xScale = width / Math.max(0.001, endTime); // 1秒あたりの幅

      // ノートを描画する
      for (const note of notes) {
        const x = note.startTime * xScale;
        const w = Math.max(1, (note.endTime - note.startTime) * xScale);

        const y = (maxPitch - note.pitch) * rowHeight; // 高い音ほど上に描画する
        const h = Math.max(1, rowHeight - 1); // ノートの高さ（行の高さから 1px 引く）

        ctx.fillStyle = `rgba(99, 102, 241, ${0.35 + note.velocity * 0.65})`; // 透明度は velocity に応じて変化
        ctx.fillRect(x, y, w, h);
      }
    }

    draw();

    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [notes, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height }}
      className="w-full rounded-md bg-gray-50 dark:bg-gray-900"
    />
  );
}
