'use client';
import * as React from 'react';
import { Command as Cmdk } from 'cmdk';
import { Plus, X } from 'lucide-react';
import { CountryCode, Popover, PopoverContent, PopoverTrigger, cn } from '@scoutra/ui';
import { useLocale, useT } from '@/lib/i18n/client';
import { countryOptions } from '@/lib/countries';

/** Sélection d'un ou plusieurs pays (recherche au clavier, codes ISO affichés). */
export function CountryPicker({
  value,
  onChange,
  multiple,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  multiple: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const options = React.useMemo(() => countryOptions(locale), [locale]);
  const name = (c: string) => options.find((o) => o.code === c)?.name ?? c;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((c) => (
        <span
          key={c}
          className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-line bg-surface pl-1.5 pr-0.5 text-label-13"
        >
          <CountryCode code={c} />
          {name(c)}
          <button
            type="button"
            aria-label={t('search.removeCountry', { country: name(c) })}
            onClick={() => onChange(value.filter((x) => x !== c))}
            className="grid size-6 place-items-center rounded-xs text-ink-3 hover:bg-hover hover:text-ink"
          >
            <X className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        </span>
      ))}
      {multiple || value.length === 0 ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="inline-flex h-7 items-center gap-1 rounded-sm border border-dashed border-line-strong px-2 text-label-13 text-ink-2 hover:border-ink-3 hover:text-ink max-sm:h-10">
            <Plus className="size-3.5" strokeWidth={1.75} aria-hidden />
            {t('search.addCountry')}
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0">
            <Cmdk label={t('search.searchCountry')} loop>
              <Cmdk.Input
                placeholder={t('search.searchCountry')}
                className="h-10 w-full border-b border-line bg-transparent px-3 text-copy-14 outline-none placeholder:text-ink-3"
                autoFocus
              />
              <Cmdk.List className="max-h-64 overflow-y-auto p-1">
                <Cmdk.Empty className="px-3 py-4 text-copy-14 text-ink-3">
                  {t('app.common.noMatch')}
                </Cmdk.Empty>
                {options.map((o) => (
                  <Cmdk.Item
                    key={o.code}
                    value={`${o.name} ${o.code}`}
                    disabled={value.includes(o.code)}
                    onSelect={() => {
                      onChange(multiple ? [...value, o.code] : [o.code]);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex min-h-8 cursor-default items-center gap-2 rounded-sm px-2 text-copy-14 data-[disabled=true]:opacity-40 data-[selected=true]:bg-sunken max-sm:min-h-11',
                    )}
                  >
                    <CountryCode code={o.code} />
                    {o.name}
                  </Cmdk.Item>
                ))}
              </Cmdk.List>
            </Cmdk>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
