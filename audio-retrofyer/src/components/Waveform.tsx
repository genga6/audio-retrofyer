import { useEffect, useRef } from "react";

type WaveformProps = {
  buffer: AudioBuffer;
  height?: number;
};

// AudioBuffer の波形を描画するコンポーネント
export function Waveform({ buffer, height = 96 }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // NOTE: canvasの定型処理は PianoRoll.tsx と同じなので、共通化できるかも。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return; // まだ canvas が描画されていない場合は何もしない

    function draw() {
      // useEffect 内の関数は再取得しておくと型が null でなくなって安全。
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d"); // 2D グラフィック描画のためのメソッドやプロパティをもつオブジェクトを返す。
      if (!canvas || !ctx) return;

      // 高解像度ディスプレイでも綺麗に描画するために、実ピクセル = CSSピクセル × dpr で描く。
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height); // クリアしてから描画する

      // 波形を描画する
      const data = buffer.getChannelData(0); // 左ch（とりあえず1ch）の生サンプル
      const samplesPerPixel = Math.max(1, Math.floor(data.length / width)); // 1px あたりのサンプル数
      const mid = height / 2; // 振幅 0 = canvas の縦中央

      ctx.strokeStyle = "#6366f1"; // indigo-500: light/dark 両方で見える
      ctx.beginPath(); // 波形の線を描くためのパスを開始

      for (let x = 0; x < width; x++) {
        const start = x * samplesPerPixel;
        let min = 1;
        let max = -1;

        // 1px あたりのサンプルを走査して、最小値と最大値を求める。
        // その2点を結ぶ線を描くことで、波形の振幅を表現する。
        for (let i = 0; i < samplesPerPixel; i++) {
          const v = data[start + i] ?? 0;
          if (v < min) min = v;
          if (v > max) max = v;
        }
        // 振幅 -1..1 を縦方向にマップ。+0.5 は線をピクセル中心においてシャープに見せるため。
        ctx.moveTo(x + 0.5, mid + min * mid);
        ctx.lineTo(x + 0.5, mid + max * mid);
      }
      ctx.stroke();
    }

    draw();

    // コンテナ幅が変わったら再描画する（レスポンシブ対応）
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [buffer, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height }}
      className="w-full rounded-md bg-gray-50 dark:bg-gray-900"
    />
  );
}
