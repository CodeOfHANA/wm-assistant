# /wma-add-component

Scaffold a new React component for `wm-assistant/ui/src/components/` following the RELACON design system.

## Before creating any component:

1. Read `CLAUDE.md` — section "Design System" for colors, animation config, and stack
2. Read `../Claude Code CLI/UI_UX/ux-second-brain/00-MOC.md` for existing patterns
3. Check if a similar component already exists in `ui/src/components/`

## Rules for every component:

### Colors — use only RELACON tokens (defined in tailwind.config.ts)
- Background: `bg-wm-surface` (`#0f1f22`)
- Border: `border-wm-border` (`#1a3339`)
- Primary action: `bg-wm-primary` (`#015c61`)
- Accent: `text-wm-accent` (`#2ea3f2`)
- Text muted: `text-wm-muted` (`#82c0c7`)

### Animations — Framer Motion only, no CSS transitions for interactive elements
```tsx
// Entry
const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] } }
};

// Button hover/tap
whileHover={{ scale: 1.03 }}
whileTap={{ scale: 0.97 }}
transition={{ type: 'spring', stiffness: 400, damping: 25 }}
```

### Accessibility
- Always use semantic HTML (`<button>`, not `<div onClick>`)
- Always include `<MotionConfig reducedMotion="user">` at app root (already in App.tsx)
- Keyboard-focusable interactive elements

### TypeScript
- Props interface required for every component
- No `any` types

## Template

```tsx
import { motion } from 'framer-motion';

interface Props {
  // define props
}

export function ComponentName({ }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="bg-wm-surface border border-wm-border rounded-xl p-4"
    >
      {/* content */}
    </motion.div>
  );
}
```

## After creating:
- Export from `ui/src/components/index.ts`
- Update `CLAUDE.md` Day N status if this completes a planned component
