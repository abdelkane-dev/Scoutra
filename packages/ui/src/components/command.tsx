'use client';
import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Search } from 'lucide-react';
import { cn } from '../lib/cn';
import { DialogOverlay } from './dialog';

export function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn('flex h-full w-full flex-col overflow-hidden text-ink', className)}
      {...props}
    />
  );
}

/** Palette de commandes (⌘K) dans une fenêtre modale. */
export function CommandDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content className="fixed left-1/2 top-[14vh] z-50 w-[calc(100%-24px)] max-w-[620px] -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-[sc-pop-in_180ms_var(--ease-out-soft)]">
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="sr-only">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          <Command label={label ?? title} loop>
            {children}
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-line px-4">
      <Search className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
      <CommandPrimitive.Input
        className={cn(
          'h-full w-full bg-transparent text-copy-16 outline-none placeholder:text-ink-3',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn('max-h-[min(420px,60vh)] overflow-y-auto p-1.5', className)}
      {...props}
    />
  );
}

export function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty className="px-3 py-8 text-center text-copy-14 text-ink-3" {...props} />
  );
}

export function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        'py-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-label-12 [&_[cmdk-group-heading]]:text-ink-3',
        className,
      )}
      {...props}
    />
  );
}

export function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'flex min-h-9 cursor-default select-none items-center gap-2.5 rounded-sm px-2.5 text-copy-14 text-ink-2 outline-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-sunken data-[selected=true]:text-ink max-sm:min-h-11 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-3',
        className,
      )}
      {...props}
    />
  );
}

export function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator className={cn('-mx-1.5 my-1 h-px bg-line', className)} {...props} />
  );
}
