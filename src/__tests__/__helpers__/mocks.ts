/**
 * Shared test mocks for Toss Mini App packets.
 *
 * Usage at the top of any test file:
 *   import { mockTds, mockAppsInToss, mockRouter, mockAnalytics } from "@/__tests__/__helpers__/mocks";
 *   mockTds();
 *   mockAppsInToss();
 *   mockRouter();
 *   mockAnalytics();   // 계측 래퍼 — 부분 목을 직접 쓰면 PageShell이 죽는다(아래 주석)
 *
 * Or use all at once:
 *   import { mockAll } from "@/__tests__/__helpers__/mocks";
 *   mockAll();
 */

import React from "react";
import { vi } from "vitest";

export const mockNavigate = vi.fn();
export const mockLocation = { pathname: "/", search: "", state: null, key: "default" };

/** `useToast().openToast` — 토스트를 띄웠는지 단언할 때 쓴다. */
export const mockOpenToast = vi.fn();
/** `useDialog()`의 메서드들 — 기본은 확인(openConfirm → true). 취소 경로는 `mockDialog.openConfirm.mockResolvedValueOnce(false)`. */
export const mockDialog = {
  openAlert: vi.fn(async (_o?: unknown) => {}),
  openConfirm: vi.fn(async (_o?: unknown) => true),
  openAsyncConfirm: vi.fn(async (_o?: unknown) => true),
  close: vi.fn(),
};

