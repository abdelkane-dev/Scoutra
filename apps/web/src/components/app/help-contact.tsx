'use client';
import { Button, Field, Input, Panel, PanelHeader, PanelTitle, Textarea, toast } from '@scoutra/ui';
import { useT } from '@/lib/i18n/client';

/** Formulaire de contact (démonstration ; besoin d'API : POST /api/support). */
export function HelpContact() {
  const t = useT();
  return (
    <Panel className="self-start">
      <PanelHeader>
        <PanelTitle>{t('prefs.help.contact')}</PanelTitle>
      </PanelHeader>
      <form
        className="grid gap-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          (e.target as HTMLFormElement).reset();
          toast(t('prefs.help.sent'));
        }}
      >
        <Field id="h-subject" label={t('prefs.help.subject')}>
          <Input required />
        </Field>
        <Field id="h-message" label={t('prefs.help.message')}>
          <Textarea rows={5} required />
        </Field>
        <Button type="submit" variant="primary" className="justify-self-start">
          {t('prefs.help.send')}
        </Button>
      </form>
      <p className="border-t border-line px-4 py-3 text-label-12 font-normal text-ink-3">
        {t('prefs.help.shortcuts')} : {t('prefs.help.shortcutsLede')}
      </p>
    </Panel>
  );
}
