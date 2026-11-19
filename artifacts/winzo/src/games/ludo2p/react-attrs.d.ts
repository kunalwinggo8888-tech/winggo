/**
 * JSX attribute declarations for the ORIGINAL ludo2p markup.
 * The owner's original index.html uses custom attributes
 * (`player-id`, `piece`) on the piece divs; React's types don't know them.
 */
import "react";

declare module "react" {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    "player-id"?: string | undefined;
    piece?: string | number | undefined;
  }
}
