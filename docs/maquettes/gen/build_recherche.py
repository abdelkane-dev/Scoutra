# Génère docs/maquettes/app-recherche.html (données FICTIVES de prospects.py).
import json, html, sys
sys.path.insert(0, '/tmp/claude-0/-home-user/46a28097-9136-5448-9a55-0ea1cd91f980/scratchpad')
from prospects import P
from shell import head, sidebar, FOOT

for p in P:
    p['score'] = sum(int(r[0].replace('+', '')) for r in p['reasons'])
E = html.escape

STYLE = '''
  .composer { padding: 16px; display: grid; gap: 14px; }
  .composer label.lbl { font-size: 13px; font-weight: 600; }
  .composer textarea { width: 100%; min-height: 56px; resize: vertical; border: 1px solid var(--line-strong); border-radius: var(--r-m); padding: 10px 12px; font-size: 15px; line-height: 23px; background: var(--surface); }
  .composer textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
  .hint { color: var(--ink-3); font-size: 12.5px; line-height: 18px; margin-top: 6px; }
  .controls { display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: flex-end; }
  .ctl { display: grid; gap: 6px; }
  .ctl > span { font-size: 12.5px; color: var(--ink-3); font-weight: 500; }
  .countries { display: flex; flex-wrap: wrap; gap: 6px; }
  .country { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 6px 0 4px; border: 1px solid var(--line); border-radius: var(--r-s); font-size: 13px; font-weight: 500; background: var(--surface); }
  .country button { border: 0; background: none; color: var(--ink-3); display: grid; place-items: center; width: 22px; height: 22px; border-radius: 4px; padding: 0; }
  .country button:hover { background: var(--sunken); color: var(--ink); }
  .country .i { width: 13px; height: 13px; }
  .add { border-style: dashed; color: var(--ink-3); padding: 0 9px; }
  .launch { margin-left: auto; display: flex; align-items: center; gap: 12px; }
  .launch .faint { font-size: 12.5px; }

  .run { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .run li { padding: 12px 16px; border-right: 1px solid var(--line); min-width: 0; }
  .run li:last-child { border-right: 0; }
  .run b { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; }
  .run li > span { display: block; font-size: 12.5px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .run .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex: none; }
  .run li[data-state="pending"] .dot { background: var(--line-strong); }
  .run li[data-state="pending"] > span { visibility: hidden; }
  .run-time { font-size: 12.5px; color: var(--ink-3); }

  .split { display: grid; grid-template-columns: minmax(0, 1fr) 392px; gap: 16px; align-items: start; }
  .tbl-wrap { overflow-x: auto; }
  .ptable { font-size: 13.5px; }
  .ptable th { text-align: left; font-size: 12.5px; font-weight: 500; color: var(--ink-3); background: #f8f9fa; height: 36px; padding: 0 12px; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .ptable td { padding: 0 12px; height: 56px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  .ptable tbody tr { cursor: pointer; }
  .ptable tbody tr:hover { background: #fafbfb; }
  .ptable tbody tr[aria-selected="true"] { background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent); }
  .ptable .who b { display: block; font-weight: 600; white-space: nowrap; }
  .ptable .who span { display: block; color: var(--ink-3); font-size: 12.5px; white-space: nowrap; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
  .ptable .loc { white-space: nowrap; display: flex; align-items: center; gap: 8px; color: var(--ink-2); }
  .ptable .src { color: var(--ink-3); font-size: 12.5px; white-space: nowrap; }
  .ptable input[type=checkbox] { width: 16px; height: 16px; accent-color: var(--ink); margin: 0; }
  .ptable .cb { width: 36px; padding-right: 0; }
  .tfoot { display: flex; justify-content: space-between; padding: 10px 16px; font-size: 12.5px; color: var(--ink-3); }

  .fiche { position: sticky; top: 68px; }
  .f-h { padding: 16px; border-bottom: 1px solid var(--line); display: grid; gap: 12px; }
  .f-h h2 { font-size: 18px; line-height: 24px; font-weight: 600; font-stretch: 104%; letter-spacing: -.01em; }
  .f-h p { color: var(--ink-2); font-size: 13px; line-height: 19px; }
  .f-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .f-sec { padding: 14px 16px; border-bottom: 1px solid var(--line); display: grid; gap: 10px; }
  .f-sec:last-child { border-bottom: 0; }
  .f-sec h3 { font-size: 13px; font-weight: 600; display: flex; align-items: baseline; gap: 8px; }
  .f-sec h3 .sp { flex: 1; }
  .f-score { font-size: 28px; line-height: 28px; font-weight: 600; font-stretch: 110%; letter-spacing: -.03em; }
  .f-score small { font-size: 13px; color: var(--ink-3); font-weight: 500; letter-spacing: 0; }
  .reasons { display: grid; gap: 7px; }
  .reasons li { display: grid; grid-template-columns: minmax(0, 1fr) 72px 28px; gap: 10px; align-items: center; font-size: 12.5px; line-height: 17px; color: var(--ink-2); }
  .reasons .track { height: 6px; border-radius: 2px; background: var(--sunken); position: relative; }
  .reasons .fill { position: absolute; inset: 0 auto 0 0; background: var(--accent); border-radius: 0 3px 3px 0; }
  .reasons .v { text-align: right; font-weight: 600; color: var(--ink); }
  .reasons li.zero { color: var(--ink-3); }
  .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin: 0 -16px; padding: 0 16px; }
  .tabs button { border: 0; background: none; padding: 6px 2px 9px; margin-right: 14px; font-size: 13px; font-weight: 500; color: var(--ink-3); box-shadow: inset 0 -2px 0 transparent; display: inline-flex; gap: 6px; align-items: center; }
  .tabs button[aria-selected="true"] { color: var(--ink); box-shadow: inset 0 -2px 0 var(--ink); }
  .message { white-space: pre-line; font-size: 13.5px; line-height: 21px; color: var(--ink); }
  .message .subj { display: block; font-weight: 600; margin-bottom: 8px; }
  .kv { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 6px 12px; font-size: 13px; line-height: 19px; }
  .kv dt { color: var(--ink-3); }
  .kv dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
  .fiche-close { display: none; }

  @media (max-width: 1279px) { .split { grid-template-columns: minmax(0, 1fr) 340px; } .ptable .c-src { display: none; } }
  @media (max-width: 1099px) { .run { grid-template-columns: repeat(3, minmax(0,1fr)); } .run li:nth-child(3) { border-right: 0; } .run li:nth-child(-n+3) { border-bottom: 1px solid var(--line); } }
  @media (max-width: 1023px) {
    .split { grid-template-columns: minmax(0, 1fr); }
    .fiche { position: fixed; inset: 0; top: auto; max-height: 88vh; overflow-y: auto; z-index: 80; border-radius: var(--r-xl) var(--r-xl) 0 0; box-shadow: var(--shadow-drag); transform: translateY(105%); transition: transform .24s var(--ease); }
    .fiche.open { transform: none; }
    .fiche-close { display: inline-flex; margin-left: auto; }
    .scrim { position: fixed; inset: 0; background: rgba(18,20,26,.35); z-index: 75; opacity: 0; pointer-events: none; transition: opacity .2s; }
    .scrim.open { opacity: 1; pointer-events: auto; }
  }
  @media (max-width: 760px) {
    .ptable thead { display: none; }
    .ptable, .ptable tbody { display: block; }
    .ptable tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; padding: 12px 14px; border-bottom: 1px solid var(--line); }
    .ptable td { height: auto; padding: 0; border: 0; }
    .ptable .cb, .ptable .c-mail, .ptable .c-src { display: none; }
    .ptable .c-loc { grid-column: 1; grid-row: 2; }
    .ptable .c-score { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
    .ptable .who span { max-width: none; }
    .launch { margin-left: 0; width: 100%; justify-content: space-between; }
    .controls .seg { width: 100%; } .controls .seg button { flex: 1; }
    .ctl { width: 100%; }
  }
  html.js .armed .ptable tbody tr { opacity: 0; }
'''

