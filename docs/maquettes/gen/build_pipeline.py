# Génère docs/maquettes/app-pipeline.html (données FICTIVES, cohérentes avec la landing : 754 > 310 > 61 > 29 > 18).
import sys, html
sys.path.insert(0, '/tmp/claude-0/-home-user/46a28097-9136-5448-9a55-0ea1cd91f980/scratchpad')
from shell import head, sidebar, FOOT
E = html.escape

STYLE = '''
  .filters { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; }
  .filters .sp { flex: 1; }
  .sel { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: var(--r-s); background: var(--surface); font-size: 13.5px; font-weight: 500; }
  .sel .lbl { color: var(--ink-3); font-weight: 400; }
  .sel .i { color: var(--ink-3); width: 14px; height: 14px; }
  .range { font-size: 13px; color: var(--ink-3); }

  .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .kpi { padding: 16px 18px 14px; border-right: 1px solid var(--line); min-width: 0; display: grid; gap: 4px; }
  .kpi:last-child { border-right: 0; }
  .kpi h2 { font-size: 13px; font-weight: 500; color: var(--ink-2); line-height: 18px; }
  .kpi .v { font-size: 32px; line-height: 36px; font-weight: 600; font-stretch: 110%; letter-spacing: -.03em; }
  .kpi .d { font-size: 12.5px; color: var(--ink-3); }
  .kpi .d b { color: var(--ok); font-weight: 600; }
  .kpi svg.spark { width: 100%; height: 32px; margin-top: 6px; overflow: visible; }
  .spark .base { stroke: var(--line-strong); }
  .spark .lead { stroke: var(--accent); }
  .spark circle { fill: var(--accent); }

  .row2 { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 16px; align-items: start; }
  .todo li { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 12px 16px; border-bottom: 1px solid var(--line); }
  .todo li:last-child { border-bottom: 0; }
  .todo input { width: 16px; height: 16px; margin: 3px 0 0; accent-color: var(--ink); }
  .todo b { font-weight: 600; }
  .todo .what { display: flex; align-items: center; gap: 6px; color: var(--ink-2); font-size: 13px; margin-top: 2px; }
  .todo .what .i { width: 14px; height: 14px; color: var(--ink-3); }
  .todo time { font-size: 12.5px; color: var(--ink-3); white-space: nowrap; }
  .todo time.late { color: var(--bad); font-weight: 550; display: inline-flex; gap: 4px; align-items: center; }
  .todo time.late .i { width: 13px; height: 13px; }
  .todo li.done b, .todo li.done .what { color: var(--ink-3); text-decoration: line-through; }
  .todo-f { padding: 10px 16px; font-size: 12.5px; color: var(--ink-3); border-top: 1px solid var(--line); }

  .charts { display: grid; grid-template-columns: 1fr 1fr; }
  .chart { padding: 16px 18px; min-width: 0; }
  .chart + .chart { border-left: 1px solid var(--line); }
  .chart h3 { font-size: 13.5px; font-weight: 600; line-height: 19px; }
  .chart .sub { font-size: 12.5px; color: var(--ink-3); margin-top: 2px; }
  .hbars { margin-top: 16px; display: grid; gap: 12px; }
  .hbars li { display: grid; grid-template-columns: 84px minmax(0, 1fr) 46px; gap: 10px; align-items: center; font-size: 13px; position: relative; }
  .hbars .track { height: 10px; position: relative; }
  .hbars .fill { position: absolute; inset: 0 auto 0 0; background: var(--line-strong); border-radius: 0 4px 4px 0; transform-origin: left; }
  .hbars li.top .fill { background: var(--accent); }
  .hbars .v { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  .hbars li:hover .fill, .hbars li:focus .fill { background: var(--accent-hover); }
  .hbars li .tip { position: absolute; right: 0; top: -30px; background: var(--ink); color: #fff; font-size: 12px; padding: 3px 8px; border-radius: 6px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .12s; }
  .hbars li:hover .tip, .hbars li:focus .tip { opacity: 1; }
  .insight { padding: 12px 18px; border-top: 1px solid var(--line); font-size: 13px; color: var(--ink-2); background: #fafbfb; border-radius: 0 0 var(--r-l) var(--r-l); }
  .insight b { color: var(--ink); font-weight: 600; }

  .board-h { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
  .board-h h2 { font-size: 16px; font-weight: 600; }
  .board-h p { font-size: 13px; color: var(--ink-3); }
  .board { display: grid; grid-template-columns: repeat(6, minmax(176px, 1fr)); gap: 12px; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x mandatory; }
  .col { background: #eceef1; border-radius: var(--r-l); padding: 8px; min-height: 200px; scroll-snap-align: start; display: flex; flex-direction: column; gap: 8px; }
  .col-h { display: flex; align-items: center; gap: 8px; padding: 4px 6px 2px; font-size: 13px; font-weight: 600; }
  .col-h .n { margin-left: auto; color: var(--ink-3); font-weight: 500; font-variant-numeric: tabular-nums; }
  .col-h .sq { width: 8px; height: 8px; border-radius: 2px; background: var(--ink-3); }
  .col[data-stage="valide"] .sq { background: var(--ok); }
  .col[data-stage="perdu"] .sq { background: var(--line-strong); }
  .col[data-stage="rdv"] .sq, .col[data-stage="repondu"] .sq { background: var(--accent); }
  .col.over { box-shadow: inset 0 0 0 2px var(--accent-line); background: var(--accent-soft); }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-m); padding: 10px 12px; display: grid; gap: 6px; cursor: grab; touch-action: none; user-select: none; }
  .card:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 1px; }
  .card.dragging { box-shadow: var(--shadow-drag); cursor: grabbing; position: relative; z-index: 5; }
  .card .t { display: flex; align-items: center; gap: 8px; }
  .card .t b { font-weight: 600; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card .t .cc { margin-left: auto; }
  .card .org { font-size: 12.5px; color: var(--ink-3); line-height: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card .nx { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink-2); line-height: 17px; }
  .card .nx .i { width: 13px; height: 13px; color: var(--ink-3); }
  .card .nx.late { color: var(--bad); } .card .nx.late .i { color: var(--bad); }
  .card .nx.win { color: var(--ok); } .card .nx.win .i { color: var(--ok); }
  .card .b { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
  .card .av { width: 20px; height: 20px; font-size: 9.5px; }
  .more { font-size: 12.5px; color: var(--ink-3); padding: 2px 6px; }

  @media (max-width: 1279px) { .row2 { grid-template-columns: minmax(0,1fr); } }
  @media (max-width: 899px) { .kpis { grid-template-columns: 1fr 1fr; } .kpi:nth-child(2) { border-right: 0; } .kpi:nth-child(-n+2) { border-bottom: 1px solid var(--line); } }
  @media (max-width: 640px) {
    .charts { grid-template-columns: 1fr; } .chart + .chart { border-left: 0; border-top: 1px solid var(--line); }
    .kpi .v { font-size: 26px; line-height: 30px; }
    .board { grid-template-columns: repeat(6, 82%); }
    .filters .range { width: 100%; }
  }
'''

