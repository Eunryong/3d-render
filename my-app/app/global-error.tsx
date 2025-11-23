'use client'

// Next.js 16 프리렌더링 버그 우회
export const dynamic = 'force-dynamic'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ko">
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>오류가 발생했습니다</h2>
          <button onClick={() => reset()}>다시 시도</button>
        </div>
      </body>
    </html>
  )
}
