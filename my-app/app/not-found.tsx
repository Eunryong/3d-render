'use client'

// Next.js 16 프리렌더링 버그 우회
export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>페이지를 찾을 수 없습니다</h2>
      <p>요청하신 페이지가 존재하지 않습니다.</p>
      <a href="/">홈으로 돌아가기</a>
    </div>
  )
}