def spark(vals):
    w, h = 200, 32; mx, mn = max(vals), min(vals)
    pts = [(i * w / (len(vals) - 1), h - 3 - (v - mn) / (mx - mn or 1) * (h - 6)) for i, v in enumerate(vals)]
    s = lambda ps: ' '.join(f'{x:.1f},{y:.1f}' for x, y in ps)
    return (f'<svg class="spark" viewBox="0 0 {w} {h}" preserveAspectRatio="none" aria-hidden="true">'
            f'<polyline class="base" points="{s(pts[:-2])}" fill="none" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>'
            f'<polyline class="lead" points="{s(pts[-3:])}" fill="none" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>')

KPIS = [('Prospects contactés', '310', '+12 %', [18, 20, 19, 22, 24, 23, 25, 26, 25, 28, 29, 31]),
        ('Taux de réponse', '20 %', '+4 pts', [14, 15, 15, 16, 15, 17, 18, 17, 18, 19, 19, 20]),
        ('Rendez-vous obtenus', '29', '+9', [1, 2, 2, 1, 3, 2, 3, 3, 2, 4, 3, 3]),
        ('Ventes validées', '18', '+5', [0, 1, 1, 1, 2, 1, 1, 2, 2, 2, 2, 3])]
kpis = ''.join(f'<section class="kpi" aria-label="{t}"><h2>{t}</h2><p class="v">{v}</p><p class="d"><b>{d}</b> par rapport aux 90 jours précédents</p>{spark(s)}</section>' for t, v, d, s in KPIS)

