# IconCraft — Technical Specifications Document

**Project:** IconCraft  
**Version:** 1.0.0  
**Status:** Approved for Implementation  
**Target Runtime:** Node.js v18+, Vite 6+, React 19, TypeScript 5+  
**Document Type:** Engineering System Specification  

---

## 1. System Overview & Architecture

IconCraft is an ultra-lightweight, zero-dependency SVG sprite compiler and type-safe icon management engine. It transforms raw SVG files into a single, high-performance static SVG sprite (`public/sprite.svg`) and automatically emits strict TypeScript type definitions (`src/components/icon.types.ts`) and a drop-in `<Icon />` React component (`src/components/Icon.tsx`).

```
┌─────────────────────────────────┐
│     Raw SVG Source Folder       │  (e.g., src/icons/*.svg)
│    • Monochrome & Multi-color   │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│   IconCraft Compiler Script     │  (Pure Node.js: node:fs, node:path)
│   • XML / DOCTYPE / Comments    │
│   • Coordinate Resolution       │
│   • currentColor Tokenizer      │
│   • <symbol id="..."> Packaging │
└────────────────┬────────────────┘
                 │
      ┌──────────┴────────────────────────┐
      ▼                                   ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│ Static SVG Sprite Sheet   │   │ TypeScript Declarations   │
│    (public/sprite.svg)    │   │ (src/components/types.ts) │
└─────────────┬─────────────┘   └─────────────┬─────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
              ┌───────────────────────────┐
              │  Accessible React <Icon>  │
              │ <use href="/sprite.svg" > │
              └───────────────────────────┘
```

---

## 2. Prioritized Requirement Matrix

| Priority | ID | Feature / Component | Description | Target File |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | **SPEC-01** | SVG Cleaning & Sanitization | Pure Node.js regex pipeline to strip XML declarations, DOCTYPEs, comments, and redundant root attributes. | `scripts/generate-icons.mjs` |
| **P0** | **SPEC-02** | Coordinate & viewBox Normalization | Extract `viewBox` or infer coordinates from `width`/`height`, defaulting safely to `0 0 24 24`. | `scripts/generate-icons.mjs` |
| **P0** | **SPEC-03** | Color Tokenizer & Multi-color Opt-out | Replace static `fill` and `stroke` with `currentColor`; preserve `none`; bypass `.color.svg` files. | `scripts/generate-icons.mjs` |
| **P0** | **SPEC-04** | Sprite Sheet Generation | Compile sanitized symbols inside an invisible `<svg style="display: none;">` sprite bundle. | `public/sprite.svg` |
| **P0** | **SPEC-05** | TypeScript Definition Generation | Emit sorted, readonly array of icon names and strict union type `IconName`. | `src/components/icon.types.ts` |
| **P1** | **SPEC-06** | React `<Icon />` Wrapper Component | Type-safe, accessible SVG component rendering `<use href="/sprite.svg#icon-${name}" />`. | `src/components/Icon.tsx` |
| **P1** | **SPEC-07** | Build Scripts & CLI Integration | Integrate `npm run icons` and `npm run icons:watch` into project build workflow. | `package.json`, `scripts/` |
| **P1** | **SPEC-08** | Native Watch Mode with Debounce | Continuous directory monitoring using `node:fs` with a 50ms debounce window. | `scripts/generate-icons.mjs` |
| **P2** | **SPEC-09** | Interactive Showcase & Testbed UI | Full-featured UI: icon search, copyable JSX, dynamic size/color testing, sprite metrics. | `src/App.tsx` |
| **P2** | **SPEC-10** | Configurable CLI Flag Overrides | Support `--input`, `--output-sprite`, `--output-types`, `--prefix`, `--color-mode`. | `scripts/generate-icons.mjs` |

---

## 3. Subsystem Specifications

### 3.1 SPEC-01 to SPEC-04: Node.js Compiler Engine (`scripts/generate-icons.mjs`)

#### 3.1.1 Zero External Dependencies
* The script must strictly use Node.js standard modules (`node:fs`, `node:fs/promises`, `node:path`, `node:url`, `node:process`).
* No AST parser dependencies (no Cheerio, SVGO, or Babel) to guarantee sub-15ms execution time and zero maintenance vulnerabilities.

#### 3.1.2 Sanitization Rules
1. Strip XML declaration: `<\?xml.*?\?>`
2. Strip DOCTYPE: `<!DOCTYPE.*?>`
3. Strip XML/HTML comments: `<!--[\s\S]*?-->`
4. Strip non-essential root `<svg>` attributes: `xmlns`, `version`, `width`, `height`, `class`, `id`, `style`.
5. Strip or neutralize embedded `<style>` tags to prevent cross-contamination.

#### 3.1.3 Coordinate & viewBox Resolution
* Locate root `viewBox="x y w h"` attribute.
* If absent:
  - Match `width="(\d+(\.\d+)?)(px)?"` and `height="(\d+(\.\d+)?)(px)?"`.
  - If both exist, resolve `viewBox="0 0 ${width} ${height}"`.
  - If neither exists, fallback to `viewBox="0 0 24 24"`.

#### 3.1.4 Color Tokenization (Monochrome vs. Multi-Color)
* **Multi-Color Files:** Files ending with `.color.svg` (e.g. `google.color.svg`, `slack.color.svg`) or containing `--color` bypass color mutation. All original fills, gradients, strokes, and stop-colors are preserved.
* **Monochrome Files:**
  - Replace `fill="(?!none|currentColor)[^"]*"` with `fill="currentColor"`.
  - Replace `stroke="(?!none|currentColor)[^"]*"` with `stroke="currentColor"`.
  - Preserve `fill="none"` and `stroke="none"`.
  - If neither `fill` nor `stroke` exists on leaf path elements, allow root or CSS cascade inheritance.

