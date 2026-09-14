import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Briefings are plain text carrying one directive: a line that reads
 * `[IMG:path/to/asset.png]` renders that asset from `public/` in place of the
 * line. Everything else is passed through verbatim, blank lines included.
 *
 * The directive lives inside the briefing rather than in a column of its own so
 * the question and the evidence it refers to travel as a single string — the
 * same string the case-file feed receives — and there is no second source of
 * truth to drift out of step with the question.
 */
const IMAGE_LINE = /^\[IMG:([^\]]+)\]$/;

type Block = { kind: "text"; value: string } | { kind: "image"; src: string };

function toBlocks(briefing: string): Block[] {
  const blocks: Block[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const value = buffer.join("\n").replace(/^\n+|\n+$/g, "");
    if (value.length > 0) blocks.push({ kind: "text", value });
    buffer = [];
  };

  for (const line of briefing.split("\n")) {
    const match = IMAGE_LINE.exec(line.trim());
    if (match) {
      flush();
      blocks.push({ kind: "image", src: `/${match[1]}` });
    } else {
      buffer.push(line);
    }
  }
  flush();

  return blocks;
}

export function BriefingText({
  briefing,
  className,
  prefix,
}: {
  briefing: string;
  /** Typography for the text blocks; images are sized independently. */
  className?: string;
  /** Rendered inline at the head of the first text block. */
  prefix?: ReactNode;
}) {
  const blocks = toBlocks(briefing);
  // Resolved up front rather than tracked with a flag mutated mid-render: the
  // prefix belongs to the first text block, and a briefing may open with art.
  const firstTextIndex = blocks.findIndex((block) => block.kind === "text");

  return (
    <div className="min-w-0 space-y-4">
      {blocks.map((block, index) => {
        if (block.kind === "image") {
          return (
            // eslint-disable-next-line @next/next/no-img-element -- fixed art in public/, nothing to optimise
            <img
              key={index}
              src={block.src}
              alt="Recovered evidence"
              className="block w-full max-w-xl border border-line/70 bg-abyss-950/60"
            />
          );
        }

        return (
          <p
            key={index}
            className={cn("min-w-0 break-words whitespace-pre-line", className)}
          >
            {index === firstTextIndex ? prefix : null}
            {block.value}
          </p>
        );
      })}
    </div>
  );
}
