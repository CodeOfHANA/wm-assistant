import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface Props {
  size?: number;
  className?: string;
  /** When true, wraps in a hover-interactive container with wave + speech bubble */
  interactive?: boolean;
}

function Figure({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Relacottchen"
    >
      {/* Shadow */}
      <ellipse cx="30" cy="76" rx="14" ry="4" fill="currentColor" opacity="0.18" />

      {/* Legs */}
      <line x1="30" y1="52" x2="21" y2="68" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <line x1="30" y1="52" x2="39" y2="68" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />

      {/* Feet */}
      <circle cx="20.5" cy="69.5" r="3.2" fill="currentColor" />
      <circle cx="39.5" cy="69.5" r="3.2" fill="currentColor" />

      {/* Body */}
      <line x1="30" y1="30" x2="30" y2="52" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />

      {/* Left arm — relaxed */}
      <line x1="30" y1="37" x2="16" y2="47" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="15" cy="48" r="3.2" fill="currentColor" />

      {/* Right arm — raised, animated separately via InteractiveFigure */}
      <line x1="30" y1="37" x2="46" y2="27" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="47" cy="26" r="3.2" fill="currentColor" />

      {/* Neck */}
      <line x1="30" y1="26" x2="30" y2="30" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />

      {/* Head */}
      <circle cx="30" cy="15" r="11" stroke="currentColor" strokeWidth="3" />

      {/* Eyes */}
      <rect x="23.5" y="11" width="3.5" height="5.5" rx="1.75" fill="currentColor" />
      <rect x="33" y="11" width="3.5" height="5.5" rx="1.75" fill="currentColor" />

      {/* Smile */}
      <path d="M 24 20 Q 30 25.5 36 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function InteractiveFigure({ size, className }: { size: number; className?: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative inline-block cursor-default select-none"
      style={{ width: size, height: size }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Speech bubble */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-wm-surface border border-wm-border rounded-lg px-2.5 py-1 text-[11px] font-medium text-wm-accent shadow-lg pointer-events-none"
          >
            Hi! I'm Relacottchen 👋
            {/* Bubble tail */}
            <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-wm-border" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* SVG with waving arm overlay */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 60 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Relacottchen"
      >
        {/* Shadow */}
        <ellipse cx="30" cy="76" rx="14" ry="4" fill="currentColor" opacity="0.18" />

        {/* Legs */}
        <line x1="30" y1="52" x2="21" y2="68" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <line x1="30" y1="52" x2="39" y2="68" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="20.5" cy="69.5" r="3.2" fill="currentColor" />
        <circle cx="39.5" cy="69.5" r="3.2" fill="currentColor" />

        {/* Body */}
        <line x1="30" y1="30" x2="30" y2="52" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />

        {/* Left arm */}
        <line x1="30" y1="37" x2="16" y2="47" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="15" cy="48" r="3.2" fill="currentColor" />

        {/* Right arm — waving when hovered */}
        <motion.g
          style={{ transformOrigin: '30px 37px' }}
          animate={hovered
            ? { rotate: [0, -22, 8, -18, 4, -20, 0] }
            : { rotate: 0 }}
          transition={hovered
            ? { duration: 1.0, repeat: Infinity, repeatDelay: 0.3, ease: 'easeInOut' }
            : { duration: 0.2 }}
        >
          <line x1="30" y1="37" x2="46" y2="27" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="47" cy="26" r="3.2" fill="currentColor" />
        </motion.g>

        {/* Neck */}
        <line x1="30" y1="26" x2="30" y2="30" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />

        {/* Head */}
        <circle cx="30" cy="15" r="11" stroke="currentColor" strokeWidth="3" />

        {/* Eyes */}
        <rect x="23.5" y="11" width="3.5" height="5.5" rx="1.75" fill="currentColor" />
        <rect x="33" y="11" width="3.5" height="5.5" rx="1.75" fill="currentColor" />

        {/* Smile */}
        <path d="M 24 20 Q 30 25.5 36 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

// ── Working animation (shown while AI is streaming) ──────────────────────────

export function WorkingRelacottchen() {
  // Arms alternate: left arm pumps down while right pumps up, then swap
  const leftArmAnim  = { rotate: [0, 28, 0, -10, 0] };
  const rightArmAnim = { rotate: [0, -28, 0, 10, 0] };
  const armTransition = { duration: 0.7, repeat: Infinity, ease: 'easeInOut' as const };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center gap-2 py-4"
    >
      {/* Animated figure */}
      <motion.svg
        width={56}
        height={74}
        viewBox="0 0 60 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-wm-accent"
        animate={{ y: [0, -3, 0, -2, 0] }}
        transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Shadow — pulses with the body bob */}
        <motion.ellipse
          cx="30" cy="76" rx="14" ry="4"
          fill="currentColor" opacity="0.18"
          animate={{ scaleX: [1, 0.8, 1, 0.85, 1] }}
          transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Legs — slight alternating lean */}
        <motion.g
          style={{ transformOrigin: '30px 52px' }}
          animate={{ rotate: [0, 4, 0, -4, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
        >
          <line x1="30" y1="52" x2="21" y2="68" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <line x1="30" y1="52" x2="39" y2="68" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="20.5" cy="69.5" r="3.2" fill="currentColor" />
          <circle cx="39.5" cy="69.5" r="3.2" fill="currentColor" />
        </motion.g>

        {/* Body */}
        <line x1="30" y1="30" x2="30" y2="52" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />

        {/* Left arm — pumps down */}
        <motion.g
          style={{ transformOrigin: '30px 37px' }}
          animate={leftArmAnim}
          transition={armTransition}
        >
          <line x1="30" y1="37" x2="16" y2="47" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="15" cy="48" r="3.2" fill="currentColor" />
        </motion.g>

        {/* Right arm — pumps up (offset phase) */}
        <motion.g
          style={{ transformOrigin: '30px 37px' }}
          animate={rightArmAnim}
          transition={{ ...armTransition, delay: 0.35 }}
        >
          <line x1="30" y1="37" x2="46" y2="27" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="47" cy="26" r="3.2" fill="currentColor" />
        </motion.g>

        {/* Neck */}
        <line x1="30" y1="26" x2="30" y2="30" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />

        {/* Head — slight tilt */}
        <motion.g
          style={{ transformOrigin: '30px 15px' }}
          animate={{ rotate: [0, 5, 0, -5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <circle cx="30" cy="15" r="11" stroke="currentColor" strokeWidth="3" />
          <rect x="23.5" y="11" width="3.5" height="5.5" rx="1.75" fill="currentColor" />
          <rect x="33" y="11" width="3.5" height="5.5" rx="1.75" fill="currentColor" />
          <path d="M 24 20 Q 30 25.5 36 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </motion.g>
      </motion.svg>

      {/* Caption with animated dots */}
      <div className="flex items-center gap-1 text-[11px] text-wm-muted">
        <span>Relacottchen is on it</span>
        <span className="flex gap-0.5">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
            >
              .
            </motion.span>
          ))}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Relacottchen — RELACON mascot stick figure.
 * Pass interactive={true} for the hover wave + speech bubble (empty state).
 * Plain variant is used for small message avatars.
 */
export function Relacottchen({ size = 24, className, interactive = false }: Props) {
  if (interactive) return <InteractiveFigure size={size} className={className} />;
  return <Figure size={size} className={className} />;
}
