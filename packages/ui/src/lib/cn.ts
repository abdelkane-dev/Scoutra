import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** tailwind-merge connaît nos tailles de texte personnalisées (sinon elles seraient fusionnées avec les couleurs). */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['copy-18', 'copy-16', 'copy-14', 'label-14', 'label-13', 'label-12'] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
