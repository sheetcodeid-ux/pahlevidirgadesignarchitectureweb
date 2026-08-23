import * as RTooltip from "@radix-ui/react-tooltip";
import * as RPopover from "@radix-ui/react-popover";
import * as RHover from "@radix-ui/react-hover-card";
import type { ReactNode } from "react";
import { Icon } from "../Icon";

/**
 * Tiga lapisan mengambang yang mirip bentuknya tapi berbeda maksudnya:
 *
 * - Tooltip  — menamai sesuatu. Tidak boleh berisi aksi; muncul juga saat fokus keyboard.
 * - Popover  — panel kecil yang bisa berisi kontrol dan menahan fokus.
 * - HoverCard— pratinjau saat kursor singgah. Tidak muncul di perangkat sentuh,
 *              jadi isinya tidak boleh menjadi satu-satunya jalan ke informasi itu.
 */

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RTooltip.Provider delayDuration={300}>{children}</RTooltip.Provider>;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content className="ov-tooltip" sideOffset={6}>
          {label}
          <RTooltip.Arrow className="ov-tooltip__arrow" width={10} height={5} />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

export function Popover({ trigger, title, children }: { trigger: ReactNode; title?: string; children: ReactNode }) {
  return (
    <RPopover.Root>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content className="ov-floating ov-panel" sideOffset={8} collisionPadding={12}>
          {title && (
            <div className="row row--between" style={{ marginBottom: "var(--space-3)" }}>
              <span className="t-subheading">{title}</span>
              <RPopover.Close asChild>
                <button type="button" className="btn btn--ghost btn--icon" aria-label="Tutup">
                  <Icon name="close" size={16} />
                </button>
              </RPopover.Close>
            </div>
          )}
          {children}
          <RPopover.Arrow className="ov-floating__arrow" width={12} height={6} />
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

export function HoverCard({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <RHover.Root openDelay={250} closeDelay={120}>
      <RHover.Trigger asChild>{trigger}</RHover.Trigger>
      <RHover.Portal>
        <RHover.Content className="ov-floating ov-panel" sideOffset={8} collisionPadding={12}>
          {children}
          <RHover.Arrow className="ov-floating__arrow" width={12} height={6} />
        </RHover.Content>
      </RHover.Portal>
    </RHover.Root>
  );
}
