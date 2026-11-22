# Parties communes aux deux écrans d'application (barre latérale, barres mobiles, outils de maquette).
def head(title, style):
    return '''<!doctype html>
<html lang="fr" data-accent="orange">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>''' + title + ''' — Scoutra</title>
<link rel="icon" href="../design/logo/a-trace-favicon-32.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mona+Sans:wdth,wght@75..125,400..700&display=swap">
<link rel="stylesheet" href="assets/scoutra.css">
<script src="assets/accent.js"></script>
<style>''' + style + '''</style>
</head>
<body class="app-body">
<!--ICONS-->
<a class="skip" href="#contenu">Aller au contenu</a>
'''

NAV = [('app-recherche.html', 'i-search', 'Recherche', 'R'), ('app-pipeline.html', 'i-kanban', 'Pipeline', 'P'),
       ('app-recherche.html#prospects', 'i-users', 'Prospects', None), ('app-recherche.html#exports', 'i-download', 'Exports', None),
       ('app-recherche.html#parametres', 'i-settings', 'Paramètres', None)]

def sidebar(active):
    items = ''
    for href, ic, label, key in NAV:
        cur = ' aria-current="page"' if label == active else ''
        extra = '<span class="n">1 172</span>' if label == 'Prospects' else (f'<kbd>G {key}</kbd>' if key else '')
        items += f'<li><a href="{href}"{cur}><svg class="i"><use href="#{ic}"/></svg>{label}{extra}</a></li>'
    tabs = ''.join(f'<a href="{h}"' + (' aria-current="page"' if l == active else '') + f'><svg class="i"><use href="#{ic}"/></svg>{l}</a>' for h, ic, l, k in NAV[:3])
    return f'''<div class="app">
<aside class="sidebar" aria-label="Menu principal">
  <a href="index.html" aria-label="Scoutra, site"><!--LOGO--></a>
  <button class="ws" type="button" aria-label="Changer d'espace de travail"><span class="ws-av">R</span><span><b>Rendezvo</b><small>Formule Pipeline</small></span><svg class="i"><use href="#i-chevron"/></svg></button>
  <nav aria-label="Sections"><ul class="snav">{items}</ul></nav>
  <p class="side-h">Recherches récentes</p>
  <ul class="recent">
    <li><a href="app-recherche.html">Cabinets dentaires, 5 pays</a></li>
    <li><a href="app-recherche.html">Agences de voyage à Lisbonne</a></li>
    <li><a href="app-recherche.html">Coachs sportifs à Miami</a></li>
    <li><a href="app-recherche.html">Distributeurs médicaux, Allemagne</a></li>
  </ul>
  <div class="side-foot">
    <div class="credits"><p><span>Crédits ce mois-ci</span><span><b class="tnum">1 412</b> / 2 000</span></p><div class="bar"><i style="width:70.6%"></i></div></div>
    <div class="me"><span class="av">SM</span><span>Sofia Mendes<small>sofia@rendezvo.example</small></span></div>
  </div>
</aside>
<div class="main">
  <div class="mobile-bar"><!--LOGO--><span class="sp"></span><span class="av">SM</span></div>
  <nav class="mobile-tabs" aria-label="Sections">{tabs}</nav>
'''

FOOT = '''
<div class="mock-tools" role="region" aria-label="Options de la maquette">
  <span class="demo">Données de démonstration</span>
  <div class="seg" role="group" aria-label="Couleur d'accent">
    <button type="button" data-set-accent="orange" aria-pressed="true"><span class="sw" style="background:#ff5b1f"></span>Orange</button>
    <button type="button" data-set-accent="bleu" aria-pressed="false"><span class="sw" style="background:#2b59ff"></span>Bleu</button>
  </div>
</div>
<div class="toast" id="toast" role="status" aria-live="polite" hidden><svg class="i"><use href="#i-check"/></svg><span id="toast-t"></span></div>
'''