def state(p):
    if p['mail'] == 'ok': return '<span class="state ok"><svg class="i"><use href="#i-check"/></svg>Vérifié</span>'
    if p['mail'] == 'risky': return '<span class="state warn"><svg class="i"><use href="#i-alert"/></svg>À confirmer</span>'
    return '<span class="state none"><svg class="i"><use href="#i-phone"/></svg>Téléphone seul</span>'

rows = ''
for i, p in enumerate(P):
    sel = 'true' if i == 0 else 'false'
    rows += (f'<tr data-i="{i}" aria-selected="{sel}" tabindex="0">'
             f'<td class="cb"><input type="checkbox" aria-label="Sélectionner {E(p["name"])}"></td>'
             f'<td class="who"><b>{E(p["name"])}</b><span>{E(p["role"])}, {E(p["org"])}</span></td>'
             f'<td class="c-loc"><span class="loc"><span class="cc">{p["cc"]}</span>{E(p["city"])}</span></td>'
             f'<td class="c-mail">{state(p)}</td>'
             f'<td class="c-src"><span class="src">{E(p["source"])}</span></td>'
             f'<td class="c-score"><span class="score">{p["score"]}<span class="gauge"><i style="width:{p["score"]}%"></i></span></span></td></tr>\n')

def reasons(p):
    out = ''
    for pts, txt in p['reasons']:
        v = int(pts.replace('+', ''))
        out += f'<li class="{"zero" if v == 0 else ""}"><span>{E(txt)}</span><span class="track"><i class="fill" style="width:{v/30*100:.0f}%"></i></span><span class="v">{pts}</span></li>'
    return out

