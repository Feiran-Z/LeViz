# Design System: LeViz

> **Scope:** Visual design language — color, typography, spacing, component styling, and interaction states.
> **Audience:** AI coding agents and developers implementing the UI.
> **Constraint:** Optimized for **long planning sessions**. Every color and type choice must reduce eye fatigue, not maximize visual impact. When a choice is ambiguous, prefer the calmer, lower-contrast option.

---

## 1. Design Principles

1. **Calm by default.** The interface should recede so the lesson content and canvas are the focus. No decorative color, no visual noise, no competing accents.
2. **Warm, not clinical.** Pure white (#FFFFFF) and pure black (#000000) are prohibited. Backgrounds carry a warm tint; text is softened charcoal, never absolute black.
3. **Contrast with restraint.** Text must be legible, but large areas of maximum contrast (black on white) cause glare over hours. Target **moderate contrast** for body text and reserve higher contrast for small UI labels and icons.
4. **Color carries meaning, never decoration.** Accent colors appear only for actions, selection, and status. Everything else is neutral.
5. **Dual themes, equal comfort.** Light and dark themes are both first-class. Neither is an afterthought. Teachers plan at night as often as in daylight.
6. **The canvas is the hero.** Chrome around the canvas should be visually quiet. The canvas surface itself should feel like paper or a soft drafting table, not a glowing screen.

---

## 2. Color System

### 2.1 Foundation: Warm Neutrals

The entire neutral ramp is warmed. No cool blue-grays. The base hue is approximately **40° on the color wheel** (warm greige / stone / parchment).

| Token | Hex | Role |
|---|---|---|
| `neutral-50` | `#FAF9F6` | Light theme page background (warm off-white) |
| `neutral-100` | `#F4F2ED` | Light theme surface (panels, cards) |
| `neutral-200` | `#E8E5DE` | Light theme borders, dividers |
| `neutral-300` | `#D6D1C7` | Light theme disabled fills |
| `neutral-400` | `#B0A99D` | Light theme placeholder text |
| `neutral-500` | `#8A8378` | Light theme secondary text |
| `neutral-600` | `#625C53` | Light theme tertiary text |
| `neutral-700` | `#3F3A34` | Light theme primary text (soft charcoal, not black) |
| `neutral-800` | `#2A2622` | Light theme headings |
| `neutral-900` | `#1C1917` | Reserved for icons and high-emphasis text only |

**Why these values:** #FAF9F6 avoids the glare of #FFFFFF while remaining paper-like. #3F3A34 provides roughly 9:1 contrast against #FAF9F6 — legible without the harshness of #000 on #FFF. This mirrors the logic behind warm-paper reading themes like Solarized Sepia and the Warm Light Reading palette (#FAF7F2 / #3A3A3A).

### 2.2 Light Theme Semantic Tokens

| Semantic token | Value | Usage |
|---|---|---|
| `--bg-page` | `#FAF9F6` | App background |
| `--bg-surface` | `#F4F2ED` | Panels, cards, popovers |
| `--bg-canvas` | `#FBF9F4` | Konva canvas stage background |
| `--bg-chrome` | `#E5EBDF` | Editor top bar — a distinct sage-tinted chrome so the lesson identity bar stands out |
| `--bg-elevated` | `#FFFFFF` | Modals only (rare); never full-page |
| `--border-default` | `#E8E5DE` | Dividers, card outlines |
| `--border-strong` | `#D6D1C7` | Input borders, focused dividers |
| `--text-primary` | `#3F3A34` | Body text, labels |
| `--text-secondary` | `#8A8378` | Descriptions, metadata |
| `--text-placeholder` | `#B0A99D` | Empty input hints |
| `--text-inverse` | `#FAF9F6` | Text on accent backgrounds |

### 2.3 Dark Theme Semantic Tokens

The dark theme follows the Umber Calm principle: **warm near-black, never pure black; warm off-white, never pure white**.

| Semantic token | Value | Usage |
|---|---|---|
| `--bg-page` | `#1A1816` | App background |
| `--bg-surface` | `#23201D` | Panels, cards |
| `--bg-canvas` | `#201D1A` | Canvas stage background |
| `--bg-chrome` | `#2A3129` | Editor top bar — deep sage-charcoal chrome |
| `--bg-elevated` | `#2C2824` | Popovers, tooltips |
| `--border-default` | `#35302B` | Dividers |
| `--border-strong` | `#4A443D` | Input borders |
| `--text-primary` | `#E8E2D9` | Body text (warm off-white) |
| `--text-secondary` | `#A69E93` | Descriptions |
| `--text-placeholder` | `#6B645B` | Empty hints |
| `--text-inverse` | `#1A1816` | Text on accent backgrounds |

Contrast ratios in dark mode: `#E8E2D9` on `#1A1816` ≈ 12:1 — high legibility without the harsh glow of white on black. This is consistent with the low-glare dark palettes recommended for long sessions.

### 2.4 Accent Colors

Accents are **desaturated and earthy**. They appear only on interactive elements, selection states, and status indicators.

| Accent | Light theme | Dark theme | Usage |
|---|---|---|---|
| **Primary (action)** | `#5B6E5A` (olive-sage) | `#8FA68D` (soft sage) | Primary buttons, active toggles, selected segment |
| **Primary hover** | `#4A5A49` | `#A3B8A0` | Hover state |
| **Selection** | `#7C8B7A` at 20% opacity | `#8FA68D` at 25% opacity | Canvas node selection, text selection |
| **Info / link** | `#5E6B7A` (muted slate) | `#8A9BAB` | Links, informational badges |
| **Warning** | `#9C7A4A` (ochre) | `#C4A06A` | Over-budget time warning, constraint violations |
| **Error** | `#9C5A4A` (terracotta) | `#C47A6A` | Destructive actions, unsaved error state |
| **Success** | `#5A7A5E` (muted forest) | `#8AA88D` | Successful save indicator |

**Rules for accents:**
- Never use saturated primary colors (no `#0066FF`, no `#FF0000`). Accent saturation stays below ~40%.
- Never place accent text on accent backgrounds. Use `--text-inverse` on solid accent fills.
- Warning and error colors are reserved for those states only. They must never appear decoratively.
- The olive-sage primary was chosen over blue because blue-heavy interfaces are associated with a “corporate/cold” feel; sage aligns with calm, focused productivity tools.

### 2.5 Canvas-Specific Colors

The canvas has its own palette so it can feel distinct from the surrounding UI without introducing new accent hues.

| Element | Light theme | Dark theme |
|---|---|---|
| Canvas background | `#FBF9F4` | `#201D1A` |
| Grid dots (if shown) | `#E8E5DE` | `#2C2824` |
| Node fill (default) | `#F4F2ED` | `#2C2824` |
| Node stroke | `#D6D1C7` | `#4A443D` |
| Node label | `#3F3A34` | `#E8E2D9` |
| Station fill | `#EDEBE4` | `#302C27` |
| Student chip fill | `#E8E5DE` | `#35302B` |
| Student chip text | `#3F3A34` | `#E8E2D9` |
| Snap guide line | `#B0A99D` at 40% | `#6B645B` at 40% |
| Drop target highlight | `#5B6E5A` at 15% | `#8FA68D` at 20% |

The canvas background is deliberately the lightest (or darkest) neutral so placed nodes read as objects on a surface, not as holes in the UI.

---

## 3. Typography

### 3.1 Font Families

Two families only. A screen-optimized sans for the interface and a readable serif for lesson content.

| Role | Family | Fallback stack |
|---|---|---|
| **UI / Interface** | **Inter** | `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| **Lesson content** | **Merriweather** | `Merriweather, Georgia, "Times New Roman", serif` |

**Why Inter for UI:** designed specifically for computer screens; tall x-height, open apertures, and tuned spacing keep dense UI labels crisp at small sizes. It is the consensus recommendation for product UI in 2026[reference:4].

**Why Merriweather for lesson content:** designed for on-screen reading; classic structure with digital clarity. Used only in text segments (openings, debriefs, exit tickets) where teachers read and write extended prose[reference:5]. This creates a clear visual separation between “the tool” and “the lesson.”

**Do not use:** more than two families. Do not use Merriweather for UI labels or Inter for long prose. The boundary is semantic: UI chrome is sans; lesson text is serif.

### 3.2 Type Scale

A modest scale. No display sizes; this is a productivity tool, not a marketing page.

| Token | Size / Line height | Weight | Family | Usage |
|---|---|---|---|---|
| `text-xs` | 12px / 16px | 500 | Inter | Metadata, badges, canvas node labels |
| `text-sm` | 13px / 20px | 400 | Inter | Secondary UI text, helper text |
| `text-base` | 14px / 22px | 400 | Inter | Default UI body, inputs, buttons |
| `text-md` | 16px / 26px | 400 | Merriweather | **Lesson content (text segments)** |
| `text-lg` | 18px / 28px | 600 | Inter | Panel headings, segment labels |
| `text-xl` | 22px / 30px | 600 | Inter | Page titles (lesson list) |
| `text-2xl` | 28px / 36px | 700 | Inter | Rare — modal titles only |

**Key decisions:**
- The default UI size is **14px**, not 16px. At 14px Inter remains fully legible, and the denser layout suits a canvas-heavy tool with side panels.
- Lesson content uses **16px Merriweather**, which reads larger than 16px Inter due to its larger x-height and serif construction. This is intentional: planning text should feel comfortable to read for extended periods.
- Minimum size is **12px**, used only for canvas node labels and badges. Never for body text.

### 3.3 Weight and Spacing Rules

- **Regular (400)** for all body text and lesson content.
- **Medium (500)** for UI labels, canvas node labels, and table headers.
- **Semibold (600)** for panel headings and segment labels.
- **Bold (700)** only for page titles and modal titles. Never for body emphasis in lesson content; use italic sparingly instead.
- Line height never below **1.4** for UI text and **1.6** for lesson content.
- Letter spacing: `0` for Inter at all sizes; `-0.01em` for Merriweather at 16px to tighten the serif slightly.

---

## 4. Layout and Spacing

### 4.1 Spacing Scale

Base unit: **4px**. Use only these values.

| Token | Value |
|---|---|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |

### 4.2 Application Shell Dimensions

| Region | Width / Height |
|---|---|
| Top bar | 48px height |
| Left panel (segment outline) | 260px width, collapsible to 48px |
| Right panel | 300px width, collapsible to 48px |
| Canvas area | Remaining space, minimum 480px width |
| Panel internal padding | 16px (`space-4`) |

The three-column shell is fixed. The canvas never scrolls vertically at the page level; the canvas itself handles pan and zoom.

**Overview mode.** A read-only lesson overview replaces the three-column shell with a single scrolling page: lesson stats, then every segment in order with rendered prose, a room thumbnail, and node annotations. The top bar stays (and is hidden when printing); each segment carries an Edit affordance that returns to the editor with that segment active.

### 4.3 Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4px | Inputs, small buttons, badges |
| `radius-md` | 6px | Cards, panels, canvas nodes |
| `radius-lg` | 8px | Modals, popovers |
| `radius-full` | 9999px | Student chips, avatars |

Rounded, but not pill-shaped. A 6px radius reads as “soft” without feeling playful.

---

## 5. Component Design

### 5.1 Buttons

| Variant | Background | Text | Border | Usage |
|---|---|---|---|---|
| **Primary** | `--accent-primary` | `--text-inverse` | None | One per screen region (e.g., “Save”, “Generate groups”) |
| **Secondary** | Transparent | `--text-primary` | `--border-strong` | Most actions |
| **Ghost** | Transparent | `--text-secondary` | None | Toolbar icons, panel toggles |
| **Destructive** | Transparent | `--accent-error` | `--accent-error` at 30% | Delete actions, with confirmation |

Height: 32px for standard, 28px for compact (panel toolbars). Padding: `space-3` horizontal. Font: `text-base` / 500. No shadows on buttons. Hover states shift background by one neutral step, never by adding saturation.

### 5.2 Panels and Cards

- Background: `--bg-surface`.
- Border: 1px solid `--border-default`. No drop shadows except on floating elements (popovers, dropdowns).
- Panel headers use `text-lg` / 600 / Inter.
- No colored left borders or accent stripes. Structure comes from spacing and typography, not decoration.

### 5.3 Canvas Nodes

- Fill: `--node-fill`. Stroke: 1px `--node-stroke`.
- Selected state: stroke changes to `--accent-primary` at 2px; no glow, no shadow.
- Node label: `text-xs` / 500 / Inter, centered.
- Student chips inside a node: `radius-full`, height 20px, `text-xs`. Chips use `--student-chip-fill` and `--student-chip-text`.
- **Do not use color to distinguish node types.** A station and a desk are distinguished by label and shape, not by hue. Color in the canvas is reserved for selection and drop-target feedback.

### 5.4 Inputs and Text Areas

- Background: `--bg-page` (slightly recessed from the panel surface).
- Border: 1px `--border-default`; on focus, 1px `--accent-primary`.
- No box shadow on focus. The border change is sufficient.
- Placeholder: `--text-placeholder`, regular weight.
- Text segments (TipTap): background `--bg-page`, `text-md` Merriweather, padding `space-4`, minimum height 120px. The editor chrome (toolbar) appears only on focus and uses ghost buttons.

### 5.5 Time Budget Bar

A thin horizontal bar in the top bar, 4px height. Background `--border-default`. Fill `--accent-primary` when under budget, `--accent-warning` when over. No percentage label unless the user hovers.

---

## 6. Interaction States

| State | Treatment |
|---|---|
| **Hover** | Background shifts one neutral step darker (light) or lighter (dark). No color change. |
| **Focus** | 1px border in `--accent-primary`; no glow. Keyboard focus additionally shows a 2px offset outline in `--accent-primary` at 40% opacity for accessibility. |
| **Active / Pressed** | Background shifts two neutral steps. No scale transform. |
| **Selected (canvas)** | Node stroke becomes `--accent-primary` at 2px. No fill change. |
| **Disabled** | 40% opacity on text; no background change. Cursor `not-allowed`. |
| **Drag** | Dragged node at 80% opacity. Drop target receives a 2px dashed `--accent-primary` outline and a 15% opacity fill overlay. |
| **Constraint violation** | Student chip or node label turns `--accent-warning`. A small warning icon appears inline. No blinking, no red flash. |

**Motion:** transitions are 120ms ease-out on background and border only. No entrance animations, no spring physics, no attention-seeking motion. The canvas node drag is direct manipulation with no easing.

---

## 7. Accessibility Requirements

| Requirement | Specification |
|---|---|
| **Contrast** | Body text ≥ 7:1 against its background; large text and UI labels ≥ 4.5:1. Both themes must pass. |
| **Focus visibility** | Every interactive element has a visible keyboard focus state. The focus ring is `--accent-primary` at 40% opacity, 2px, offset 2px. |
| **Color independence** | No state is conveyed by color alone. Warnings carry an icon; selection carries a stroke; errors carry text. |
| **Target size** | Minimum 32×32px for all interactive controls; 24×24px for canvas resize handles. |
| **Reduced motion** | Respect `prefers-reduced-motion`: disable all transitions. |
| **Font scaling** | Layout must remain usable at 200% browser zoom. Panels collapse; canvas remains pannable. |
| **Theme switching** | Light/dark follows `prefers-color-scheme` by default; a manual toggle in the top bar overrides it and persists. |

Dark mode is not optional. Teachers plan late; the tool must be comfortable at night[reference:6].

---

## 8. Implementation Tokens (Tailwind / CSS Variables)

All colors must be defined as CSS custom properties on `:root` and `[data-theme="dark"]`, then referenced in Tailwind via `theme.extend.colors`.

```css
:root {
  --bg-page: #FAF9F6;
  --bg-surface: #F4F2ED;
  --bg-canvas: #FBF9F4;
  --bg-chrome: #E5EBDF;
  --border-default: #E8E5DE;
  --border-strong: #D6D1C7;
  --text-primary: #3F3A34;
  --text-secondary: #8A8378;
  --text-placeholder: #B0A99D;
  --accent-primary: #5B6E5A;
  --accent-warning: #9C7A4A;
  --accent-error: #9C5A4A;
  --accent-success: #5A7A5E;
  --node-fill: #F4F2ED;
  --node-stroke: #D6D1C7;
}

[data-theme="dark"] {
  --bg-page: #1A1816;
  --bg-surface: #23201D;
  --bg-canvas: #201D1A;
  --bg-chrome: #2A3129;
  --border-default: #35302B;
  --border-strong: #4A443D;
  --text-primary: #E8E2D9;
  --text-secondary: #A69E93;
  --text-placeholder: #6B645B;
  --accent-primary: #8FA68D;
  --accent-warning: #C4A06A;
  --accent-error: #C47A6A;
  --accent-success: #8AA88D;
  --node-fill: #2C2824;
  --node-stroke: #4A443D;
}
```

**Rule**: components use semantic tokens (`bg-surface`, `text-primary`), never raw hex values. This is what makes theme switching a one-line change and prevents color drift across the canvas, panels, and modals.

## 9. What to Avoid

| Prohibited | Reason |
|---|---|
| Pure white #FFFFFF backgrounds | Glare over long sessions; use #FAF9F6 instead |
| Pure black #000000 text or backgrounds | Harsh contrast and OLED pixel-off glare; use #3F3A34 / #1A1816 |
| Saturated blues, reds, or purples as primary accents | Visually loud; compete with canvas content |
|Drop shadows on flat surfaces | Adds visual noise without hierarchy benefit |
| More than two font families | Typographic noise; Inter + Merriweather is sufficient |
| Color-coding canvas node types | Color must mean selection or status, not category |
| Animated transitions longer than 150ms | Feels sluggish and distracting during planning |
| Full-page #FFFFFF modals in light mode | Use --bg-surface; white is reserved for nothing |

*End of document. Design changes must be reflected here before or alongside the UI code. When in doubt, choose the warmer, quieter option.*