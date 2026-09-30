/**
 * 스파크라인 — 숫자 배열을 경량 인라인 SVG 라인+에어리어로(상환 곡선, 추이 등).
 *
 * Pre-built (재구현 금지): 데이터 시각화가 필요할 때. D3/Three.js 등 무거운 차트 라이브러리는
 * 번들 100MB 제한 + 정책상 금지 → 이 인라인 SVG로 대체한다(의존성 0). 색은 adaptive 토큰만.
 */
export function Sparkline({
  data,
  width = 320,
  height = 64,
  testId,
  color = "var(--adaptiveBlue500)",
}: {
  /** null은 값 없는 자리 — 선을 끊고 바닥에 빈 점으로 표시한다(자리는 유지). */
  data: (number | null)[];
  width?: number;
  height?: number;
  testId?: string;
  /** 선·면·점 색(adaptive 토큰). 기본값은 템플릿 그대로 — 앱은 src/lib/theme.ts의 색을 명시한다. */
  color?: string;
}) {
  if (!data || data.length < 2) return null;

  const values = data.flatMap((v) => (v === null ? [] : [v]));
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const pos = data.map((v, i) => ({
    x: i * stepX,
    y: v === null ? height : height - ((v - min) / span) * height,
    empty: v === null,
  }));

  // 값이 이어지는 구간마다 선·면을 따로 그린다.
  const runs: { x: number; y: number }[][] = [];
  for (const p of pos) {
    if (p.empty) continue;
    const last = runs[runs.length - 1];
    const prev = last?.[last.length - 1];
    if (last && prev && Math.abs(p.x - prev.x - stepX) < 0.01) last.push(p);
    else runs.push([p]);
  }
  const path = (run: { x: number; y: number }[]) =>
    run.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <svg
      data-testid={testId}
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="추이 그래프"
      style={{ overflow: "visible" }}
    >
      {runs
        .filter((run) => run.length > 1)
        .map((run) => {
          const line = path(run);
          const first = run[0];
          const end = run[run.length - 1];
          return (
            <g key={line}>
              <path d={`${line} L${end.x},${height} L${first.x},${height} Z`} fill={color} opacity={0.12} />
              <path
                d={line}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          );
        })}
      {pos.map((p, i) => (
        <circle
          key={i}
          data-testid={testId ? `${testId}-point` : undefined}
          data-empty={p.empty ? "true" : "false"}
          cx={p.x}
          cy={p.y}
          r={3}
          fill={p.empty ? "var(--adaptiveBackground)" : color}
          stroke={color}
          strokeWidth={p.empty ? 1.5 : 0}
        />
      ))}
    </svg>
  );
}
