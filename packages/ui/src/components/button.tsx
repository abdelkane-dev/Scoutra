import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/**
 * Bouton. Un seul bouton `primary` visible par zone (charte §6).
 * - primary : accent orange, texte encre (le blanc est interdit sur cet orange) ;
 * - ink : bouton principal de la landing ;
 * - secondary : fond blanc, bordure appuyée ;
 * - ghost : barre d'outils, menus.
 */
export const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap border font-medium transition-[background-color,border-color,color] duration-[120ms] ease-soft disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'border-transparent bg-accent text-on-accent hover:bg-accent-hover',
        ink: 'border-transparent bg-ink text-white hover:bg-[#2a2d36]',
        secondary: 'border-line-strong bg-surface text-ink hover:border-ink-3',
        ghost: 'border-transparent bg-transparent text-ink-2 hover:bg-hover hover:text-ink',
        danger: 'border-transparent bg-bad text-white hover:bg-[#a91f17]',
        link: 'h-auto border-0 p-0 text-accent-text underline-offset-[3px] hover:underline',
      },
      size: {
        sm: 'h-8 rounded-sm px-2.5 text-[13px] max-sm:h-10',
        md: 'h-8 rounded-sm px-3 text-label-14 max-sm:h-10',
        lg: 'h-10 rounded-md px-4 text-label-14 max-sm:h-11',
        icon: 'size-8 rounded-sm max-sm:size-10',
        'icon-sm': 'size-7 rounded-sm',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
