'use client';
import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '../lib/cn';

export const Tabs = TabsPrimitive.Root;

/** Onglets soulignés (navigation de page). */
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex items-end gap-5 overflow-x-auto border-b border-line', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 border-transparent text-label-14 text-ink-3 outline-none transition-colors hover:text-ink data-[state=active]:border-ink data-[state=active]:text-ink max-sm:h-11 [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('outline-none', className)} {...props} />;
}
