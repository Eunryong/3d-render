import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 정적 내보내기 비활성화 - 클라이언트 사이드 렌더링 앱이므로
  output: undefined,
  // _not-found 프리렌더링 에러 우회
  experimental: {
    // React 19 지원
  },
};

export default nextConfig;
