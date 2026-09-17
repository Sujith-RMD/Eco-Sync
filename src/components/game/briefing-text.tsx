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

type Block =
  | { kind: "text"; value: string }
  | { kind: "image"; src: string; exhibit: number };

function toBlocks(briefing: string): Block[] {
  const blocks: Block[] = [];
  let buffer: string[] = [];
  let exhibit = 0;

  const flush = () => {
    const value = buffer.join("\n").replace(/^\n+|\n+$/g, "");
    if (value.length > 0) blocks.push({ kind: "text", value });
    buffer = [];
  };

  for (const line of briefing.split("\n")) {
    const match = IMAGE_LINE.exec(line.trim());
    if (match) {
      flush();
      exhibit += 1;
      blocks.push({ kind: "image", src: `/${match[1]}`, exhibit });
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
            /*
              An exhibit, not an illustration. The sheet is inset inside a frame
              that is itself sitting on a slightly rotated backing sheet (see
              .evidence-sheet), so the picture reads as a photograph logged into
              a case file rather than as an image placed on a page. The exhibit
              number is derived from the order the images appear in the briefing,
              which means it stays correct if a briefing is reordered.
            */
            <figure key={index} className="evidence-sheet w-full max-w-xl">
              <div className="border border-line/80 bg-abyss-900/40 p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- fixed art in public/, nothing to optimise */}
                <img
                  src={block.src}
                  alt={`Recovered evidence, exhibit ${block.exhibit}`}
                  className="block w-full"
                />
              </div>
              <figcaption className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-dim">
                {/* Neutral, not red: red means a wrong answer in this interface. */}
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 bg-dim" />
                <span className="text-mist">
                  Exhibit {String(block.exhibit).padStart(2, "0")}
                </span>
                <span aria-hidden className="h-2.5 w-px bg-line" />
                <span>Recovered evidence · custody open</span>
              </figcaption>
            </figure>
          );
        }

        return (
          <p
            key={index}
            className={cn("min-w-0 overflow-x-auto whitespace-pre", className)}
            dangerouslySetInnerHTML={{ __html: block.value }}
            style={{ fontSize: 'clamp(12px, 2.8vw, 14px)' }}
          >
            {index === firstTextIndex ? prefix : null}
          </p>
        );
      })}
    </div>
  );
}