// ── TDS (@toss/tds-mobile) ──
// TDS components use CSS-in-JS + layout hooks that crash in jsdom.
// Replace with lightweight DOM stand-ins that preserve prop-based testing.
//
// **모양은 벤더 .d.ts(@toss/tds-mobile)를 따른다** — 공장의 vendor-shape 표가 이 파일을 벤더 선언과
// 대조한다. 이 목에서 테스트가 빨개지면 먼저 벤더 .d.ts(.ai-factory/tds-essential.txt)를 확인하라:
// 앱이 벤더 API를 잘못 썼으면 앱을 고쳐라. 목에 그 export가 없거나 목이 .d.ts와 모양이 다르면
// 목을 벤더 모양으로 고쳐라 — 소스를 목에 맞춰 벤더 API에서 멀어지게 바꾸지 마라(목을 오용에 맞추거나
// 앱을 목에 맞추면 실제 토스에서만 깨지는 앱이 초록으로 나간다).
// 자주 틀리는 네 가지:
//  · Chip은 칩 **그룹**(div role=group)이다 — 칩 하나는 ChipItem(button, 선택 상태 = aria-pressed).
//  · BottomSheet는 제목을 header, 버튼을 cta 슬롯으로 받는다(title prop 없음).
//  · TextField 라벨은 labelOption 기본 'appear'라 빈 칸에서 **숨는다**(hidden). 항상 보이려면 'sustain'.
//  · AlertDialog는 닫기 버튼을 그리지 않는다 — 누를 수 있는 것은 alertButton뿐이다.
// 인라인 vi.mock("@toss/tds-mobile")를 써야 하면 이 파일의 모양을 **그대로** 옮겨라(기억으로 쓰지 마라).
export function mockTds() {
  vi.mock("@toss/tds-mobile", () => {
    const h = React.createElement;
    const slot = (name: string, node: any) => (node == null || node === false ? null : h("span", { "data-slot": name }, node));

    // 버튼 하나 + 위·아래 액세서리(FixedBottomCTA · BottomCTA · BottomSheet.CTA의 공통 모양).
    const ctaButton = (dataSlot?: string) =>
      ({ children, onClick, disabled, loading, topAccessory, bottomAccessory, background, fixedAboveKeyboard, ...props }: any) =>
        h(
          React.Fragment,
          null,
          topAccessory != null ? h("div", { "data-slot": "top-accessory" }, topAccessory) : null,
          h("button", { onClick, disabled: disabled || loading || undefined, "data-loading": loading ? "true" : undefined, "data-slot": dataSlot, ...props }, children),
          bottomAccessory != null ? h("div", { "data-slot": "bottom-accessory" }, bottomAccessory) : null,
        );
    const doubleCta = (dataSlot: string) =>
      ({ leftButton, rightButton, topAccessory, bottomAccessory }: any) =>
        h(
          "div",
          { "data-slot": dataSlot },
          topAccessory != null ? h("div", { "data-slot": "top-accessory" }, topAccessory) : null,
          leftButton,
          rightButton,
          bottomAccessory != null ? h("div", { "data-slot": "bottom-accessory" }, bottomAccessory) : null,
        );
    const plainButton = ({ children, onClick, ...props }: any) => h("button", { type: "button", onClick, ...props }, children);

    // TextField — 라벨은 input과 **연결**되고(getByLabelText가 찾는다), labelOption 기본 'appear'면
    // 값이 빈 동안 hidden이다(지우지 않는다 — getByText·getByLabelText는 그대로 찾고, 빈 칸 라벨이
    // 보이는지는 toBeVisible()로 물을 수 있다).
    const Field = React.forwardRef(
      ({ label, labelOption, help, hasError, variant, prefix, suffix, right, format, containerProps, containerRef,
        paddingTop, paddingBottom, onClear, clearableButtonAriaLabel, onVisibilityChange, visibleButtonAriaLabel,
        id, ...props }: any, ref: any) => {
        const autoId = React.useId();
        const inputId = id ?? autoId;
        const current = props.value ?? props.defaultValue;
        const empty = current === undefined || current === null || String(current) === "";
        const labelHidden = labelOption !== "sustain" && empty;
        return h(
          "div",
          { "data-variant": variant, ...containerProps },
          label != null ? h("label", { htmlFor: inputId, hidden: labelHidden || undefined, "data-label-option": labelOption ?? "appear" }, label) : null,
          slot("prefix", prefix),
          // 벤더는 input에 `"aria-label": placeholder`를 먼저 넣고 props를 펼친다(2.5.1 런타임) — 앱이
          // aria-label을 넘기면 그 값이 이기고, 안 넘기면 접근성 이름이 placeholder("예: 3,000,000")가 된다.
          h("input", { ref, id: inputId, "aria-label": props.placeholder, "aria-invalid": hasError ? true : undefined, ...props }),
          slot("suffix", suffix),
          slot("right", right),
          onClear && !empty ? h("button", { type: "button", "aria-label": clearableButtonAriaLabel ?? "지우기", onClick: onClear }) : null,
          help != null ? h("span", { role: hasError ? "alert" : undefined, "data-slot": "help" }, help) : null,
        );
      },
    );
    const PasswordField = React.forwardRef((p: any, ref: any) => h(Field, { ...p, ref, type: "password" }));
    const TextFieldButton = ({ label, labelOption, value, placeholder, help, hasError, variant, onClick, disabled }: any) =>
      h(
        "div",
        { "data-variant": variant },
        label != null ? h("span", { "data-slot": "label" }, label) : null,
        h("button", { type: "button", onClick, disabled }, value || placeholder),
        help != null ? h("span", { role: hasError ? "alert" : undefined, "data-slot": "help" }, help) : null,
      );

    const dimmer = (onClick?: () => void) => h("div", { "data-slot": "dimmer", "aria-hidden": true, onClick });

    const checkboxBox = React.forwardRef(
      ({ checked, defaultChecked, onChange, onCheckedChange, disabled, inputType, size, labelProps, children, ...props }: any, ref: any) =>
        h(
          "label",
          labelProps ?? null,
          h("input", {
            ref, type: inputType ?? "checkbox", checked, defaultChecked, disabled,
            onChange: (e: any) => { onChange?.(e); onCheckedChange?.(e.target.checked); },
            ...props,
          }),
          children,
        ),
    );

    return {
      Button: ({ children, onClick, ...props }: any) =>
        h("button", { onClick, ...props }, children),

      // SubmitFooter(BottomCTA.tsx)의 기반 — 스텁이 없으면 SubmitFooter를 렌더하는 테스트가
      // undefined 엘리먼트로 죽는다(적대 리뷰 2026-08-30 실측). loading은 disabled로 표현해
      // "제출 중 비활성" 단언이 가능하게 한다. 벤더처럼 topAccessory(버튼 위 한 줄 — 예: 왜 비활성인지)와
      // bottomAccessory를 버튼 **바깥**에 렌더하고, 버튼 둘은 FixedBottomCTA.Double이다.
      FixedBottomCTA: Object.assign(ctaButton(), { Double: doubleCta("fixed-bottom-cta-double") }),

      // BottomCTA는 **그 자체가 버튼**이다(벤더 CompoundedComponent) — 안에 Button을 넣으면 버튼 안의 버튼이 된다.
      BottomCTA: Object.assign(ctaButton("bottom-cta"), { Single: ctaButton("bottom-cta"), Double: doubleCta("bottom-cta-double") }),

      // ListRow는 벤더처럼 children을 **버린다**(left · contents · right 슬롯만 그린다) — children에 넣은
      // 내용은 실제 토스에서도 렌더되지 않는다. onClick이 있으면 역할이 button이다.
      ListRow: Object.assign(
        ({ left, contents, right, onClick, withArrow, arrowType, border, disabled, disabledStyle, verticalPadding,
          horizontalPadding, leftAlignment, rightAlignment, a11yLeftAlignment, a11yRightReflow, withTouchEffect,
          children: _droppedLikeVendor, ...props }: any) =>
          h(
            "li",
            { onClick, role: onClick ? "button" : undefined, "aria-disabled": disabled ? true : undefined, ...props },
            slot("left", left),
            h("span", { "data-slot": "contents" }, contents),
            slot("right", right),
            withArrow || arrowType ? h("span", { "data-slot": "arrow", "aria-hidden": true }) : null,
          ),
        {
          Text: ({ children }: any) => h("span", null, children),
          Texts: ({ top, bottom, type }: any) =>
            h(
              React.Fragment,
              null,
              h("span", { "data-type": type, "data-slot": "top" }, top),
              h("span", { "data-slot": "bottom" }, bottom),
            ),
          AssetIcon: ({ name, alt }: any) => h("span", { "data-asset": name, role: "img", "aria-label": alt ?? name }),
          AssetImage: ({ src, alt }: any) => h("img", { src, alt: alt ?? "" }),
          AssetText: ({ children }: any) => h("span", null, children),
          IconButton: ({ "aria-label": ariaLabel, name, onClick, disabled }: any) =>
            h("button", { type: "button", "aria-label": ariaLabel, "data-icon": name, onClick, disabled }),
          LeftContainer: ({ children }: any) => h("span", null, children),
          Loader: () => h("span", { role: "progressbar" }),
        },
      ),

      Spacing: ({ size }: any) => h("div", { "data-spacing": size }),

      // Paragraph는 **직접 렌더 가능한 블록**(div)이고 Text/Icon/Badge/Link를 서브로 갖는다.
      // Paragraph.Text는 **인라인 span**이다 — 형제 Text 둘은 실제 토스에서 한 줄에 붙는다.
      // color·fontWeight는 DOM 속성으로 흘리지 않고 data-*로 남긴다(color는 CSS 색 문자열이다 —
      // primary/secondary/tertiary 같은 이름은 벤더가 조용히 무시한다).
      Paragraph: Object.assign(
        ({ children, typography, color, fontWeight, display, textAlign, ellipsisAfterLines, ...props }: any) =>
          h("div", { "data-typography": typography, "data-color": color, "data-font-weight": fontWeight, "data-display": display, ...props }, children),
        {
          Text: ({ children, typography, color, fontWeight, ...props }: any) =>
            h("span", { "data-typography": typography, "data-color": color, "data-font-weight": fontWeight, ...props }, children),
          Icon: ({ name }: any) => h("span", { "data-icon": name, "aria-hidden": true }),
          Badge: ({ children }: any) => h("span", { "data-slot": "badge" }, children),
          Link: ({ children, onClick, ...props }: any) => h("span", { role: "link", onClick, ...props }, children),
        },
      ),

      Text: ({ children, typography, color, fontWeight, display, ...props }: any) =>
        h("div", { "data-typography": typography, "data-color": color, "data-font-weight": fontWeight, ...props }, children),

      Badge: ({ children }: any) => h("span", { role: "status" }, children),

      // AlertDialog는 **닫기 버튼을 그리지 않는다**(벤더) — 사용자가 누를 수 있는 것은 alertButton뿐이고,
      // onClose는 딤 클릭(closeOnDimmerClick 기본 true)·뒤로가기 때만 불린다. 딤은 aria-hidden
      // `[data-slot="dimmer"]`로 둔다(딤 클릭 경로를 테스트하려면 그 요소를 클릭하라).
      AlertDialog: Object.assign(
        ({ open, title, description, alertButton, onClose, closeOnDimmerClick }: any) =>
          open
            ? h(
                "div",
                { role: "alertdialog", "aria-label": typeof title === "string" ? title : undefined },
                dimmer(closeOnDimmerClick === false ? undefined : onClose),
                h("h2", null, title),
                h("p", null, description),
                alertButton,
              )
            : null,
        {
          Title: ({ children }: any) => h("h2", null, children),
          Description: ({ children }: any) => h("p", null, children),
          AlertButton: ({ children, onClick }: any) => h("button", { onClick }, children),
        },
      ),

      // ConfirmDialog — 버튼 둘은 cancelButton·confirmButton 슬롯(서브 CancelButton/ConfirmButton).
      ConfirmDialog: Object.assign(
        ({ open, title, description, cancelButton, confirmButton, onClose, closeOnDimmerClick }: any) =>
          open
            ? h(
                "div",
                { role: "alertdialog", "aria-label": typeof title === "string" ? title : undefined },
                dimmer(closeOnDimmerClick === false ? undefined : onClose),
                title != null ? h("h2", null, title) : null,
                description != null ? h("p", null, description) : null,
                cancelButton,
                confirmButton,
              )
            : null,
        {
          Title: ({ children }: any) => h("h2", null, children),
          Description: ({ children }: any) => h("p", null, children),
          CancelButton: plainButton,
          ConfirmButton: plainButton,
        },
      ),

      Toast: ({ open, text, position }: any) =>
        open
          ? h("div", { role: "status", "data-position": position }, text)
          : null,

      useToast: () => ({ openToast: mockOpenToast }),
      useDialog: () => mockDialog,

      // Tab — 벤더는 **Tab.onChange(index)**가 필수다. 항목을 누르면 항목의 onClick과 함께
      // Tab.onChange(그 순번)이 불린다(Tab.Item에는 selected만 주면 된다).
      Tab: Object.assign(
        ({ children, onChange, size, fluid, itemGap, ariaLabel, ...props }: any) =>
          h(
            "div",
            { role: "tablist", "aria-label": ariaLabel, ...props },
            React.Children.map(children, (child: any, index: number) =>
              React.isValidElement(child)
                ? React.cloneElement(child as React.ReactElement<any>, { __onTabSelect: () => onChange?.(index, child.key ?? undefined) })
                : child,
            ),
          ),
        {
          Item: ({ children, selected, onClick, __onTabSelect, redBean, focused, onSelectItem, onResize, ...props }: any) =>
            h(
              "button",
              { role: "tab", "aria-selected": selected, onClick: (e: any) => { onClick?.(e); __onTabSelect?.(); }, ...props },
              children,
            ),
        },
      ),

      // SegmentedControl — onChange(value: string). 항목은 SegmentedControl.Item(value).
      SegmentedControl: Object.assign(
        ({ children, value, defaultValue, onChange, size, alignment, name, gradient, indicator, previousButton, gradation, controller, ...props }: any) => {
          const [inner, setInner] = React.useState(defaultValue);
          const autoName = React.useId();
          const selectedValue = value !== undefined ? value : inner;
          return h(
            "div",
            { role: "radiogroup", ...props },
            React.Children.map(children, (child: any) =>
              React.isValidElement(child)
                ? React.cloneElement(child as React.ReactElement<any>, {
                    __checked: (child.props as any).value === selectedValue,
                    __name: name ?? autoName,
                    __onSegmentSelect: (v: string) => { setInner(v); onChange?.(v); },
                  })
                : child,
            ),
          );
        },
        {
          Item: ({ children, value, size, __checked, __name, __onSegmentSelect, ...props }: any) =>
            h(
              "label",
              null,
              h("input", { type: "radio", name: __name, value, checked: !!__checked, onChange: () => __onSegmentSelect?.(value), ...props }),
              children,
            ),
        },
      ),

      // NOTE: TDS has NO "TabBar" export (hallucinated API). 하단 탭은 로컬
      // src/components/FloatingTabBar 를 쓰며, 그 컴포넌트는 TDS를 import하지 않아
      // 여기서 목킹할 필요가 없다(react-router/SDK 목만 있으면 jsdom에서 그대로 렌더).

      Asset: {
        Icon: ({ name, alt }: any) =>
          h("span", { "data-asset": name, role: "img", "aria-label": alt ?? name }),
        Image: ({ src, alt }: any) => h("img", { src, alt }),
        ContentIcon: ({ name, alt }: any) =>
          h("span", { "data-content-icon": name, role: "img", "aria-label": alt ?? name }),
        ContentImage: ({ src, alt }: any) => h("img", { src, alt }),
        Lottie: () => h("span", { "data-asset": "lottie" }),
        Text: ({ children }: any) => h("span", null, children),
        Video: () => h("span", { "data-asset": "video" }),
      },

      Skeleton: () => h("div", { "data-skeleton": "true", role: "presentation" }),

      Loader: () => h("div", { role: "progressbar" }),

      IconButton: ({ "aria-label": ariaLabel, name, onClick, disabled }: any) =>
        h("button", { "aria-label": ariaLabel, "data-icon": name, onClick, disabled }),

      TextButton: ({ children, onClick, disabled }: any) =>
        h("button", { onClick, disabled }, children),

      TextField: Object.assign(Field, { Clearable: Field, Password: PasswordField, Button: TextFieldButton }),

      // ── tds-essential가 가르치는(import 패턴에 싣는) 나머지 이름 ──
      // 팩토리 목은 없는 export를 읽는 순간 던진다 — 가르친 대로 쓴 화면의 테스트가 수집부터 죽지 않게
      // 최소 대역만 둔다(모양은 2.5.1 .d.ts: TextArea는 variant 필수 · ProgressBar는 progress 0~1 ·
      // FullScreenLoader는 open 없음 · useHaptic은 { generate } · useAppearance는 { colorScheme }).
      TextArea: React.forwardRef(
        ({ label, labelOption, help, hasError, variant, containerProps, id, ...props }: any, ref: any) => {
          const autoId = React.useId();
          const areaId = id ?? autoId;
          const current = props.value ?? props.defaultValue;
          const empty = current === undefined || current === null || String(current) === "";
          return h(
            "div",
            { "data-variant": variant, ...containerProps },
            label != null ? h("label", { htmlFor: areaId, hidden: (labelOption !== "sustain" && empty) || undefined }, label) : null,
            h("textarea", { ref, id: areaId, "aria-invalid": hasError ? true : undefined, ...props }),
            help != null ? h("span", { role: hasError ? "alert" : undefined, "data-slot": "help" }, help) : null,
          );
        },
      ),
      SearchField: React.forwardRef(({ onDeleteClick, fixed, takeSpace, className, ...props }: any, ref: any) =>
        h("input", { ref, type: "search", className, ...props }),
      ),
      // ProgressBar — 벤더(2.5.1 런타임)는 role=progressbar에 `aria-valuetext: "{progress×100}%"`를 달고 나머지 div
      // 속성(aria-label 등)을 그대로 펼친다. aria-valuenow는 쓰지 않는다 — 목도 같게 둔다(color는 data-*로만).
      ProgressBar: ({ progress, size, color, animate, className, ...props }: any) =>
        h("div", { role: "progressbar", "aria-valuetext": `${progress * 100}%`, "data-size": size, "data-color": color, className, ...props }),
      FullScreenLoader: ({ label }: any) => h("div", { role: "progressbar", "aria-label": label }, label ?? null),
      CTAButton: ctaButton("cta-button"),
      Tooltip: React.forwardRef(({ children, message, open, defaultOpen, onOpenChange, size, placement, ...props }: any, ref: any) =>
        h("span", { ref, "data-slot": "tooltip-anchor" }, children, open ? h("span", { role: "tooltip" }, message) : null),
      ),
      useBottomSheet: () => ({
        open: vi.fn(), close: vi.fn(),
        openOneButtonSheet: vi.fn(async () => true), openTwoButtonSheet: vi.fn(async () => "rightButtonClick"),
        openAsyncOneButtonSheet: vi.fn(async () => true), openAsyncTwoButtonSheet: vi.fn(async () => "rightButtonClick"),
      }),
      useHaptic: () => ({ generate: vi.fn() }),
      useAppearance: () => ({ colorScheme: "light" }),
      usePlatform: () => ({ os: undefined, fontScale: 1 }),
      useViewport: (_o?: unknown) => ({ width: 375, height: 812, offsetX: 0, offsetY: 0 }),
      useSafeAreaBottomHeight: (_o?: unknown) => 0,

      // Top — title과 벤더 슬롯(upper · subtitleTop · subtitleBottom · right · lower)을 그린다.
      Top: Object.assign(
        ({ children, title, subtitleTop, subtitleBottom, upper, lower, right }: any) =>
          h(
            "nav",
            { role: "navigation" },
            slot("upper", upper),
            subtitleTop != null ? h("p", { "data-slot": "subtitle-top" }, subtitleTop) : null,
            // title 슬롯은 컨테이너다 — 제목 요소(h1)는 Top.TitleParagraph가 그린다(h1 안의 h1 방지).
            title ? h("div", { "data-slot": "title" }, title) : null,
            subtitleBottom != null ? h("p", { "data-slot": "subtitle-bottom" }, subtitleBottom) : null,
            slot("right", right),
            slot("lower", lower),
            children,
          ),
        {
          TitleParagraph: ({ children }: any) => h("h1", null, children),
          SubtitleParagraph: ({ children }: any) => h("p", null, children),
          RightButton: plainButton,
          LowerButton: plainButton,
        },
      ),

      Border: () => h("hr"),

      // BottomSheet — 제목은 header, 버튼은 cta 슬롯(title prop은 없다). children은 본문이다.
      // 딤 클릭은 onDimmerClick과 onClose를 부른다(벤더 기본 — UNSAFE_ignoreDimmerClick이면 onClose는 안 부른다).
      BottomSheet: Object.assign(
        ({ open, children, header, headerDescription, cta, onClose, onDimmerClick, UNSAFE_ignoreDimmerClick, "aria-label": ariaLabel }: any) =>
          open
            ? h(
                "div",
                { role: "dialog", "aria-label": ariaLabel },
                dimmer(() => { onDimmerClick?.(); if (!UNSAFE_ignoreDimmerClick) onClose?.(); }),
                header != null ? h("header", { "data-slot": "header" }, header) : null,
                headerDescription != null ? h("div", { "data-slot": "header-description" }, headerDescription) : null,
                children,
                cta != null ? h("footer", { "data-slot": "cta" }, cta) : null,
              )
            : null,
        {
          Header: ({ children }: any) => h("div", null, children),
          HeaderDescription: ({ children }: any) => h("p", null, children),
          CTA: ctaButton(),
          DoubleCTA: doubleCta("bottom-sheet-double-cta"),
          Select: ({ options, value, onChange }: any) =>
            h(
              "div",
              { role: "radiogroup" },
              (options ?? []).map((o: any) =>
                h(
                  "label",
                  { key: String(o.value) },
                  h("input", { type: "radio", name: "bottom-sheet-select", value: o.value, checked: o.value === value, onChange }),
                  o.name ?? o.label ?? String(o.value),
                ),
              ),
            ),
        },
      ),

      // Chip은 칩 **그룹** 컨테이너다(벤더: ComponentWithAs<"div", ChipProps> — selected가 없다).
      // 칩 하나는 ChipItem이다. div prop(onClick 등)은 그룹 div로 그대로 간다 — 선택 상태를 흉내내지 않는다.
      Chip: ({ children, kind, shape, size, variant, margin, wrap, withColorBackground, ...props }: any) =>
        h("div", { role: "group", "data-kind": kind ?? "select", ...props }, children),

      // ChipItem — 눌리는 칩 하나. 선택 상태는 aria-pressed로 드러난다(getByRole("button", { pressed: true })).
      ChipItem: ({ children, selected, disabled, redDot, redDotAriaLabel, left, right, onClick, ...props }: any) =>
        h(
          "button",
          { type: "button", "aria-pressed": !!selected, "data-selected": selected ? "true" : undefined, disabled: disabled || undefined, onClick, ...props },
          slot("left", left),
          children,
          slot("right", right),
          redDot ? h("span", { "data-slot": "red-dot", "aria-label": redDotAriaLabel }) : null,
        ),
      ChipItemLeftIcon: ({ name, url }: any) => h("span", { "data-icon": name ?? url, "aria-hidden": true }),
      ChipItemRightIcon: ({ name, url, type }: any) => h("span", { "data-icon": name ?? url ?? type, "aria-hidden": true }),
      ChipItemRightNumber: ({ children, unit }: any) => h("span", { "data-slot": "number" }, children, unit ?? null),

      // Checkbox는 벤더에서 **네임스페이스**다({ Circle, Line, LineTransparent }) — <Checkbox/>는 실제
      // 토스에서도 렌더되지 않는다. onCheckedChange(checked)와 onChange(event) 둘 다 불린다.
      Checkbox: { Circle: checkboxBox, Line: checkboxBox, LineTransparent: checkboxBox },

      // Switch — onChange(event, checked): 두 번째 인자가 새 상태다(벤더 시그니처).
      Switch: ({ checked, defaultChecked, onChange, onClick, disabled, name, hasTouchEffect, ...props }: any) =>
        h("input", {
          type: "checkbox", role: "switch", checked, defaultChecked, disabled, name, onClick,
          onChange: (e: any) => onChange?.(e, e.target.checked),
          ...props,
        }),
    };
  });
}

