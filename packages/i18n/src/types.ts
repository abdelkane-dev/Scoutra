import type { fr } from './messages/fr';

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
/** Forme des messages : celle du français, valeurs en `string`. */
export type Messages = Widen<typeof fr>;

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = { [K in keyof T]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T];
export type MessageKey = Paths<Messages>;
