import Image from "next/image";
import { cx } from "@/components/ui/cx";

/** The Lagos Free Zone logo (public/lfz-logo.png, from old DigiDocs). DigiDocs content, not suite kit. */
export const LFZ_LOGO = { src: "/lfz-logo.png", alt: "Lagos Free Zone", width: 1914, height: 836 } as const;

/** The logo on a light card: its navy and grey need a light background wherever it sits. */
export function LfzLogo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-lg bg-surface px-3 py-2", className)}>
      <Image {...LFZ_LOGO} alt={LFZ_LOGO.alt} unoptimized className="h-9 w-auto sm:h-11" />
    </span>
  );
}