// ── @apps-in-toss/web-framework ──
// Mocks the REAL SDK exports (verified from .d.ts).
// SDK is imperative (no hooks). Callback-style APIs invoke onEvent immediately for test speed.
export function mockAppsInToss() {
  vi.mock("@apps-in-toss/web-framework", () => {
    const Storage = {
      setItem: vi.fn(async (k: string, v: string) => { localStorage.setItem(k, v); }),
      getItem: vi.fn(async (k: string) => localStorage.getItem(k)),
      removeItem: vi.fn(async (k: string) => { localStorage.removeItem(k); }),
      clearItems: vi.fn(async () => { localStorage.clear(); }),
    };

    const Analytics = {
      screen: vi.fn(async () => {}),
      impression: vi.fn(async () => {}),
      click: vi.fn(async () => {}),
    };

    // 전면·보상형 광고 — 벤더 모양(web-framework 3.6.0 .d.ts): `({ options?: { adGroupId }, onEvent, onError })`를
    // 받고 **구독 해제 함수를 돌려주며**, `isSupported()`를 단다. 보상 신호는 `userEarnedReward` 하나다 —
    // SDK에 `rewarded` 이벤트는 없다(예전 목이 그걸로 보상해서, 보상 조건을 안 보는 소스가 초록이었다).
    // 기본 흐름: load → loaded / show → requested·show·impression·userEarnedReward·dismissed.
    // 다른 흐름은 테스트에서 mockImplementationOnce로 바꾼다.
    const loadFullScreenAd = Object.assign(
      vi.fn((p: { options?: { adGroupId: string }; onEvent: (e: any) => void; onError: (e: Error) => void }) => {
        const t = setTimeout(() => p.onEvent({ type: "loaded" }), 0);
        return vi.fn(() => clearTimeout(t));
      }),
      { isSupported: vi.fn(() => true) },
    );
    const showFullScreenAd = Object.assign(
      vi.fn((p: { options?: { adGroupId: string }; onEvent: (e: any) => void; onError: (e: Error) => void }) => {
        const t = setTimeout(() => {
          for (const e of [
            { type: "requested" },
            { type: "show" },
            { type: "impression" },
            { type: "userEarnedReward", data: { unitType: "reward", unitAmount: 1 } },
            { type: "dismissed" },
          ])
            p.onEvent(e);
        }, 0);
        return vi.fn(() => clearTimeout(t));
      }),
      { isSupported: vi.fn(() => true) },
    );
    // TossAds banner API (real SDK exports — see @apps-in-toss/web-bridge .d.ts)
    const TossAds = {
      initialize: Object.assign(vi.fn(), { isSupported: () => true }),
      attachBanner: Object.assign(
        vi.fn(() => ({ destroy: vi.fn() })),
        { isSupported: () => true },
      ),
      attach: Object.assign(vi.fn(), { isSupported: () => true }),
      destroy: Object.assign(vi.fn(), { isSupported: () => true }),
      destroyAll: Object.assign(vi.fn(), { isSupported: () => true }),
    };

    // IAP
    const createOneTimePurchaseOrder = vi.fn((opts: any) => {
      setTimeout(async () => {
        const granted = await opts.options.processProductGrant({ orderId: "test-order-1" });
        if (granted) {
          opts.onEvent?.({
            type: "success",
            data: {
              orderId: "test-order-1",
              displayName: "Test Product",
              displayAmount: "1,000원",
              amount: 1000,
              currency: "KRW",
              fraction: 0,
              miniAppIconUrl: null,
            },
          });
        }
      }, 0);
    });
    const createSubscriptionPurchaseOrder = vi.fn((opts: any) => {
      setTimeout(async () => {
        const granted = await opts.options.processProductGrant({
          orderId: "test-sub-1",
          subscriptionId: "test-sub",
        });
        if (granted) {
          opts.onEvent?.({
            type: "success",
            data: {
              orderId: "test-sub-1",
              displayName: "Test Subscription",
              displayAmount: "4,900원/월",
              amount: 4900,
              currency: "KRW",
              fraction: 0,
              miniAppIconUrl: null,
            },
          });
        }
      }, 0);
    });

    return {
      Storage,
      Analytics,

      generateHapticFeedback: vi.fn(),
      grantPromotionReward: vi.fn(async () => {}),
      getIsTossLoginIntegratedService: vi.fn(async () => false),

      loadFullScreenAd,
      showFullScreenAd,
      TossAds,

      // IAP 실제 API는 IAP 네임스페이스 아래에 있다(.d.ts 검증). 각 메서드는 cleanup 함수 반환.
      // (최상위 이름은 하위호환용으로 유지 — 실제 SDK 최상위 export 아님)
      createOneTimePurchaseOrder,
      createSubscriptionPurchaseOrder,
      IAP: {
        createOneTimePurchaseOrder: vi.fn((opts: any) => {
          createOneTimePurchaseOrder(opts);
          return () => {};
        }),
        createSubscriptionPurchaseOrder: vi.fn((opts: any) => {
          createSubscriptionPurchaseOrder(opts);
          return () => {};
        }),
      },

      // Misc bridge
      share: vi.fn(async () => {}),
      // 토스 인앱 딥링크 생성. devtools mock이 주는 형식(`https://toss.im/share/mock<path>`)을
      // 그대로 흉내낸다 — 심이 벤더의 *모양*과 어긋나면 앱이 아니라 심이 거짓말한다.
      getTossShareLink: vi.fn(async (path: string, _ogImageUrl?: string) => `https://toss.im/share/mock${path}`),
      setClipboardText: vi.fn(async () => {}),
      getClipboardText: vi.fn(async () => ""),
      requestReview: vi.fn(async () => {}),
      openURL: vi.fn(async () => {}),
      getPlatformOS: vi.fn(async () => "ios"),
      getNetworkStatus: vi.fn(async () => ({ connected: true, type: "wifi" })),
      getTossAppVersion: vi.fn(async () => "5.0.0"),
      getOperationalEnvironment: vi.fn(async () => "development"),
      getPermission: vi.fn(async () => ({ granted: true })),
      getSchemeUri: vi.fn(async () => "intoss://test-app"),
    };
  });
}

