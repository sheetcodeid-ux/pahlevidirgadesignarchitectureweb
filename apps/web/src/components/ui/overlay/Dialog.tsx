import * as RDialog from "@radix-ui/react-dialog";
import * as RAlert from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";
import { Icon } from "../Icon";

/**
 * Keluarga dialog: Dialog, Alert Dialog, dan Sheet/Drawer.
 *
 * Ketiganya berbagi satu perilaku dasar — focus trap, pengembalian fokus ke
 * pemicunya saat ditutup, Esc, dan penguncian gulir latar — yang datang dari
 * primitif headless. Yang ditulis di sini hanya tampilannya.
 */

interface DialogProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ trigger, title, description, children, footer }: DialogProps) {
  return (
    <RDialog.Root>
      <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>
      <RDialog.Portal>
        <RDialog.Overlay className="ov-scrim" />
        <RDialog.Content className="ov-dialog ov-panel">
          <div className="ov-dialog__head">
            <div className="ov-dialog__titles">
              <RDialog.Title className="ov-dialog__title">{title}</RDialog.Title>
              {description && (
                <RDialog.Description className="ov-dialog__desc">{description}</RDialog.Description>
              )}
            </div>
          </div>

          <RDialog.Close asChild>
            <button type="button" className="btn btn--ghost btn--icon ov-dialog__close" aria-label="Tutup">
              <Icon name="close" size={18} />
            </button>
          </RDialog.Close>

          {children && <div className="ov-dialog__body">{children}</div>}
          {footer && <div className="ov-dialog__foot">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

interface AlertProps {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
}

/**
 * Alert Dialog dipakai saat tindakannya sulit dibatalkan.
 *
 * Bedanya dari Dialog biasa bukan sekadar tampilan: overlay ini tidak bisa
 * ditutup dengan mengklik latar, sehingga penghapusan tidak pernah terjadi
 * karena salah klik.
 */
export function AlertDialog({
  trigger,
  title,
  description,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  destructive = false,
  onConfirm,
}: AlertProps) {
  return (
    <RAlert.Root>
      <RAlert.Trigger asChild>{trigger}</RAlert.Trigger>
      <RAlert.Portal>
        <RAlert.Overlay className="ov-scrim" />
        <RAlert.Content className="ov-dialog ov-panel">
          <div className="ov-dialog__head">
            {destructive && (
              <span className="icon-tile icon-tile--sm" style={{ color: "var(--brand)" }} aria-hidden="true">
                <Icon name="alert" size={16} />
              </span>
            )}
            <div className="ov-dialog__titles">
              <RAlert.Title className="ov-dialog__title">{title}</RAlert.Title>
              <RAlert.Description className="ov-dialog__desc">{description}</RAlert.Description>
            </div>
          </div>

          <div className="ov-dialog__foot">
            <RAlert.Cancel asChild>
              <button type="button" className="btn btn--secondary">{cancelLabel}</button>
            </RAlert.Cancel>
            <RAlert.Action asChild>
              <button
                type="button"
                className={destructive ? "btn btn--brand" : "btn btn--primary"}
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </RAlert.Action>
          </div>
        </RAlert.Content>
      </RAlert.Portal>
    </RAlert.Root>
  );
}

interface SheetProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  side?: "right" | "left" | "bottom";
  children?: ReactNode;
  footer?: ReactNode;
}

/** Sheet dan Drawer adalah komponen yang sama; yang membedakan hanya sisinya. */
export function Sheet({ trigger, title, description, side = "right", children, footer }: SheetProps) {
  return (
    <RDialog.Root>
      <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>
      <RDialog.Portal>
        <RDialog.Overlay className="ov-scrim" />
        <RDialog.Content className="ov-sheet" data-side={side}>
          {side === "bottom" && <span className="ov-sheet__grip" aria-hidden="true" />}

          <div className="ov-dialog__head">
            <div className="ov-dialog__titles">
              <RDialog.Title className="ov-dialog__title">{title}</RDialog.Title>
              {description && (
                <RDialog.Description className="ov-dialog__desc">{description}</RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <button type="button" className="btn btn--ghost btn--icon" aria-label="Tutup">
                <Icon name="close" size={18} />
              </button>
            </RDialog.Close>
          </div>

          {children && <div className="ov-dialog__body">{children}</div>}
          {footer && <div className="ov-dialog__foot">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
