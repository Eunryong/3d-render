# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소의 코드를 작업할 때 참고할 수 있는 가이드를 제공합니다.

## 프로젝트 개요

Next.js 16, React 19, Three.js로 구축된 **3D 인테리어 디자인 애플리케이션**입니다. 사용자가 방 스캔의 PLY 파일을 업로드하고, 실시간 충돌 감지 기능을 통해 3D 공간에 가구를 배치/정렬할 수 있습니다.

## 개발 명령어

```bash
# 먼저 my-app 디렉토리로 이동
cd my-app

# 의존성 설치 (React 19와의 peer dependency 이슈로 인해 --legacy-peer-deps 필요)
npm install --legacy-peer-deps

# 개발 서버 (http://localhost:3000에서 실행)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 시작
npm start

# 코드 린트
npm run lint
```

### 의존성 관리

이 프로젝트는 React 19를 사용하지만, 일부 패키지(예: vaul)가 아직 React 19를 공식 지원하지 않습니다. 따라서 npm 설치 시 `--legacy-peer-deps` 플래그를 사용해야 합니다. 새로운 패키지를 추가할 때도 동일한 플래그를 사용하세요:

```bash
npm install [package-name] --legacy-peer-deps
```

## 기술 스택

- **프레임워크**: Next.js 16 (App Router)
- **React**: 19.2.0 (클라이언트 사이드 렌더링)
- **3D 그래픽**:
  - Three.js (0.181.1)
  - @react-three/fiber (9.4.0) - Three.js용 React 렌더러
  - @react-three/drei (10.7.7) - R3F용 헬퍼 및 추상화
  - three-stdlib (2.36.1) - 로더들 (GLTFLoader, OBJLoader, PLYLoader)
- **UI 컴포넌트**: Radix UI primitives with Tailwind CSS
- **스타일링**: Tailwind CSS 4.1.9
- **타입 시스템**: TypeScript 5

## 아키텍처

### 컴포넌트 계층 구조

```
app/page.tsx (루트 컴포넌트)
├── Sidebar - 파일 업로드 및 가구 선택 UI
├── TransformControlsPanel - 변형 모드 컨트롤 (이동/회전/크기조절)
└── SceneViewer - 3D 캔버스 래퍼
    ├── PLYLoader - PLY 방 스캔 파일 로드 및 렌더링
    └── FurnitureObjects - 모든 가구 아이템 렌더링
        └── FurnitureObject (아이템당)
            ├── Primitive geometry (의자, 테이블, 소파, 조명)
            ├── ModelLoader - 커스텀 GLB/OBJ 모델 로드
            └── TransformControls - 인터랙티브 3D 변형 기즈모
```

### 상태 관리

주요 상태는 [app/page.tsx](my-app/app/page.tsx)에 존재하며 props를 통해 하위로 전달됩니다:
- `plyFile`: 업로드된 방 스캔 파일
- `furnitureItems`: position/rotation/scale을 포함한 가구 객체 배열
- `selectedId`: 현재 선택된 가구 아이템 ID
- `transformMode`: 현재 변형 모드 ('translate' | 'rotate' | 'scale')
- `collisionDetector`: 충돌 감지 시스템의 싱글톤 인스턴스

### 핵심 시스템

**충돌 감지** ([components/collision-detector.ts](my-app/components/collision-detector.ts))
- 레이캐스팅을 사용하여 가구와 배경 메시 간 충돌 감지
- 가구 간 충돌은 바운딩 박스 교차를 사용
- `findValidPosition()`: 방 스캔 주변을 나선형 패턴으로 검색하여 배치 가능한 위치를 지능적으로 찾음
- 드래그 작업 중 가구가 벽이나 다른 가구와 겹치지 않도록 방지

**3D 모델 로딩** ([components/model-loader.tsx](my-app/components/model-loader.tsx))
- GLB 및 OBJ 파일 형식 지원
- 업로드된 파일로 생성된 blob URL에서 모델을 동적으로 로드
- 로딩 중에는 플레이스홀더 큐브 표시

**가구 타입** ([components/furniture-objects.tsx](my-app/components/furniture-objects.tsx))
- 기본 제공 프리미티브: 의자, 테이블, 소파, 조명 (Three.js Box/Cylinder/Sphere로 구성)
- 커스텀 모델: 사용자가 업로드한 GLB/OBJ 파일
- 각 타입은 적절한 그림자와 재질을 가진 절차적 지오메트리를 보유

**변형 컨트롤** ([components/transform-controls-panel.tsx](my-app/components/transform-controls-panel.tsx))
- 키보드 단축키 제공 (G=이동, R=회전, S=크기조절)
- drei의 TransformControls와 통합하여 인터랙티브 3D 조작 가능
- 충돌 방지를 위해 드래그 작업 중 orbit controls 비활성화

## 중요한 패턴

### 클라이언트 전용 컴포넌트

Three.js가 브라우저 API를 필요로 하므로 모든 3D 컴포넌트는 `'use client'` 디렉티브를 사용합니다. Next.js App Router를 사용하지만 완전히 클라이언트 사이드 렌더링됩니다.

### 파일 처리

- PLY 파일: 사이드바를 통해 업로드되는 방/환경 스캔
- GLB/OBJ 파일: 사이드바를 통해 업로드되는 커스텀 가구 모델
- Three.js 로더를 위해 `URL.createObjectURL()`을 사용하여 파일을 blob URL로 변환
- 클린업 시 blob URL을 해제해야 함 ([components/ply-loader.tsx:40-41](my-app/components/ply-loader.tsx#L40-L41) 참조)

### 충돌 감지 플로우

1. 가구가 추가되면 `findValidPosition()`이 충돌하지 않는 위치를 검색
2. 변형 중에는 `onObjectChange`가 매 프레임마다 충돌을 체크
3. 충돌이 감지되면 가구가 `previousValidPosition`으로 되돌아감
4. 가구가 추가/제거될 때 바운딩 박스가 등록/해제됨

### TypeScript 경로

my-app 루트 디렉토리를 가리키는 `@/*` 별칭을 사용 ([tsconfig.json](my-app/tsconfig.json#L21-L23)에서 설정)

## UI 컴포넌트

프로젝트는 shadcn/ui 컴포넌트 (Radix UI + Tailwind)를 사용합니다. 컴포넌트 정의는 [components/ui/](my-app/components/ui/)에 있으며, 설정은 [components.json](my-app/components.json)에 있습니다.

## 3D 코드 작업하기

- Three.js 객체는 오른손 좌표계(Y-up)를 사용
- 위치, 회전, 크기는 튜플로 저장: `[x, y, z]`
- 씬은 orbit controls, perspective camera, 그림자가 있는 directional lighting을 사용
- Grid helper는 Y=0에서 1단위 셀로 무한 그리드를 표시
- 3D 동작을 수정할 때는 배경 메시(PLY)가 있을 때와 없을 때 모두 테스트

## 알려진 이슈

### React 19 호환성
프로젝트는 최신 React 19를 사용하지만, 일부 UI 라이브러리가 아직 공식 지원하지 않습니다:
- `vaul@0.9.9`: drawer 컴포넌트 (현재 코드에서 미사용, 제거 고려 가능)
- 다른 Radix UI 컴포넌트들은 대부분 정상 작동

### 성능 최적화
- PLY 파일이 클 경우 초기 로딩 시간이 길어질 수 있음
- 가구 개수가 많을 경우(50개 이상) 프레임 드롭 가능
- 충돌 감지는 매 프레임 실행되므로 복잡한 메시에서는 성능 영향 있음
