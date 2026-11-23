'use client';
import * as React from 'react';
import { Play } from 'lucide-react';
import {
  Button,
  Label,
  Input,
  Panel,
  PanelHeader,
  PanelTitle,
  Segmented,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Tooltip,
  toast,
} from '@scoutra/ui';
import type { MessageKey } from '@scoutra/i18n';
import { useFormat, useT } from '@/lib/i18n/client';
import { WRITING_SURCHARGE } from '@/lib/pricing';
import { usePerm } from './app-provider';
import { CountryPicker } from './country-picker';
import { LiveRun } from './live-search';
import { apiFetch } from '@/lib/api';
import { useCredits } from '@/lib/use-credits';

type Kind = 'companies' | 'people' | 'both';
type Zone = 'one' | 'many' | 'world';
type Writing = 'standard' | 'careful' | 'premium';
const AGENTS = ['interpret', 'search', 'enrich', 'verify', 'score', 'write'] as const;
const EXAMPLES = ['ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6'] as const;

export function SearchView({
  models,
  defaultCountry,
  initialModel,
}: {
  models: string[];
  defaultCountry: string;
  initialModel?: string;
}) {
  const t = useT();
  const fmt = useFormat();
  const { can } = usePerm();
  const canRun = can('campaign:write');
  const [query, setQuery] = React.useState('');
  const [kind, setKind] = React.useState<Kind>('companies');
  const [model, setModel] = React.useState(
    initialModel && models.includes(initialModel) ? initialModel : 'b2b',
  );
  const [zone, setZone] = React.useState<Zone>('many');
  const [countries, setCountries] = React.useState<string[]>([defaultCountry]);
  const [writing, setWriting] = React.useState<Writing>('standard');
  const [max, setMax] = React.useState(50);
  const [error, setError] = React.useState<string | null>(null);
  const [liveId, setLiveId] = React.useState<string | null>(null);

  // Solde réel (GET /api/credits) si disponible, sinon démonstration.
  const realCredits = useCredits();
  const left = realCredits?.balance ?? null;
  const perProspect = 1 + WRITING_SURCHARGE[writing];
  const estimate = max * perProspect;

  const validate = () => {
    let err: string | null = null;
    if (query.trim().length < 10) err = t('search.queryTooShort');
    else if (zone !== 'world' && countries.length === 0) err = t('search.needCountry');
    setError(err);
    return err === null;
  };

  /** Vraie recherche (POST /api/campaigns) ; repli sur la démonstration si l'API ne répond pas. */
  const launch = async () => {
    if (!validate()) return;
    const zoneText =
      zone === 'world' ? t('app.common.world') : countries.map((c) => fmt.country(c)).join(', ');
    const prompt = `${query.trim()}\n${t('search.zone')} : ${zoneText}. ${t('search.target')} : ${t(`app.kinds.${kind}`)}.`;
    const r = await apiFetch<{ id: string }>('/api/campaigns', {
      method: 'POST',
      body: { prompt, model, maxProspects: max, quality: writing },
    });
    if (r.data) {
      toast(t('search.launched'));
      setLiveId(r.data.id);
      return;
    }
    if (r.error && r.error.status > 0 && r.error.status < 500) {
      const key = `live.errors.${r.error.code}` as MessageKey;
      return setError(t(key) === key ? r.error.message || t('auth.errors.unknown') : t(key));
    }
    setError(
      r.error?.code === 'network'
        ? t('auth.errors.network')
        : r.error?.message || t('auth.errors.unknown'),
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      {/* Composer */}
      <Panel className="xl:sticky xl:top-4 xl:self-start" aria-labelledby="h-composer">
        <PanelHeader>
          <PanelTitle id="h-composer">{t('search.composer')}</PanelTitle>
        </PanelHeader>
        <form
          className="grid gap-5 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void launch();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="q">{t('search.query')}</Label>
            <Textarea
              id="q"
              rows={4}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.queryPlaceholder')}
              aria-describedby="q-hint"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void launch();
              }}
              className="text-copy-14"
            />
            <p id="q-hint" className="text-label-12 font-normal text-ink-3">
              {t('search.queryHint')}
            </p>
            <div
              className="mt-1 flex flex-wrap gap-1.5"
              aria-label={t('search.examples')}
              role="group"
            >
              {EXAMPLES.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setQuery(t(`search.${k}`))}
                  className="rounded-sm border border-line px-2 py-1 text-left text-label-12 text-ink-2 hover:border-line-strong hover:text-ink"
                >
                  {t(`search.${k}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-label-13">{t('search.target')}</span>
            <Segmented<Kind>
              label={t('search.target')}
              value={kind}
              onChange={setKind}
              options={[
                { value: 'companies', label: t('app.kinds.companies') },
                { value: 'people', label: t('app.kinds.people') },
                { value: 'both', label: t('app.kinds.both') },
              ]}
            />
            {kind !== 'companies' ? (
              <p className="text-label-12 font-normal text-ink-3">{t('search.targetPeopleNote')}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="model">{t('search.model')}</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`prospectingModels.${m}` as MessageKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <span className="text-label-13">{t('search.zone')}</span>
            <Segmented<Zone>
              label={t('search.zone')}
              value={zone}
              onChange={(z) => {
                setZone(z);
                if (z === 'one') setCountries((c) => c.slice(0, 1));
              }}
              options={[
                { value: 'one', label: t('search.zoneOne') },
                { value: 'many', label: t('search.zoneMany') },
                { value: 'world', label: t('search.zoneWorld') },
              ]}
            />
            {zone === 'world' ? (
              <p className="text-label-12 font-normal text-ink-3">{t('search.worldNote')}</p>
            ) : (
              <CountryPicker value={countries} onChange={setCountries} multiple={zone === 'many'} />
            )}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="writing">{t('search.writing')}</Label>
              <Select value={writing} onValueChange={(v) => setWriting(v as Writing)}>
                <SelectTrigger id="writing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">{t('search.writingStandard')}</SelectItem>
                  <SelectItem value="careful">
                    {t('search.writingCareful', { n: WRITING_SURCHARGE.careful })}
                  </SelectItem>
                  <SelectItem value="premium">
                    {t('search.writingPremium', { n: WRITING_SURCHARGE.premium })}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="max">{t('search.max')}</Label>
              <Input
                id="max"
                type="number"
                min={5}
                max={500}
                step={5}
                value={max}
                onChange={(e) => setMax(Math.max(5, Math.min(500, Number(e.target.value) || 5)))}
                className="tnum"
              />
            </div>
          </div>
          <div className="rounded-md bg-canvas px-3 py-2.5">
            <p className="text-label-14 font-semibold tnum">
              {t('search.estimate', { n: fmt.n(estimate) })}
            </p>
            <p className="text-label-12 font-normal text-ink-3">
              {left === null ? '' : t('search.estimateNote', { left: fmt.n(left) })}
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-label-13 text-bad">
              {error}
            </p>
          ) : null}
          {canRun ? (
            <Button type="submit" variant="primary" size="lg" className="w-full">
              <Play aria-hidden strokeWidth={1.75} />
              {t('search.launch')}
              <span className="ml-1 text-[11px] font-medium opacity-70 max-sm:hidden" aria-hidden>
                ⌘↵
              </span>
            </Button>
          ) : (
            <Tooltip content={t('search.readOnly')}>
              <span tabIndex={0} className="block">
                <Button type="button" variant="primary" size="lg" className="w-full" disabled>
                  {t('search.launch')}
                </Button>
              </span>
            </Tooltip>
          )}
        </form>
      </Panel>

      {/* Déroulé et résultats (données réelles) */}
      <div className="grid min-w-0 content-start gap-4">
        {liveId ? (
          <LiveRun id={liveId} onReset={() => setLiveId(null)} />
        ) : (
          <Panel aria-labelledby="h-idle">
            <PanelHeader>
              <PanelTitle id="h-idle">{t('search.idleTitle')}</PanelTitle>
            </PanelHeader>
            <p className="px-4 pt-3 text-copy-14 text-ink-2">{t('search.idleLede')}</p>
            <ol className="grid gap-px p-4 sm:grid-cols-2 lg:grid-cols-3">
              {AGENTS.map((a, i) => (
                <li
                  key={a}
                  className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 border-t border-line py-3 pr-4"
                >
                  <span className="text-label-13 text-ink-3 tnum">{i + 1}</span>
                  <div>
                    <p className="text-label-14 font-semibold">{t(`app.agents.${a}`)}</p>
                    <p className="text-[13px] leading-5 text-ink-2">
                      {t(`search.idle${i + 1}` as MessageKey)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        )}
      </div>
    </div>
  );
}