TODO = [('Youssef Alami', 'i-chat', 'Relance 2 par WhatsApp, message prêt', '<time class="late"><svg class="i"><use href="#i-clock"/></svg>Hier</time>'),
        ('Émilie Gagnon', 'i-phone', 'Confirmer le rendez-vous de demain 10:00', '<time>09:30</time>'),
        ('Moussa Ndiaye', 'i-mail', 'Envoyer le devis demandé', '<time>11:00</time>'),
        ('Sarah Peeters', 'i-phone', 'Relance 1, sans réponse depuis 5 jours', '<time>14:00</time>'),
        ('Thomas Girard', 'i-mail', 'Proposition après le rendez-vous', '<time>16:30</time>')]
todo = ''.join(f'<li><input type="checkbox" aria-label="Marquer comme fait : {n}"><div><b>{n}</b><p class="what"><svg class="i"><use href="#{ic}"/></svg>{w}</p></div>{t}</li>' for n, ic, w, t in TODO)

def hbars(items, unit, total_lbl):
    mx = max(v for _, v, _ in items); out = ''
    for i, (l, v, tip) in enumerate(items):
        out += f'<li tabindex="0" class="{"top" if i == 0 else ""}"><span>{l}</span><span class="track"><i class="fill" style="width:{v/mx*100:.1f}%"></i></span><span class="v">{v}{unit}</span><span class="tip">{tip}</span></li>'
    return out
CH = [('WhatsApp', 34, '41 réponses sur 121 messages'), ('Téléphone', 22, '14 réponses sur 64 appels'), ('Email', 11, '14 réponses sur 125 emails')]
CO = [('France', 212, '212 prospects, 5 ventes'), ('Maroc', 168, '168 prospects, 4 ventes'), ('Canada', 151, '151 prospects, 4 ventes'), ('Sénégal', 124, '124 prospects, 3 ventes'), ('Belgique', 99, '99 prospects, 2 ventes')]

def tbl(cap, items, unit):
    return f'<table class="sr-only"><caption>{cap}</caption><tbody>' + ''.join(f'<tr><th scope="row">{l}</th><td>{v}{unit}</td><td>{t}</td></tr>' for l, v, t in items) + '</tbody></table>'

STAGES = [('nouveau', 'Nouveau', 754), ('contacte', 'Contacté', 310), ('repondu', 'Répondu', 61), ('rdv', 'Rendez-vous', 29), ('valide', 'Validé', 18), ('perdu', 'Perdu', 68)]
CARDS = {
 'nouveau': [('Claire Fontaine', 'FR', 'Cabinet Dentaire Confluence', 'i-plus', 'Ajoutée aujourd\'hui', '', 94, 'SM'), ('Kevin Bouchard', 'CA', 'Clinique Dentaire Plateau', 'i-plus', 'Ajouté aujourd\'hui', '', 63, 'SM'), ('Nadia Benali', 'MA', 'Cabinet Dentaire Maârif', 'i-alert', 'Email à confirmer', '', 68, 'JD')],
 'contacte': [('Youssef Alami', 'MA', 'Centre Dentaire Anfa', 'i-clock', 'Relance 2 en retard', 'late', 89, 'SM'), ('Sarah Peeters', 'BE', 'Cabinet Sourire Ixelles', 'i-clock', 'Relance 1 aujourd\'hui', '', 77, 'JD'), ('Inès Haddad', 'MA', 'Dentistes Gauthier', 'i-clock', 'Relance 1 jeudi', '', 71, 'SM')],
 'repondu': [('Moussa Ndiaye', 'SN', 'Clinique Dentaire Almadies', 'i-mail', 'A demandé un devis', '', 82, 'SM'), ('Hugo Lambert', 'FR', 'Dentistes Bellecour', 'i-chat', 'Intéressé, rappeler lundi', '', 79, 'JD')],
 'rdv': [('Émilie Gagnon', 'CA', 'Clinique Dentaire Rosemont', 'i-calendar', 'Demain 10:00, visio', '', 86, 'SM'), ('Thomas Girard', 'FR', 'Centre Dentaire Part-Dieu', 'i-calendar', 'Fait le 20/11, proposition', '', 74, 'SM')],
 'valide': [('Grace Mensah', 'US', 'Smile Studio Brooklyn', 'i-check', 'Vente validée le 19/11', 'win', 91, 'JD'), ('Awa Diallo', 'SN', 'Cabinet Dentaire Mermoz', 'i-check', 'Vente validée le 14/11', 'win', 84, 'SM')],
 'perdu': [('Marc Dubois', 'BE', 'Centre Dentaire Louise', 'i-x', 'Pas de budget cette année', '', 58, 'JD'), ('Leila Haddad', 'MA', 'Cabinet Gauthier', 'i-x', 'A déjà un outil', '', 61, 'SM')],
}
board = ''
for key, label, n in STAGES:
    cards = ''.join(f'<li class="card" tabindex="0" aria-label="{E(nm)}, {label}"><div class="t"><b>{E(nm)}</b><span class="cc">{cc}</span></div><p class="org">{E(org)}</p><p class="nx {cls}"><svg class="i"><use href="#{ic}"/></svg>{E(nx)}</p><div class="b"><span class="score">{sc}<span class="gauge"><i style="width:{sc}%"></i></span></span><span class="av" title="Responsable">{av}</span></div></li>' for nm, cc, org, ic, nx, cls, sc, av in CARDS[key])
    rest = n - len(CARDS[key])
    board += f'<section class="col" data-stage="{key}" aria-label="{label}"><h3 class="col-h"><span class="sq"></span>{label}<span class="n" data-n="{n}">{n}</span></h3><ul class="cards" style="display:grid;gap:8px">{cards}</ul><p class="more">{rest} autres</p></section>'

