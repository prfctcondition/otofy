# Zen Music — Design System & Color Palette

This document defines the strict visual guidelines and color palette for Zen Music.
**All future UI components, screens, modals, indicators, and controls must strictly comply with this specification.**

---

## 1. Core Principles

1. **Light Theme**:
   - **Base**: Clean whites, frosted glass, light slates (`#F8FAFC`, `#F1F5F9`).
   - **Text**: Deep slate / charcoal (`#0F172A`, `#334155`, `#475569`).
   - **Accent Color**: `#0F172A` (Obsidian Slate).
   - **Active Elements**: `#0F172A` background with crisp white `#FFFFFF` text.
   - **Interactive Highlights**: Slate glass hover states (`hover:bg-black/[0.04]`).

2. **Dark Theme**:
   - **Monochromatic Black-and-White Palette**: Strictly black, dark grays, and white.
   - **No Colored / Neon Tints**: No random blues, indigos, purples, cyans, or greens on functional controls, borders, selection rings, or drag indicators.
   - **Base**: OLED Pure Black (`#000000`), Obsidian glass surfaces (`#060608`, `#08080B`, `#0C0C10`, `#111116`, `#18181B`).
   - **Text**: Pure white (`#FFFFFF`), high-contrast muted whites (`white/80`, `white/60`, `white/40`).
   - **Accent Color**: Pure White (`#FFFFFF`).
   - **Active Elements**: Pure white `#FFFFFF` background with pitch black `#000000` text, or high-contrast luminous white rings/indicators.

---

## 2. Color Palette Tokens

### Accent & Highlights
| Element | Light Theme | Dark Theme |
| :--- | :--- | :--- |
| **Accent Primary** | `#0F172A` | `#FFFFFF` |
| **Accent Contrast Text** | `#FFFFFF` | `#000000` |
| **Pill / Button Active** | `bg-[#0F172A] text-white` | `bg-white text-black` |
| **Drag & Drop Target Line** | `bg-[#0F172A] shadow-[0_0_8px_rgba(15,23,42,0.4)]` | `dark:bg-white dark:shadow-[0_0_8px_rgba(255,255,255,0.7)]` |
| **Drag Card Placeholder** | `border-[#0F172A]/40 bg-[#0F172A]/5` | `dark:border-white/40 dark:bg-white/5` |
| **Selection Indicator / Border** | `border-[#0F172A]/30 bg-black/[0.06]` | `dark:border-white/30 dark:bg-white/[0.12]` |

### Surfaces & Backgrounds
| Element | Light Theme | Dark Theme |
| :--- | :--- | :--- |
| **App Background** | `#F8FAFC` to `#FFFFFF` | `#000000` (OLED Pure Black) |
| **Main Glass Panel** | `rgba(255, 255, 255, 0.40)` | `rgba(6, 6, 8, 0.88)` |
| **Subtle Glass Panel** | `rgba(255, 255, 255, 0.32)` | `rgba(8, 8, 11, 0.82)` |
| **Elevated / Modal** | `rgba(255, 255, 255, 0.85)` | `rgba(12, 12, 16, 0.95)` |
| **Border Subtlety** | `rgba(0, 0, 0, 0.08)` / `rgba(255, 255, 255, 0.75)` | `rgba(255, 255, 255, 0.10)` |

### Typography
| Element | Light Theme | Dark Theme |
| :--- | :--- | :--- |
| **Primary Headings & Titles** | `#0F172A` (`text-slate-900`) | `#FFFFFF` (`text-white`) |
| **Body & Primary Text** | `#1E293B` (`text-slate-800`) | `#F4F4F5` (`text-zinc-100`) |
| **Secondary / Subtitles** | `#475569` (`text-slate-600`) | `rgba(255, 255, 255, 0.65)` (`text-white/65`) |
| **Muted / Metadata / Timestamps** | `#64748B` (`text-slate-500`) | `rgba(255, 255, 255, 0.40)` (`text-white/40`) |

---

## 3. Component Implementation Rules

### 1. Drag-and-Drop Drop Indicators
Drop indicators must visually preview where the item will land using the theme accent:
```tsx
// Drop indicator above
isDragOver && dropPosition === 'above' &&
  'before:content-[""] before:absolute before:top-[-2px] before:left-2 before:right-2 before:h-[3px] before:bg-[#0F172A] dark:before:bg-white before:rounded-full before:z-30 before:shadow-[0_0_8px_rgba(15,23,42,0.4)] dark:before:shadow-[0_0_8px_rgba(255,255,255,0.7)]'

// Drop indicator below
isDragOver && dropPosition === 'below' &&
  'after:content-[""] after:absolute after:bottom-[-2px] after:left-2 after:right-2 after:h-[3px] after:bg-[#0F172A] dark:after:bg-white after:rounded-full after:z-30 after:shadow-[0_0_8px_rgba(15,23,42,0.4)] dark:after:shadow-[0_0_8px_rgba(255,255,255,0.7)]'
```

### 2. Active Pills & Tabs
Never use random saturated colors (like purple, blue, green) for navigation or filter pills.
```tsx
// Active Filter / Pill:
'bg-[#0F172A] text-white shadow-sm dark:bg-white dark:text-black dark:shadow-[0_0_12px_rgba(255,255,255,0.25)]'

// Inactive Filter / Pill:
'text-slate-600 hover:text-slate-900 hover:bg-black/5 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10'
```

### 3. Context Menus & Dropdowns
- Light theme: Crisp semi-translucent white backdrop `bg-white/95 border-black/10 text-slate-800`, hover `hover:bg-slate-100 text-[#0F172A]`.
- Dark theme: Pure obsidian `bg-[#0C0C10]/95 border-white/10 text-white`, hover `hover:bg-white/10 text-white`.
- Icons inside menu items: Inherit currentColor or use `text-slate-500 dark:text-white/60`.

---

## 4. Checklist for New Components
Before committing any UI code:
- [ ] Are any colored neon values (`indigo-500`, `blue-600`, `purple-500`) used for UI state or indicators? -> **Replace with `#0F172A` in light theme, and `white` in dark theme.**
- [ ] Does the dark theme preserve pure monochrome black & white contrast?
- [ ] Do buttons and pills invert appropriately (light = dark slate, dark = pure white)?
