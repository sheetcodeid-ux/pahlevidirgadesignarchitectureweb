import * as RScroll from "@radix-ui/react-scroll-area";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { ReactNode } from "react";

/** Area gulir dengan batang gulir yang seragam di semua sistem operasi. */
export function ScrollArea({ children }: { children: ReactNode }) {
  return (
    <RScroll.Root className="scrollarea" type="auto">
      <RScroll.Viewport className="scrollarea__viewport">{children}</RScroll.Viewport>
      <RScroll.Scrollbar className="scrollarea__bar" orientation="vertical">
        <RScroll.Thumb className="scrollarea__thumb" />
      </RScroll.Scrollbar>
    </RScroll.Root>
  );
}

/**
 * Panel yang bisa diatur lebarnya.
 *
 * Pegangannya digambar setipis satu piksel tapi area tangkapnya dilebarkan
 * lewat pseudo-element, sehingga mudah diraih tanpa membuat sekatnya terlihat
 * tebal. Panah kiri/kanan menggesernya lewat keyboard.
 */
export function ResizableDemo() {
  return (
    <Group orientation="horizontal" className="resizable">
      <Panel defaultSize="40" minSize="20">
        <div className="resizable__pane">Daftar proyek</div>
      </Panel>
      <Separator className="resizable__handle" />
      <Panel minSize="30">
        <div className="resizable__pane">Pratinjau</div>
      </Panel>
    </Group>
  );
}