// ── 계측 래퍼 (@/lib/analytics · review · share) ──
// **부분 목을 직접 쓰지 마라.** vitest의 팩토리 목은 반환 객체를 Proxy로 감싸고, 팩토리가
// 돌려주지 않은 export를 **읽는 순간 throw**한다(`No "useScreenLog" export is defined on …`).
// `PageShell`/`ScreenScaffold`가 `useScreenLog`를 쓰므로, `logClick`만 돌려주는 목을 걸면
// 그 화면을 렌더하는 테스트가 전부 죽는다 — 에이전트가 만들지도 않은 템플릿 파일에서 나는
// 오류라 고칠 수도 없다. 이 헬퍼는 **전 export**를 돌려주므로 그 함정이 없다.
//
// 실제 래퍼는 어차피 throw하지 않으므로(SDK 목만 걸어도 안전) 목킹은 **호출을 단언하고 싶을 때만**
// 필요하다. 단언은 `analytics.logClick`처럼 네임스페이스로 가져와서 하면 된다:
//   import * as analytics from "@/lib/analytics";
//   expect(analytics.logClick).toHaveBeenCalledWith("calculate_submit");
export const mockLogScreen = vi.fn();
export const mockLogClick = vi.fn();
export const mockLogImpression = vi.fn();
export const mockRequestReviewOnce = vi.fn();
export const mockShareApp = vi.fn(async () => {});