#### 3.1.5 Symbol Packaging & Sprite Output
* Clean icon name identifier:
  - Remove file extensions (`.color.svg` or `.svg`).
  - Sanitize to kebab-case: lowercase, replace spaces/underscores with `-`, strip invalid characters.
* Package each icon as:
  ```xml
  <symbol id="icon-${name}" viewBox="${viewBox}">
    ${innerMarkup}
  </symbol>
  ```
* Wrap all symbols inside:
  ```xml
  <svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
    <!-- symbols sorted alphabetically -->
  </svg>
  ```
* Output destination: `public/sprite.svg` (ensures atomic writes).

---

### 3.2 SPEC-05: Type Definition Generation (`src/components/icon.types.ts`)

* Generate deterministic, alphabetically sorted TypeScript declaration file:
  ```typescript
  // Auto-generated by IconCraft — do not edit manually

  export const ICON_NAMES = [
    "arrow-left",
    "arrow-right",
    "check",
    "google",
    "settings",
    "user",
  ] as const;

  export type IconName = (typeof ICON_NAMES)[number];
  ```
* Ensures 100% compile-time autocomplete and type safety when passing icon names in code.

---

### 3.3 SPEC-06: React `<Icon />` Wrapper Component (`src/components/Icon.tsx`)

* **Contract:**
  ```tsx
  import type { SVGProps } from "react";
  import type { IconName } from "./icon.types";

  export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
    name: IconName;
    size?: number | string;
    title?: string;
  }

  export function Icon({
    name,
    size = 20,
    title,
    className = "",
    ...props
  }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        className={className}
        aria-hidden={title ? undefined : "true"}
        role={title ? "img" : undefined}
        focusable="false"
        {...props}
      >
        {title && <title>{title}</title>}
        <use href={`/sprite.svg#icon-${name}`} />
      </svg>
    );
  }
  ```
* **Accessibility:**
  - When `title` is absent: `aria-hidden="true"`, `focusable="false"`.
  - When `title` is supplied: `role="img"`, `<title>{title}</title>` embedded for screen readers.
* **Styling:** Fully responsive to Tailwind CSS classes (e.g., `text-indigo-600 hover:text-indigo-700 w-6 h-6`).

---

### 3.4 SPEC-07 & SPEC-08: CLI Execution & Native Watch Mode

* **CLI Syntax:**
  - `node scripts/generate-icons.mjs` (single build)
  - `node scripts/generate-icons.mjs --watch` (continuous monitoring)
* **Watch Mode Architecture:**
  - Watch `src/icons` using `node:fs.watch`.
  - Implement a 50ms debounce queue to avoid duplicate compilation on atomic file updates or multi-file design tool exports.
  - Automatically regenerate both `public/sprite.svg` and `src/components/icon.types.ts` upon file addition, change, or deletion.
* **NPM Scripts:**
  - `"icons"`: `"node scripts/generate-icons.mjs"`
  - `"icons:watch"`: `"node scripts/generate-icons.mjs --watch"`
  - `"prebuild"`: `"node scripts/generate-icons.mjs"` (guarantees sprite and types are built before `vite build`)

---

### 3.5 SPEC-09: Interactive Showcase & Testbed UI (`src/App.tsx`)

The application frontend serves as both the developer reference and interactive testing suite:
1. **Interactive Icon Catalog:**
   - Visual grid of all compiled icons rendered using the `<Icon />` component.
   - Live search filter by name and category (Navigation, Actions, System, Brand).
2. **Interactive Playground:**
   - Global size slider (16px to 64px).
   - Dynamic color selector (testing Tailwind text colors and `currentColor` propagation).
   - Stroke/fill style toggle.
3. **Developer Tools:**
   - One-click copy for JSX code (`<Icon name="..." size={24} className="..." />`).
   - Sprite diagnostics: Total icon count, file size of `public/sprite.svg`, estimated bundle savings vs. inline SVG.
   - Live Raw SVG Tester: Allows developers to paste or preview an SVG to test normalization on the fly.

---

## 4. Verification & Testing Matrix

| Test Case | Scenario | Expected Behavior |
| :--- | :--- | :--- |
| **TC-01** | Missing `viewBox` attribute | Inferred from `width`/`height` or defaults to `0 0 24 24` without crash. |
| **TC-02** | Static `#000000` / `#fff` fills | Replaced with `currentColor` for monochrome icons. |
| **TC-03** | `*.color.svg` multi-color icon | Preserves original hex colors, gradients, and stop-colors intact. |
| **TC-04** | Malformed comments / DOCTYPE | Completely stripped from final `<symbol>`. |
| **TC-05** | Empty icon folder | Gracefully emits empty sprite container and empty `ICON_NAMES` array without exception. |
| **TC-06** | Screen reader accessibility | Renders `role="img"` with `<title>` when title prop is provided; `aria-hidden="true"` otherwise. |
| **TC-07** | Atomic write / burst changes | Debounced by 50ms; executes exactly one compilation pass. |

---

## 5. Definition of Done (DoD)

1. `SPECS.md` committed to source control.
2. `scripts/generate-icons.mjs` executes cleanly with zero external npm dependencies.
3. `src/icons/` populated with diverse monochrome and multi-color vector icons.
4. `public/sprite.svg` and `src/components/icon.types.ts` automatically generated and validated.
5. `<Icon />` component passes all TypeScript checks with zero type casting or `any`.
6. Interactive testbed renders icons in Vite dev server with zero console errors.
