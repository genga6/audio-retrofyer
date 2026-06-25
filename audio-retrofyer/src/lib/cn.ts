import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// 定番の className ヘルパー。
// 1. clsx: 条件付きクラスを連結（false/undefined は無視、オブジェクトや配列もOK）。
// 2. twMerge: 競合する Tailwind クラスを「後勝ち」で解決（例: "px-2 px-4" → "px-4"）。
// shadcn/ui 由来で、Tailwind + React の事実上の標準。
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
