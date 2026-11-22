'use client';
import { Toaster as Sonner, toast } from 'sonner';

/** Toasts : fond encre, texte blanc, en bas à droite. Le texte reprend le verbe de l'action. */
export function Toaster({ closeLabel = 'Fermer' }: { closeLabel?: string }) {
  return (
    <Sonner
      position="bottom-right"
      offset={20}
      mobileOffset={12}
      visibleToasts={3}
      containerAriaLabel={closeLabel}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[calc(100vw-24px)] items-center gap-2.5 rounded-md bg-ink px-3.5 py-2.5 text-[13.5px] leading-5 text-white shadow-pop sm:w-[356px]',
          title: 'font-medium',
          description: 'text-[12.5px] text-dark-2',
          actionButton:
            'ml-auto rounded-sm bg-white/10 px-2 py-1 text-label-12 text-white hover:bg-white/20',
          icon: '[&_svg]:size-4 text-[#7ee2b8]',
        },
      }}
    />
  );
}

export { toast };
