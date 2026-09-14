"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary: this one renders *instead of* the root layout.
 *
 * `error.tsx` already covers every page that fails under the layout. This file
 * exists for the narrower case where the layout itself — or anything it awaits —
 * is what threw. Next requires it to supply its own `<html>` and `<body>`, which
 * is also why nothing here depends on the layout's font variables: they are
 * declared by the very component that has already failed, so the styling below
 * leans on inline values for the surface and on `globals.css` for the palette.
 *
 * Kept deliberately plain. A team hitting this needs two things only: to know
 * the event is not over, and a way to try again.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[eco-sync] root layout error", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          backgroundColor: "var(--color-abyss-950, #03070c)",
          color: "var(--color-ink, #eef5fb)",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "32rem",
            border: "1px solid var(--color-line, #23374d)",
            padding: "1.5rem",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.6875rem",
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "var(--color-alert, #ff5470)",
            }}
          >
            Signal interrupted
          </p>

          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.8125rem",
              lineHeight: 1.6,
              color: "var(--color-mist, #bcccdc)",
            }}
          >
            The terminal could not load. Your submissions and score live on the
            server, not on this device — nothing is lost. Try again, and if this
            persists show this screen to a coordinator.
          </p>

          {error.digest ? (
            <p
              style={{
                margin: "1rem 0 0",
                fontSize: "0.6875rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--color-dim, #8198b1)",
              }}
            >
              Reference {error.digest}
            </p>
          ) : null}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.25rem",
              border: "none",
              cursor: "pointer",
              backgroundColor: "var(--color-acid, #45a4f7)",
              color: "var(--color-abyss-950, #03070c)",
              fontFamily: "inherit",
              fontSize: "0.78125rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
