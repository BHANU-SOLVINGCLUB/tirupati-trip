"use client";
import * as React from "react";

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  return open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 max-h-[90dvh] w-[96vw] max-w-3xl overflow-auto rounded-md border bg-background p-0 shadow-lg">
        {children}
      </div>
    </div>
  ) : null;
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b p-3">{children}</div>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold">{children}</h3>;
}

export function DialogContent({ children }: { children: React.ReactNode }) {
  return <div className="p-3">{children}</div>;
}