export function mockAnalytics() {
  // vi.doMock — vi.mock은 함수 안에 있어도 파일 맨 위로 끌어올려져, mockAnalytics()를 부르지 않는 테스트가
  // 자기 `vi.mock("@/lib/analytics", …)`(예: logImpression 스파이)를 걸어도 이 헬퍼를 import하는 순간 덮어쓴다.
  vi.doMock("@/lib/analytics", () => ({
    // 값 export도 빠뜨리면 안 된다 — 접근 하나로 모듈 평가가 터진다(LogFields는 타입이라 런타임 export 없음).
    DWELL_MS: 3000,
    fireAndForget: vi.fn((call: () => unknown) => { try { void call(); } catch { /* noop */ } }),
    logScreen: mockLogScreen,
    logClick: mockLogClick,
    logImpression: mockLogImpression,
    // PageShell이 부르는 훅. 목에서는 아무것도 하지 않는다(렌더만 살리면 된다).
    useScreenLog: vi.fn(),
  }));
  // review·share도 doMock — 호이스팅된 vi.mock이 테스트 파일 자신의 review/share 목을 덮어쓰지 않게.
  vi.doMock("@/lib/review", () => ({ requestReviewOnce: mockRequestReviewOnce }));
  vi.doMock("@/lib/share", () => ({ shareApp: mockShareApp }));
}

// ── Toss Reward Ad Component ──
// TossRewardAd is a project-local component that wraps content behind ad viewing.
// In tests, render the children directly (ad always "watched").
export function mockTossRewardAd() {
  vi.mock("@/components/TossRewardAd", () => ({
    TossRewardAd: ({ children, onRewarded }: any) => {
      // Auto-trigger onRewarded in tests to unlock content (실제 컴포넌트의 prop 이름과 같다)
      if (onRewarded) setTimeout(onRewarded, 0);
      return children;
    },
    default: ({ children }: any) => children,
  }));
}

// ── react-router-dom ──
// Preserve actual router + override useNavigate for assertion.
export function mockRouter() {
  vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
    return {
      ...actual,
      useNavigate: () => mockNavigate,
      useLocation: () => mockLocation,
    };
  });
}

// ── Convenience: mock everything ──
export function mockAll() {
  mockTds();
  mockAppsInToss();
  mockTossRewardAd();
  mockRouter();
  mockAnalytics();
}
