/* Choix de l'accent (orange énergie / bleu électrique).
   Ordre de priorité : ?accent=bleu dans l'URL, puis choix mémorisé, puis orange.
   Script classique chargé dans <head> pour éviter un flash de couleur. */
(function () {
  var root = document.documentElement;
  var KEY = "scoutra-accent";
  var allowed = { orange: 1, bleu: 1 };
  var fromUrl = null;
  try { fromUrl = new URLSearchParams(location.search).get("accent"); } catch (e) {}
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) {}
  var current = allowed[fromUrl] ? fromUrl : (allowed[stored] ? stored : "orange");
  root.setAttribute("data-accent", current);
  root.classList.add("js");

  function sync() {
    var btns = document.querySelectorAll("[data-set-accent]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-pressed", String(btns[i].getAttribute("data-set-accent") === current));
    }
  }

  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest("[data-set-accent]");
    if (!btn) return;
    current = btn.getAttribute("data-set-accent");
    root.setAttribute("data-accent", current);
    try { localStorage.setItem(KEY, current); } catch (e) {}
    sync();
  });

  document.addEventListener("DOMContentLoaded", sync);
})();
