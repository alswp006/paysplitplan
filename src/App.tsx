// @ai-factory:wiring-first — 스캐폴드가 설계(SPEC 화면 표·패킷 목록)로부터 결정론으로 깐 라우트 골격이다.
// 진입점(App.tsx) 패킷: 처음부터 다시 쓰지 마라 — SPEC과 경로를 대조·보완하고, 전역 Provider(광고/결제 SDK·앱 상태)를
//   <Routes>를 감싸는 자리에 끼워라. 라우트 경로는 지우지 말고 고쳐라(화면 파일은 이 경로로 navigate한다).
// 화면 패킷: 이 파일을 건드리지 마라 — 자기 페이지 파일(자리 페이지)만 통째로 교체한다.
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Setup from './pages/Setup';
import Ratio from './pages/Ratio';
import Result from './pages/Result';
import History from './pages/History';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

export default function App() {
  return (
    // @ai-factory:providers — 전역 Provider는 <Routes>를 감싸는 이 자리에 둔다(main.tsx는 @AI:ANCHOR, 수정 금지).
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/ratio" element={<Ratio />} />
      <Route path="/result" element={<Result />} />
      <Route path="/history" element={<History />} />
      {DevTdsGallery && (
        <Route
          path="/__tds-gallery"
          element={
            <Suspense fallback={null}>
              <DevTdsGallery />
            </Suspense>
          }
        />
      )}
      {/* 미정의 경로 → 홈. NotFound 화면이 설계에 생기면 이 줄을 그 화면으로 바꿔라. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
