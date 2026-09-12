# Zen Music — Project Rules & Guidelines

## 1. Design System & Theme Color Policy (STRICT)

Whenever adding, updating, or styling UI elements, components, dialogs, pills, drag-and-drop indicators, or menus, you **MUST** strictly adhere to the project Design System defined in [docs/DESIGN_SYSTEM.md](file:///c:/Users/eyez/Documents/zen-music/docs/DESIGN_SYSTEM.md).

### Theme Palette Rules:
- **Light Theme**:
  - Base colors: Clean whites, light grays (`#F8FAFC`, `#F1F5F9`).
  - Typography: Dark slate / charcoal (`#0F172A`, `#334155`, `#475569`).
  - **Accent color**: `#0F172A` (Obsidian Slate).
  - Active elements / pills: `bg-[#0F172A] text-white`.
  - Drop indicators / drag highlights: `bg-[#0F172A] shadow-[0_0_8px_rgba(15,23,42,0.4)]`.
- **Dark Theme**:
  - **Monochromatic Black-and-White Palette**: OLED pure black (`#000000`), deep obsidian surfaces (`#060608`, `#08080B`, `#0C0C10`, `#111116`, `#18181B`).
  - Typography: Pure white (`#FFFFFF`) and muted translucent whites (`white/80`, `white/60`, `white/40`).
  - **Accent color**: Pure White (`#FFFFFF`).
  - **Zero Colored/Neon Tints**: NEVER use blue, indigo, purple, or neon colors for functional UI controls, borders, selection rings, or drag indicators.
  - Active elements / pills: `bg-white text-black`.
  - Drop indicators / drag highlights: `dark:bg-white dark:shadow-[0_0_8px_rgba(255,255,255,0.7)]`.

---

## 2. Audio & Catalog Rules

- **Artist Pages**:
  - Initial load must load **50 tracks** prioritized by popularity (view count / play count descending).
  - If more tracks exist, show a «Show more» («Показать больше») button.
  - Clicking «Show more» must fetch all remaining tracks of the artist without any artificial ceiling (e.g., 100 tracks).
  - Keep web API endpoints in sync in `vite.config.ts` for smooth browser development and testing.

- **Playlists & Sorting**:
  - User-created playlists (`isCustom` / local playlists) support `custom` order and drag-and-drop reordering.
  - Drag-and-drop indicators must always use theme accents (`#0F172A` in light theme, `#FFFFFF` in dark theme).

---

## 3. Releases & Changelog Formatting (STRICT)

- **Zero Asterisks Policy**:
  - NEVER use asterisks (`*` or `**`) anywhere in release notes, changelogs, or update descriptions.
  - Do NOT bold items with `**`.
  - Use hyphens (`- `) for list items so they render cleanly as standard bullet points (`•`).

