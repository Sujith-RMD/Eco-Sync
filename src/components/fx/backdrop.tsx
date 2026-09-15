import { InvestigationEnvironment } from "@/components/investigation/InvestigationEnvironment";

/**
 * Full-viewport atmospheric backdrop — now powered by the InvestigationEnvironment.
 *
 * The evidence desk sits behind all UI surfaces. Pure CSS 3D, no WebGL,
 * performant on phones. The desk provides depth cues, subtle parallax,
 * and the physical atmosphere of an investigation chamber.
 */
export function Backdrop() {
  return <InvestigationEnvironment />;
}
