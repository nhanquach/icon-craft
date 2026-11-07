# Product Requirements Document (PRD): IconCraft

**Project Name:** IconCraft  
**Document Version:** 1.0.0  
**Status:** Ready for Review  
**Target Release:** MVP (Phase 1)  

---

## 1. Executive Summary & Vision

### 1.1 Overview
IconCraft is an ultra-lightweight, zero-dependency SVG sprite compiler and type-safe icon management engine designed for modern web applications (React, Vite, Next.js). It transforms a local folder of raw SVG files into a single, high-performance SVG sprite sheet (`public/sprite.svg`) and automatically emits strict TypeScript type definitions and a drop-in `<Icon />` component.

### 1.2 Core Value Proposition
* **Zero External Dependencies:** Built entirely with Node.js standard libraries (`node:fs`, `node:path`), eliminating supply chain vulnerabilities, version rot, and `node_modules` overhead.
* **Peak Performance (<10ms builds):** Executes instantaneous compilation via targeted string and regex pipelines, bypassing heavy AST parsing overhead.
* **Strict TypeScript Safety:** Guarantees compile-time autocomplete and error detection for every icon name across the entire codebase.
* **Tailwind & CSS First:** Normalizes monochrome icons to inherit `currentColor`, unlocking direct styling via utility classes (e.g., `text-indigo-600 hover:text-indigo-700`).
* **Minimal DOM & Bundle Footprint:** Prevents bundle bloat and DOM memory overhead caused by inlining hundreds of separate SVG elements.

---

## 2. Problem Statement & Market Analysis

| Current Approach | Pain Points & Inefficiencies | How IconCraft Solves It |
| :--- | :--- | :--- |
| **Inlined SVG Components (e.g., SVGR, raw JSX)** | Inlines complex vector markup directly into JavaScript chunks, inflating bundle sizes and cluttering the DOM tree with duplicated nodes. | Moves all vector paths into a single static SVG sprite cached by the browser; components render a lightweight `<use href="..." />` tag. |
| **Pre-packaged Icon Packs (Lucide, Heroicons)** | Introduces external dependencies, potential version mismatch, and limited flexibility when custom branded icons are required from Figma. | Treats custom SVGs as first-class citizens with the exact same DX and type safety as third-party icon libraries. |
| **Manual SVG Sprites** | Developers must manually edit coordinates, strip hardcoded `#000000` fills, maintain XML symbols, and update string types by hand. | Automates cleaning, symbol wrapping, coordinate extraction, sprite compilation, and type generation with zero manual steps. |

---

## 3. User Personas & Target Audience

### Primary Persona: Senior Front-End / Design System Engineer
* **Profile:** Builds scalable UI design systems in React, TypeScript, and Tailwind CSS.
* **Needs:** Seamless integration with design assets exported from Figma, zero bundle overhead, and zero runtime surprises.
* **Frustrations:** Breaking UI icons due to untyped icon strings, wrestling with broken fill colors, and heavy build tools that slow down local Vite HMR.

### Secondary Persona: Indie Hacker / Solo Full-Stack Developer
* **Profile:** Ships fast MVPs using Next.js, Supabase, and Tailwind.
* **Needs:** Low-maintenance tooling, instant setup, zero configuration, and zero npm dependency maintenance.

---

## 4. System Architecture & Data Flow

```
┌──────────────────────────┐
│   Raw SVG Source Files   │  (e.g., src/icons/*.svg)
│  (Figma Exports, Icons)  │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   IconCraft Compiler     │  (Pure Node.js Standard Library)
│  ┌────────────────────┐  │
│  │ 1. Metadata Extr.  │  │  -> viewBox resolution, fallback to width/height
│  │ 2. Sanitization    │  │  -> Strip XML, doctype, comments, unneeded attrs
│  │ 3. Color Tokenizer │  │  -> Replace static fills/strokes with currentColor
│  │ 4. Symbol Packager │  │  -> Wrap inner markup inside <symbol id="icon-...">
│  └────────────────────┘  │
└────────────┬─────────────┘
             │
      ┌──────┴──────────────────────────┐
      ▼                                 ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│ Static SVG Sprite Sheet  │   │  TypeScript Definitions  │
│   (public/sprite.svg)    │   │ (src/components/types.ts)│
└─────────────┬────────────┘   └────────────┬─────────────┘
              │                             │
              └──────────────┬──────────────┘
                             ▼
              ┌──────────────────────────┐
              │  React <Icon /> Wrapper  │
              │ <use href="/sprite.svg" >│
              └──────────────────────────┘
```

---

## 5. Functional Requirements & Specifications

### 5.1 SVG Cleaning & Normalization Engine
* **Metadata Extraction:** Extract `viewBox` coordinates from root `<svg>` tags. If `viewBox` is absent, automatically construct one from `width` and `height` attributes (defaulting to `0 0 24 24` if undefined).
* **Sanitization:**
  * Strip XML declarations (`<?xml ... ?>`).
  * Strip DOCTYPE definitions (`<!DOCTYPE ... >`).
  * Strip HTML/XML comments (`<!-- ... -->`).
  * Remove redundant root attributes (`xmlns`, `version`, `width`, `height`, `class`, `id`).
* **Color Inheritance (Monochrome vs. Multi-color):**
  * By default, replace all static non-`none` fill attributes with `fill="currentColor"`.
  * Replace all static non-`none` stroke attributes with `stroke="currentColor"`.
  * Preserve `fill="none"` and `stroke="none"` intact.
  * **Multi-color Opt-out:** Files ending with `.color.svg` (e.g., `google.color.svg`) bypass color substitution, preserving original brand hues.