p0 = P[0]
mail0 = f'<span class="state ok"><svg class="i"><use href="#i-check"/></svg>Confirmé par le serveur mail</span>'
FICHE = f'''<aside class="panel fiche" id="fiche" aria-labelledby="f-name">
  <div class="f-h">
    <div style="display:flex;gap:12px;align-items:flex-start">
      <div><h2 id="f-name">{E(p0["name"])}</h2><p id="f-role">{E(p0["role"])}, {E(p0["org"])}</p><p class="faint" id="f-loc"><span class="cc">{p0["cc"]}</span> {E(p0["city"])}, {E(p0["country"])}</p></div>
      <button class="btn btn-line btn-s fiche-close" type="button" id="f-close" aria-label="Fermer la fiche"><svg class="i"><use href="#i-x"/></svg></button>
    </div>
    <div class="f-actions"><button class="btn btn-accent btn-s" type="button" id="add-pipe"><svg class="i"><use href="#i-plus"/></svg>Ajouter au pipeline</button><button class="btn btn-line btn-s" type="button" id="copy"><svg class="i"><use href="#i-copy"/></svg><span>Copier le message</span></button></div>
  </div>
  <section class="f-sec" aria-labelledby="f-why">
    <h3 id="f-why">Score<span class="sp"></span><span class="f-score" id="f-score">{p0["score"]}<small>/100</small></span></h3>
    <ul class="reasons" id="f-reasons">{reasons(p0)}</ul>
  </section>
  <section class="f-sec" aria-labelledby="f-msg-h">
    <h3 id="f-msg-h" class="sr-only">Message rédigé</h3>
    <div class="tabs" role="tablist" aria-label="Canal du message">
      <button role="tab" aria-selected="true" id="tab-mail" type="button"><svg class="i"><use href="#i-mail"/></svg>Email</button>
      <button role="tab" aria-selected="false" id="tab-wa" type="button"><svg class="i"><use href="#i-chat"/></svg>WhatsApp</button>
    </div>
    <p class="message" id="f-msg" role="tabpanel"><span class="subj">Objet : {E(p0["subject"])}</span>{E(p0["msg"])}</p>
  </section>
  <section class="f-sec" aria-labelledby="f-co">
    <h3 id="f-co">Coordonnées</h3>
    <dl class="kv">
      <dt>Email</dt><dd id="f-email">{E(p0["email"])}<br>{mail0}</dd>
      <dt>Téléphone</dt><dd id="f-phone">{E(p0["phone"])}</dd>
      <dt>Site</dt><dd id="f-site">{E(p0["site"])}</dd>
    </dl>
  </section>
  <section class="f-sec" aria-labelledby="f-legal">
    <h3 id="f-legal">Conformité</h3>
    <dl class="kv">
      <dt>Base légale</dt><dd id="f-basis">{E(p0["basis"])}</dd>
      <dt>Règles</dt><dd id="f-rule">{E(p0["rule"])}</dd>
      <dt>Source</dt><dd id="f-src">{E(p0["source"])}, collecté le {p0["date"]}</dd>
    </dl>
  </section>
</aside>
<div class="scrim" id="scrim"></div>'''