BODY = '''  <header class="topbar">
    <div class="crumbs"><b>Pipeline</b></div>
    <span class="sp"></span>
    <button class="btn btn-line btn-s" type="button"><svg class="i"><use href="#i-download"/></svg>Exporter</button>
    <a class="btn btn-accent btn-s" href="app-recherche.html"><svg class="i"><use href="#i-plus"/></svg>Nouvelle recherche</a>
  </header>
  <main class="page" id="contenu">
    <div class="filters">
      <div class="seg" role="group" aria-label="Période" data-seg><button type="button" aria-pressed="false">7 jours</button><button type="button" aria-pressed="false">30 jours</button><button type="button" aria-pressed="true">90 jours</button></div>
      <button class="sel" type="button"><span class="lbl">Pays</span>Tous<svg class="i"><use href="#i-chevron"/></svg></button>
      <button class="sel" type="button"><span class="lbl">Canal</span>Tous<svg class="i"><use href="#i-chevron"/></svg></button>
      <button class="sel" type="button"><span class="lbl">Responsable</span>Toute l'équipe<svg class="i"><use href="#i-chevron"/></svg></button>
      <span class="sp"></span><span class="range">Du 24 août au 22 novembre 2026</span>
    </div>

    <div class="panel kpis">''' + kpis + '''</div>

    <div class="row2">
      <section class="panel" aria-labelledby="h-todo">
        <div class="panel-h"><h2 id="h-todo">Relances du jour</h2><span class="faint" style="font-size:13px">dimanche 22 novembre</span><span class="sp"></span><span class="label-13" id="todo-left">5 à faire</span></div>
        <ul class="todo">''' + todo + '''</ul>
        <p class="todo-f">Chaque relance ouvre un message déjà rédigé. Vous l'envoyez vous-même.</p>
      </section>
      <section class="panel" aria-labelledby="h-perf">
        <div class="panel-h"><h2 id="h-perf">Ce qui convertit</h2></div>
        <div class="charts">
          <figure class="chart"><figcaption><h3>WhatsApp répond 3 fois plus que l'email</h3><p class="sub">Taux de réponse par canal, 90 jours</p></figcaption><ul class="hbars">''' + hbars(CH, ' %', '') + '''</ul>''' + tbl("Taux de réponse par canal", CH, " %") + '''</figure>
          <figure class="chart"><figcaption><h3>La France apporte le plus de prospects</h3><p class="sub">Prospects ajoutés par pays, 90 jours</p></figcaption><ul class="hbars">''' + hbars(CO, '', '') + '''</ul>''' + tbl("Prospects par pays", CO, "") + '''</figure>
        </div>
        <p class="insight"><b>À retenir :</b> les prospects notés 80 et plus signent deux fois plus souvent. 11 d'entre eux attendent encore un premier message.</p>
      </section>
    </div>

    <div class="board-h"><h2 id="h-board">Suivi des prospects</h2><p>Glissez une carte vers une autre étape, ou sélectionnez-la et utilisez les flèches gauche et droite.</p></div>
    <div class="board" aria-labelledby="h-board">''' + board + '''</div>
    <p class="sr-only" id="live" aria-live="polite"></p>
  </main>
</div>
</div>
'''

