# regia — istruzioni per Claude

Codice dell'app **Regia** (PWA): chat con Claude divise per progetto, più
l'agenda. Qui c'è solo l'interfaccia; i dati stanno nel repo **privato**
`andrisis2/regia-dati`, che ha anche il workflow che fa rispondere Claude.

- Live: https://andrisis2.github.io/regia/ (GitHub Pages da `main`, radice)
- Il protocollo dei dati è in `regia-dati/CLAUDE.md` e in `regia-dati/.regia/`.
  **Le regole hanno un gemello qui** in `index.html`: nomi dei messaggi
  (`infoMsg`, `nomeMessaggio`), «in attesa di risposta» (`statoChat`), formato
  dell'agenda (`serializzaAgenda`, `normalizza`), ricorrenze (`occorrenze`).
  Se ne cambi una, cambiala da tutte e due le parti.

## Struttura

- `index.html` — tutta l'app, senza dipendenze. In ordine: CSS (token in
  `:root`, tema scuro con gli stessi token), sprite delle icone, HTML, e uno
  script solo diviso in sezioni: memoria locale e cache dei blob (IndexedDB),
  utilità, livelli e tasto indietro, date, markdown, API GitHub, agenda
  (formato e ricorrenze), modello delle chat, sincronizzazione, messaggi in
  uscita, elenco chat, chat aperta, lettore di file, agenda (coda delle
  modifiche, viste, moduli, .ics), impostazioni, avvio.
- `sw.js` — guscio offline. **Se cambi file del guscio, alza `CACHE`.**
- `test/` — collaudo end-to-end con GitHub finto.

## Regole

- Lo stile è quello dell'app Articoli (`andrisis2/articoli-`): JavaScript ES5
  con le Promise, nomi in italiano, commenti che spiegano il perché.
- Il token sta in `localStorage`: niente `innerHTML` con testo non passato da
  `escapeHtml`, niente link fuori da `urlSicuro`, niente iframe con
  `allow-scripts` + `allow-same-origin` insieme, niente `blob:` per pagine HTML.
- Tutto ciò che apre qualcosa sopra (chat, file, pannello) passa da
  `apriLivello`, e per aprire una cosa dopo averne chiusa un'altra si usa
  `s.close(function(){ … })` / `chiudiLivello(fn)`, mai un `setTimeout`.
- L'agenda non si riscrive mai dalla copia locale: si accoda un'operazione
  (`accodaAgenda`) che dice solo cosa cambia.
- Prima di pubblicare: `node test/prova.js` deve finire con «TUTTO OK», e gli
  screenshot vanno guardati (chiaro e scuro, telefono).

## Git e merge

Come negli altri repo di Andrea: si parte da `origin/main`
(`git fetch origin && git checkout -B <branch> origin/main`), commit, push,
PR, e **il merge lo fa Claude senza chiedere conferma** (PR da draft a ready,
squash-merge). Si chiede prima solo se è il *contenuto* a essere ambiguo.
