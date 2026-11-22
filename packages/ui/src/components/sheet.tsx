'use client';
import * as React from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';
import { DialogOverlay } from './dialog';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

/** Panneau latéral (fiche prospect, filtres, menu mobile). */
export function SheetContent({
  className,
  children,
  side = 'right',
  closeLabel = 'Fermer',
  hideClose,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'right' | 'left';
  closeLabel?: string;
  hideClose?: boolean;
}) {
  return (
    <SheetPrimitive.Portal>
      <DialogOverlay />
      <SheetPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-50 flex w-full flex-col bg-surface text-copy-14 text-ink shadow-pop outline-none',
          side === 'right'
            ? 'right-0 max-w-[520px] border-l border-line data-[state=open]:animate-[sc-slide-left_180ms_var(--ease-out-soft)]'
            : 'left-0 max-w-[300px] border-r border-line data-[state=open]:animate-[sc-slide-right_180ms_var(--ease-out-soft)]',
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <SheetPrimitive.Close
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink max-sm:size-10"
            aria-label={closeLabel}
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
export function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid gap-1 border-b border-line px-5 py-4 pr-14', className)} {...props} />;
}
export function SheetBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid flex-1 content-start gap-5 overflow-y-auto px-5 py-5', className)} {...props} />;
}
export function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap items-center gap-2 border-t border-line bg-canvas px-5 py-3', className)} {...props} />;
}
export function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn('t-heading-20', className)} {...props} />;
}
export function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn('text-label-13 font-normal text-ink-3', className)} {...props} />;
}
