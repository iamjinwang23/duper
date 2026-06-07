"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-10">
      <h1 className="font-serif text-3xl mb-3">문제가 발생했습니다</h1>
      <p className="opacity-60 mb-6">
        작업을 처리하는 중 오류가 났습니다. 일시적인 문제일 수 있으니 다시 시도해 주세요.
      </p>
      <p className="text-sm text-red-400 mb-6 font-mono break-all">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-md bg-white text-neutral-900 px-4 py-2 text-sm"
      >
        다시 시도
      </button>
    </div>
  );
}