SCRIPT = '''
<script type="module">
  import { animate, stagger } from "https://cdn.jsdelivr.net/npm/motion@14.14.0/+esm";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (id) => document.getElementById(id);
  const cols = [...document.querySelectorAll(".col")];
  const label = (c) => c.getAttribute("aria-label");
  function toast(t) { const el = $("toast"); $("toast-t").textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2200); }
  function bump(col, d) { const n = col.querySelector(".n"); const v = +n.dataset.n + d; n.dataset.n = v; n.textContent = v.toLocaleString("fr-FR"); }

  function moveCard(card, target, viaKeyboard) {
    const from = card.closest(".col"); if (!target || target === from) return;
    target.querySelector(".cards").prepend(card);
    bump(from, -1); bump(target, +1);
    card.setAttribute("aria-label", card.querySelector("b").textContent + ", " + label(target));
    const name = card.querySelector("b").textContent;
    $("live").textContent = name + " déplacé vers " + label(target);
    toast(name + " déplacé vers " + label(target));
    if (!reduce) animate(card, { opacity: [0.4, 1], scale: [0.97, 1] }, { duration: 0.24, ease: [0.2, 0.7, 0.2, 1] });
    if (viaKeyboard) card.focus();
  }

  // Clavier : flèches gauche/droite
  document.addEventListener("keydown", (e) => {
    const card = e.target.closest && e.target.closest(".card"); if (!card) return;
    const i = cols.indexOf(card.closest(".col"));
    if (e.key === "ArrowRight") { e.preventDefault(); moveCard(card, cols[i + 1], true); }
    if (e.key === "ArrowLeft") { e.preventDefault(); moveCard(card, cols[i - 1], true); }
  });

  // Souris / tactile : glisser-déposer (transform uniquement pendant le geste)
  let drag = null;
  document.addEventListener("pointerdown", (e) => {
    const card = e.target.closest(".card"); if (!card || e.button !== 0) return;
    drag = { card, x: e.clientX, y: e.clientY, moved: false };
    card.setPointerCapture(e.pointerId);
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true; drag.card.classList.add("dragging");
    drag.card.style.transform = `translate(${dx}px, ${dy}px) rotate(1.5deg)`;
    drag.card.style.pointerEvents = "none";
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".col");
    cols.forEach((c) => c.classList.toggle("over", c === over));
    drag.card.style.pointerEvents = "";
  });
  document.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const { card, moved } = drag; drag = null;
    card.classList.remove("dragging"); card.style.transform = "";
    const target = cols.find((c) => c.classList.contains("over"));
    cols.forEach((c) => c.classList.remove("over"));
    if (moved && target) moveCard(card, target);
  });

  // Relances : cocher
  document.querySelectorAll(".todo input").forEach((cb) => cb.addEventListener("change", () => {
    cb.closest("li").classList.toggle("done", cb.checked);
    const left = document.querySelectorAll(".todo input:not(:checked)").length;
    $("todo-left").textContent = left ? left + " à faire" : "Tout est fait";
    if (cb.checked) toast("Relance marquée comme faite");
  }));
  document.querySelectorAll("[data-seg]").forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); }));

  // Une seule entrée au chargement : les barres des graphiques
  if (!reduce) animate(".hbars .fill", { scaleX: [0, 1] }, { delay: stagger(0.05), duration: 0.4, ease: [0.2, 0.7, 0.2, 1] });
</script>
'''

out = head('Pipeline', STYLE) + sidebar('Pipeline') + BODY + FOOT + SCRIPT + '</body>\n</html>\n'
open('/home/user/automatic-eureka/docs/maquettes/app-pipeline.html', 'w').write(out)
print('ok')