AGENTS = [('Interprète', 'fiche cible prête', None), ('Recherche', 'entreprises trouvées', 286), ('Enrichissement', 'sites lus', 171),
          ('Vérification', 'contacts testés', 132), ('Notation', 'prospects notés', 8), ('Rédaction', 'messages écrits', 8)]
run = ''.join(f'<li data-state="done"><b><i class="dot"></i>{a}</b><span>' + (f'<span data-count="{n}">{n}</span> ' if n else '') + f'{t}</span></li>' for a, t, n in AGENTS)

data = [dict(name=p['name'], role=p['role'], org=p['org'], city=p['city'], cc=p['cc'], country=p['country'], source=p['source'],
             email=p['email'], mail=p['mail'], phone=p['phone'], site=p['site'], reasons=p['reasons'], subject=p['subject'],
             msg=p['msg'], wa=p['wa'], basis=p['basis'], rule=p['rule'], date=p['date'], score=p['score']) for p in P]

BODY = '''  <header class="topbar">
    <div class="crumbs"><a href="app-recherche.html">Recherche</a><span class="sep">/</span><b>Cabinets dentaires, 5 pays</b></div>
    <span class="sp"></span>
    <button class="btn btn-line btn-s" type="button"><svg class="i"><use href="#i-download"/></svg>Exporter</button>
  </header>
  <main class="page" id="contenu">
    <section class="panel" aria-labelledby="h-cible">
      <form class="composer" onsubmit="return false">
        <div>
          <label class="lbl" for="cible" id="h-cible">Décrivez votre cible</label>
          <textarea id="cible" rows="2">Cabinets dentaires privés au Maroc, au Canada, en Belgique, en France et au Sénégal, ouverts récemment ou sans prise de rendez-vous en ligne</textarea>
          <p class="hint">Écrivez comme à un collègue : secteur, lieu, taille, ancienneté, signal utile.</p>
        </div>
        <div class="controls">
          <div class="ctl"><span id="l-type">Type de cible</span>
            <div class="seg" role="group" aria-labelledby="l-type" data-seg>
              <button type="button" aria-pressed="true">Entreprises</button><button type="button" aria-pressed="false">Particuliers</button><button type="button" aria-pressed="false">Les deux</button>
            </div>
          </div>
          <div class="ctl"><span id="l-zone">Pays</span>
            <div class="countries" role="group" aria-labelledby="l-zone">
              <span class="country"><span class="cc">FR</span>France<button type="button" aria-label="Retirer France"><svg class="i"><use href="#i-x"/></svg></button></span>
              <span class="country"><span class="cc">MA</span>Maroc<button type="button" aria-label="Retirer Maroc"><svg class="i"><use href="#i-x"/></svg></button></span>
              <span class="country"><span class="cc">CA</span>Canada<button type="button" aria-label="Retirer Canada"><svg class="i"><use href="#i-x"/></svg></button></span>
              <span class="country"><span class="cc">BE</span>Belgique<button type="button" aria-label="Retirer Belgique"><svg class="i"><use href="#i-x"/></svg></button></span>
              <span class="country"><span class="cc">SN</span>Sénégal<button type="button" aria-label="Retirer Sénégal"><svg class="i"><use href="#i-x"/></svg></button></span>
              <button class="country add" type="button"><svg class="i"><use href="#i-plus"/></svg>Ajouter</button>
            </div>
          </div>
          <div class="launch"><span class="faint">Environ 80 crédits</span><button class="btn btn-accent btn-s" type="button" id="relaunch">Lancer la recherche</button></div>
        </div>
      </form>
    </section>

    <section class="panel" aria-labelledby="h-run" id="runp">
      <div class="panel-h"><h2 id="h-run">Recherche terminée</h2><span class="run-time">8 prospects retenus sur 286 entreprises analysées, en 3 min 06 s</span><span class="sp"></span><span class="run-time">Lancée aujourd'hui à 10:42</span></div>
      <ol class="run">''' + run + '''</ol>
    </section>

    <div class="split">
      <section class="panel" aria-labelledby="h-res" id="results">
        <div class="panel-h">
          <h2 id="h-res">Prospects</h2><span class="faint" style="font-size:13px">8 résultats</span><span class="sp"></span>
          <button class="chip" type="button" aria-pressed="false"><svg class="i"><use href="#i-filter"/></svg>Score 70 et plus</button>
          <button class="chip" type="button" aria-pressed="false">Email vérifié</button>
        </div>
        <div class="tbl-wrap">
          <table class="ptable">
            <caption class="sr-only">Prospects trouvés, triés par score</caption>
            <thead><tr><th class="cb" scope="col"><input type="checkbox" aria-label="Tout sélectionner"></th><th scope="col">Prospect</th><th scope="col" class="c-loc">Ville</th><th scope="col" class="c-mail">Email</th><th scope="col" class="c-src">Source</th><th scope="col" class="c-score">Score</th></tr></thead>
            <tbody aria-live="polite">
''' + rows + '''            </tbody>
          </table>
        </div>
        <div class="tfoot"><span>Les prospects sous 60 sont masqués (14)</span><span>Entrée pour ouvrir, flèches pour naviguer</span></div>
      </section>
''' + FICHE + '''
    </div>
  </main>
</div>
</div>
'''

