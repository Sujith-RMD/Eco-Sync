"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * StorylineNotification — subtle notification when new case info unlocks.
 *
 * A restrained toast that appears briefly, then fades. Not a giant modal.
 * Does not interrupt gameplay. Opening Storyline clears the notification
 * using the existing logic.
 */
interface StorylineNotificationProps {
  show: boolean;
  message?: string;
  onDismiss?: () => void;
}

export function StorylineNotification({
  show,
  message = "New case information has been unlocked.",
  onDismiss,
}: StorylineNotificationProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevShowRef = useRef(show);

  useEffect(() => {
    // Only trigger when show transitions from false to true
    if (show && !prevShowRef.current) {
      setVisible(true);
    }
    prevShowRef.current = show;
  }, [show]);

  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, 4000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed left-1/2 top-4 z-50 -translate-x-1/2",
        "border border-caution/40 bg-abyss-900/95 px-4 py-3",
        "font-mono text-[11px] uppercase tracking-[0.16em] text-caution",
        "shadow-lg backdrop-blur-sm",
        "transition-all duration-300",
        "animate-evidence-in",
      )}
    >
      <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-caution animate-blink-dot" />
      {message}
    </div>
  );
}
