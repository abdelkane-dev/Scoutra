'use client';
import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Columns3, ListFilter, Search, X, Bookmark } from 'lucide-react';
import {
  Button, Checkbox, DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, Input, cn, toast,
} from '@scoutra/ui';
import { useT } from '@/lib/i18n/client';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  hidden?: boolean;
  /** Masquée sur mobile (< 640 px). */
  mobileHidden?: boolean;
  className?: string;
  align?: 'left' | 'right';
  /** Colonne principale (nom), toujours visible. */
  primary?: boolean;
}
export interface Facet<T> {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  get: (row: T) => string;
}
export interface SavedView<T> {
  id: string;
  label: string;
  filter: (row: T) => boolean;
}

/**
 * Tableau dense configurable : vues enregistrées, recherche, filtres à facettes, colonnes
 * affichables, tri, sélection multiple avec barre d'actions groupées, ligne active.
 */
export function DataTable<T>({
  rows,
  columns,
  getId,
  getLabel,
  facets = [],
  views = [],
  searchText,
  onRowClick,
  activeId,
  bulkActions,
  caption,
  emptyLabel,
  toolbarExtra,
}: {
  rows: T[];
  columns: Column<T>[];
  getId: (row: T) => string;
  getLabel: (row: T) => string;
  facets?: Facet<T>[];
  views?: SavedView<T>[];
  searchText?: (row: T) => string;
  onRowClick?: (row: T) => void;
  activeId?: string | null;
  bulkActions?: (ids: string[], clear: () => void) => React.ReactNode;
  caption: string;
  emptyLabel?: string;
  toolbarExtra?: React.ReactNode;
}) {
  const t = useT();
  const [view, setView] = React.useState(views[0]?.id ?? '');
  const [q, setQ] = React.useState('');
  const [filters, setFilters] = React.useState<Record<string, string[]>>({});
  const [hidden, setHidden] = React.useState<string[]>(columns.filter((c) => c.hidden).map((c) => c.id));
  const [sort, setSort] = React.useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [sel, setSel] = React.useState<string[]>([]);

  const filtered = React.useMemo(() => {
    const v = views.find((x) => x.id === view);
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (v && !v.filter(r)) return false;
      if (needle && searchText && !searchText(r).toLowerCase().includes(needle)) return false;
      for (const f of facets) {
        const chosen = filters[f.id];
        if (chosen?.length && !chosen.includes(f.get(r))) return false;
      }
      return true;
    });
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sortValue) {
        const sv = col.sortValue;
        out = [...out].sort((a, b) => {
          const x = sv(a);
          const y = sv(b);
          return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
        });
      }
    }
    return out;
  }, [rows, views, view, q, searchText, facets, filters, sort, columns]);

  const visibleCols = columns.filter((c) => c.primary || !hidden.includes(c.id));
  const allSelected = filtered.length > 0 && filtered.every((r) => sel.includes(getId(r)));
  const someSelected = sel.length > 0 && !allSelected;
  const activeFilters = Object.entries(filters).filter(([, v]) => v.length);

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        {views.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="font-semibold text-ink">
                <Bookmark aria-hidden strokeWidth={1.75} />
                {views.find((v) => v.id === view)?.label}
                <ChevronDown aria-hidden strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>{t('app.common.views')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={view} onValueChange={setView}>
                {views.map((v) => (
                  <DropdownMenuRadioItem key={v.id} value={v.id}>
                    {v.label}
                    <span className="ml-auto pl-4 text-label-12 text-ink-3 tnum">{rows.filter(v.filter).length}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={false} onCheckedChange={() => toast(t('app.common.viewSaved'))}>
                {t('app.common.saveView')}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {searchText ? (
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('app.common.search')} placeholder={t('app.common.search')} className="h-8 pl-8 max-sm:h-10" />
          </div>
        ) : null}
        {facets.map((f) => (
          <DropdownMenu key={f.id}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant={filters[f.id]?.length ? 'secondary' : 'ghost'} className={cn(filters[f.id]?.length && 'border-accent-line bg-accent-soft')}>
                <ListFilter aria-hidden strokeWidth={1.75} />
                {f.label}
                {filters[f.id]?.length ? <span className="tnum">· {filters[f.id]!.length}</span> : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-80 overflow-y-auto">
              {f.options.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.value}
                  checked={filters[f.id]?.includes(o.value) ?? false}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(v) =>
                    setFilters((cur) => {
                      const list = cur[f.id] ?? [];
                      return { ...cur, [f.id]: v ? [...list, o.value] : list.filter((x) => x !== o.value) };
                    })
                  }
                >
                  {o.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
        {activeFilters.length ? (
          <Button size="sm" variant="ghost" onClick={() => setFilters({})}>
            <X aria-hidden strokeWidth={1.75} />
            {t('app.common.clearFilters')}
          </Button>
        ) : null}
        <span className="flex-1" />
        {toolbarExtra}
        <span className="text-label-12 text-ink-3 tnum">{t('app.common.results', { n: filtered.length })}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" aria-label={t('app.common.columns')}>
              <Columns3 aria-hidden strokeWidth={1.75} />
              <span className="max-md:sr-only">{t('app.common.columns')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('app.common.columns')}</DropdownMenuLabel>
            {columns
              .filter((c) => !c.primary)
              .map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={!hidden.includes(c.id)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(v) => setHidden((h) => (v ? h.filter((x) => x !== c.id) : [...h, c.id]))}
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Barre d'actions groupées */}
      {sel.length && bulkActions ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-ink px-3 py-1.5 text-label-13 text-white" role="region" aria-label={t('app.common.selected', { n: sel.length })}>
          <span className="tnum">{t('app.common.selected', { n: sel.length })}</span>
          <span className="mx-1 h-4 w-px bg-white/20" aria-hidden />
          {bulkActions(sel, () => setSel([]))}
          <span className="flex-1" />
          <button type="button" className="rounded-sm px-2 py-1 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => setSel([])}>
            {t('app.common.deselect')}
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-copy-14">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-[1] bg-sunken">
            <tr className="h-9 text-left">
              {bulkActions ? (
                <th scope="col" className="w-10 pl-4">
                  <Checkbox
                    aria-label={t('app.common.selectAll')}
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(v) => setSel(v === true ? filtered.map(getId) : [])}
                  />
                </th>
              ) : null}
              {visibleCols.map((c, i) => {
                const sorted = sort?.id === c.id ? sort.dir : 0;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={sorted === 1 ? 'ascending' : sorted === -1 ? 'descending' : undefined}
                    className={cn(
                      'whitespace-nowrap px-3 text-label-13 font-medium text-ink-3',
                      i === 0 && !bulkActions && 'pl-4',
                      i === visibleCols.length - 1 && 'pr-4',
                      c.align === 'right' && 'text-right',
                      c.mobileHidden && 'max-sm:hidden',
                    )}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        className={cn('inline-flex items-center gap-1 hover:text-ink', sorted && 'text-ink')}
                        onClick={() => setSort((s) => (s?.id === c.id ? (s.dir === 1 ? { id: c.id, dir: -1 } : null) : { id: c.id, dir: 1 }))}
                      >
                        {c.header}
                        {sorted === 1 ? <ArrowUp className="size-3.5" strokeWidth={2} aria-hidden /> : sorted === -1 ? <ArrowDown className="size-3.5" strokeWidth={2} aria-hidden /> : null}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const id = getId(r);
              const checked = sel.includes(id);
              return (
                <tr
                  key={id}
                  data-state={checked ? 'selected' : undefined}
                  data-active={activeId === id}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={cn(
                    'h-11 border-t border-line transition-colors hover:bg-[#fafafb] data-[state=selected]:bg-accent-soft/60 data-[active=true]:bg-accent-soft data-[active=true]:shadow-[inset_2px_0_0_var(--accent)]',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {bulkActions ? (
                    <td className="w-10 pl-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox aria-label={t('app.common.selectRow', { name: getLabel(r) })} checked={checked} onCheckedChange={(v) => setSel((s) => (v === true ? [...s, id] : s.filter((x) => x !== id)))} />
                    </td>
                  ) : null}
                  {visibleCols.map((c, i) => (
                    <td
                      key={c.id}
                      className={cn(
                        'whitespace-nowrap px-3',
                        i === 0 && !bulkActions && 'pl-4',
                        i === visibleCols.length - 1 && 'pr-4',
                        c.align === 'right' && 'text-right tnum',
                        c.mobileHidden && 'max-sm:hidden',
                        c.primary && 'max-w-[280px]',
                        c.className,
                      )}
                    >
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className="px-4 py-10 text-copy-14 text-ink-3">{emptyLabel ?? t('app.common.noMatch')}</p> : null}
      </div>
    </div>
  );
}