### 5.2 Sprite Generation (`public/sprite.svg`)
* Compile all sanitized assets into `<symbol>` elements with standardized identifiers:
  ```xml
  <symbol id="icon-[filename]" viewBox="0 0 24 24">
    <path ... />
  </symbol>
  ```
* Wrap all symbols inside an invisible root container:
  ```xml
  <svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
    <!-- symbols -->
  </svg>
  ```

### 5.3 Type Generation (`src/components/icon.types.ts`)
* Emit a readonly constant array containing all discovered icon identifiers sorted alphabetically.
* Export a union type derived directly from the array:
  ```typescript
  // Auto-generated by IconCraft — do not edit manually
  export const ICON_NAMES = [
    "arrow-left",
    "arrow-right",
    "check",
    "settings",
    "user",
  ] as const;

  export type IconName = (typeof ICON_NAMES)[number];
  ```

### 5.4 React Component Implementation (`<Icon />`)
* Provide a typed, accessible component wrapper:
  ```tsx
  import type { SVGProps } from "react";
  import type { IconName } from "./icon.types";

  export interface IconProps extends SVGProps<SVGSVGElement> {
    name: IconName;
    size?: number | string;
    title?: string;
  }

  export function Icon({
    name,
    size = 20,
    title,
    className,
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

### 5.5 CLI & Developer Workflow
* **Command Syntax:**
  * One-off build: `node scripts/generate-icons.mjs`
  * Watch mode: `node scripts/generate-icons.mjs --watch`
* **Watch Mode Behavior:**
  * Uses Node.js native `fs.watch` to monitor the input directory.
  * Debounces rebuild triggers by 50ms to handle atomic file writes from design tools.
  * Automatically updates both `sprite.svg` and `icon.types.ts` upon file creation, modification, or deletion.

---

## 6. Non-Functional Requirements

### 6.1 Performance & Latency
* **Build Time:** Compilation for 100 SVG files must complete in under 20 milliseconds on standard developer hardware.
* **Watch Latency:** File change detection and re-generation must finish within 30 milliseconds of saving a file.
* **Zero Runtime Overhead:** Zero client-side JavaScript execution cost for icon parsing.

### 6.2 Portability & Compatibility
* **Runtimes:** Fully compatible with Node.js v18.0.0+, Bun v1.0.0+, and Deno v1.35.0+.
* **Module Formats:** Supports both ESM (`.mjs`) and CommonJS (`.cjs`).
* **Browser Support:** Supports all modern evergreen browsers (Chrome, Firefox, Safari, Edge) supporting SVG `<use href="...">`.
* **Framework Agnostic:** While the initial reference wrapper is React, the generated sprite and type definitions can be used in Vue 3, Svelte, or vanilla web components.

### 6.3 Accessibility (a11y)
* Default icons render with `aria-hidden="true"` and `focusable="false"` to prevent screen reader noise.
* Providing a `title` prop automatically switches the role to `role="img"` and injects an accessible `<title>` tag.

---

## 7. Configuration Options

IconCraft provides sensible defaults with optional CLI flags or environment configuration:

| Setting | Default Value | Description |
| :--- | :--- | :--- |
| `inputDir` | `src/icons` | Directory containing raw `.svg` files |
| `outputSprite` | `public/sprite.svg` | Destination path for the compiled sprite sheet |
| `outputTypes` | `src/components/icon.types.ts` | Destination path for generated TypeScript declarations |
| `prefix` | `icon-` | Symbol ID prefix applied inside the sprite sheet |
| `colorMode` | `auto` | Auto-replaces colors unless filename includes `.color.svg` |

---

## 8. Release Roadmap & Milestones

### Phase 1: Core Engine & MVP (Current Scope)
- [x] Zero-dependency Node.js compiler script (`scripts/generate-icons.mjs`).
- [x] Monochrome color normalization (`fill="currentColor"`, `stroke="currentColor"`).
- [x] TypeScript union type generation (`icon.types.ts`).
- [x] Native `fs.watch` integration for local development.
- [x] Reference accessible React `<Icon />` component.

### Phase 2: Developer Experience & Packaging (Sprint 2)
- [ ] Multi-color icon preservation flag (`*.color.svg`).
- [ ] Configurable CLI arguments (`--input`, `--output-sprite`, `--output-types`).
- [ ] Standalone zero-dependency npm executable (`npx iconcraft`).
- [ ] Sub-directory nesting support (e.g., `src/icons/social/github.svg` -> `social-github`).

### Phase 3: Ecosystem Integrations (Sprint 3)
- [ ] Dedicated zero-dependency Vite plugin (`vite-plugin-iconcraft`) with seamless HMR.
- [ ] Headless Figma API sync script to fetch updated frames directly into `src/icons`.
- [ ] GitHub Action workflow for automatic pull request validation.

---

## 9. Success Metrics & KPIs

1. **Bundle Efficiency:** Greater than 80% bundle size savings compared to inline JSX SVG wrappers across a 50-icon application.
2. **Execution Speed:** Sub-15ms compile times across standard icon sets.
3. **Type Coverage:** 100% type safety with zero `any` types emitted.
4. **Maintenance Index:** Zero npm dependency audit alerts or version deprecation issues.