SCRIPT = '''
<script>window.PROSPECTS = ''' + json.dumps(data, ensure_ascii=False) + ''';</script>
<script type="module">
  import { animate, stagger } from "https://cdn.jsdelivr.net/npm/motion@14.14.0/+esm";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const P = window.PROSPECTS;
  const $ = (id) => document.getElementById(id);
  const rows = [...document.querySelectorAll(".ptable tbody tr")];
  const fiche = $("fiche"), scrim = $("scrim");
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let cur = 0, channel = "mail";
  const mobile = () => window.matchMedia("(max-width: 1023px)").matches;

  function toast(t) { const el = $("toast"); $("toast-t").textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2200); }
  function mailState(p) {
    if (p.mail === "ok") return '<span class="state ok"><svg class="i"><use href="#i-check"/></svg>Confirmé par le serveur mail</span>';
    if (p.mail === "risky") return '<span class="state warn"><svg class="i"><use href="#i-alert"/></svg>Domaine qui accepte tout : à confirmer</span>';
    return '<span class="state none">Aucun email trouvé. Téléphone et WhatsApp professionnels disponibles.</span>';
  }
  function renderMsg() {
    const p = P[cur];
    $("f-msg").innerHTML = channel === "mail" ? '<span class="subj">Objet : ' + esc(p.subject) + "</span>" + esc(p.msg) : esc(p.wa);
    $("tab-mail").setAttribute("aria-selected", channel === "mail"); $("tab-wa").setAttribute("aria-selected", channel === "wa");
  }
  function select(i, open) {
    cur = i; const p = P[i];
    rows.forEach((r, k) => r.setAttribute("aria-selected", k === i));
    $("f-name").textContent = p.name; $("f-role").textContent = p.role + ", " + p.org;
    $("f-loc").innerHTML = '<span class="cc">' + p.cc + "</span> " + esc(p.city) + ", " + esc(p.country);
    $("f-score").innerHTML = p.score + "<small>/100</small>";
    $("f-reasons").innerHTML = p.reasons.map(([pts, t]) => { const v = parseInt(pts); return '<li class="' + (v === 0 ? "zero" : "") + '"><span>' + esc(t) + '</span><span class="track"><i class="fill" style="width:' + Math.round(v / 30 * 100) + '%"></i></span><span class="v">' + pts + "</span></li>"; }).join("");
    $("f-email").innerHTML = (p.email ? esc(p.email) + "<br>" : "") + mailState(p);
    $("f-phone").textContent = p.phone; $("f-site").textContent = p.site;
    $("f-basis").textContent = p.basis; $("f-rule").textContent = p.rule; $("f-src").textContent = p.source + ", collecté le " + p.date;
    channel = p.mail === "none" ? "wa" : "mail"; renderMsg();
    if (!reduce && !mobile()) animate("#f-reasons .fill", { scaleX: [0, 1] }, { delay: stagger(0.04), duration: 0.3, ease: [0.2, 0.7, 0.2, 1] });
    if (open && mobile()) { fiche.classList.add("open"); scrim.classList.add("open"); $("f-close").focus(); }
  }
  function closeFiche() { fiche.classList.remove("open"); scrim.classList.remove("open"); rows[cur].focus(); }
  rows.forEach((r, i) => {
    r.addEventListener("click", (e) => { if (e.target.matches("input")) return; select(i, true); });
    r.addEventListener("keydown", (e) => {
      if (e.key === "Enter") select(i, true);
      if (e.key === "ArrowDown" && rows[i + 1]) { e.preventDefault(); rows[i + 1].focus(); select(i + 1); }
      if (e.key === "ArrowUp" && rows[i - 1]) { e.preventDefault(); rows[i - 1].focus(); select(i - 1); }
    });
  });
  $("f-close").addEventListener("click", closeFiche); scrim.addEventListener("click", closeFiche);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && fiche.classList.contains("open")) closeFiche(); });
  $("tab-mail").addEventListener("click", () => { channel = "mail"; renderMsg(); });
  $("tab-wa").addEventListener("click", () => { channel = "wa"; renderMsg(); });
  $("copy").addEventListener("click", () => { const t = $("f-msg").textContent; navigator.clipboard?.writeText(t).catch(() => {}); toast("Message copié"); });
  $("add-pipe").addEventListener("click", () => toast(P[cur].name + " ajouté au pipeline, étape Nouveau"));
  document.querySelectorAll("[data-seg]").forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
  document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") !== "true")));
  document.querySelectorAll(".country button[aria-label]").forEach((b) => b.addEventListener("click", () => b.parentElement.remove()));

  // Séquence unique : les agents se terminent, les prospects arrivent en direct.
  const steps = [...document.querySelectorAll(".run li")];
  async function replayRun() {
    if (reduce) return;
    const res = $("results"); res.classList.add("armed");
    steps.forEach((s) => (s.dataset.state = "pending"));
    for (const s of steps) {
      await new Promise((r) => setTimeout(r, 240)); s.dataset.state = "done";
      animate(s.querySelector(".dot"), { scale: [0.4, 1] }, { type: "spring", stiffness: 500, damping: 22 });
      const c = s.querySelector("[data-count]"); if (c) animate(0, +c.dataset.count, { duration: 0.5, onUpdate: (v) => (c.textContent = Math.round(v)) });
    }
    await animate(rows, { opacity: [0, 1], y: [6, 0] }, { delay: stagger(0.07), duration: 0.28, ease: [0.2, 0.7, 0.2, 1] });
    res.classList.remove("armed"); rows.forEach((r) => (r.style.opacity = ""));
  }
  $("relaunch").addEventListener("click", replayRun);
  replayRun();
</script>
'''

out = head('Recherche', STYLE) + sidebar('Recherche') + BODY + FOOT + SCRIPT + '</body>\n</html>\n'
open('/home/user/automatic-eureka/docs/maquettes/app-recherche.html', 'w').write(out)
print('ok', len(out))
