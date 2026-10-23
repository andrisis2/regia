# regia — istruzioni per Claude

Codice dell'app **Regia** (PWA): l'assistente personale di Andrea, «come l'app di
Claude, ma migliorata». Si apre su **Regia**, la chat principale, che risponde alle
cose veloci e smista il lavoro lungo agli **agenti** (chat temporanee) o alle **chat
fisse** (Russo, Articoli…); poi il canale delle **News** (👍/👎), il calendario, gli
archivi e l'uso di Claude sempre in vista (due cerchietti in alto, come la
batteria: quanto resta). Qui c'è solo
l'interfaccia; i dati stanno nel repo **privato** `andrisis2/regia-dati`, che ha anche
il workflow che fa rispondere Claude (un turno per chat, in parallelo).

- Live: https://andrisis2.github.io/regia/ (GitHub Pages da `main`, radice)
- Il protocollo dei dati è in `regia-dati/CLAUDE.md` e in `regia-dati/.regia/`.
  **Le regole hanno un gemello qui** in `index.html`: nomi dei messaggi
  (`infoMsg`, `nomeMessaggio`), «in attesa di risposta» (`statoChat`), la chat
  principale (`PRINCIPALE` = `regia`) e i tipi di chat (`tipoChat` ↔ `tipo_chat`:
  fissa, agente, canale), la finestra delle 24 ore (`finestra` ↔ `finestra`), quando
  un agente va in archivio (`agenteConcluso` ↔ `agente_concluso`, campi `finito` e
  `visto` di `chat.json`), i messaggi che non rispondono a nessuno
  (`TIPI_SENZA_DOMANDA`), formato dell'agenda (`serializzaAgenda`, `normalizza`),
  ricorrenze (`occorrenze`), modi di un messaggio (`MODI`, campo `modo`), risposte
  rapide (`leggiProposte`, campo `proposte`), i campi `agenti`, `fine`, `rifai`,
  `corregge`, `da` dei messaggi, nomi dei passi del workflow (`FASI`,
  `faseDelPasso`), il titolo dei turni (`chatDelTurno` ↔ `run-name` di
  `claude.yml` e `smista.py`), il messaggio di commit «messaggio da app: chat/…»
  (fa partire il turno di quella chat), modelli e sforzo (`MODELLI`, `SFORZI`,
  `PREDEFINITI`, campi `modello`/`sforzo` del messaggio, di `chat.json` e di
  `impostazioni.json`, con `modello_altre`/`sforzo_altre`), routine (`FASCE` ↔
  `ORE_UTC` e cron del workflow, campi in `valida_routine`, ordine delle chiavi di
  `chat.json` come `scrivi_meta`: `ORDINE_META`), uso (`uso/uso.json`,
  `limitiValidi`), i voti (`chat/<chat>/voti.json`), le notifiche
  (`notifiche/iscrizioni.json` ↔ `notifica.py`; preferenze `notifiche` in
  `impostazioni.json`), Google Calendar (`agenda/google.json`, id `g-…`,
  `eventiGoogle`). Se ne cambi una, cambiala da tutte e due le parti.

## Struttura

- `index.html` — tutta l'app, senza dipendenze. In ordine: CSS (token in
  `:root`, tema scuro con gli stessi token due volte: dal telefono e scelto a
  mano con `data-tema`), sprite delle icone, HTML (lo schermo è sempre una chat:
  `#app`; sopra, il calendario, il lettore e il primo avvio), e uno script solo
  diviso in sezioni: costanti gemelle, memoria locale e cache dei blob
  (IndexedDB), tema, utilità (copia, voce, ricerca), livelli, pannelli e pagine
  (`pagina()`), date, markdown, API GitHub, formato dell'agenda, modello delle
  chat (tipi, finestra di 24 ore, archivio, turni per chat, agenti, routine),
  sincronizzazione, uso di Claude (i due cerchietti, il pannello), modello e sforzo,
  messaggi in uscita, «Ferma» e «Riprova», voti, `cambiaMeta`, tendina e
  ricerca, archivi (chat e lavoro), casella di scrittura (`kc`), chat aperta
  (`apriChat`, `disegnaChat`, `bolla` a nuvolette come Telegram con `mettiOra`,
  `menuRisposta`/`menuMio` al tocco, post del canale, schede), menu della
  chat, routine, lettore di file, calendario (il mese e il giorno scelto, in sola
  lettura: elimina e «fatto»),
  impostazioni (con «Avanzate»), notifiche (Web Push), connettori, avvio.
- `test/icone.js` — rifà le icone da un SVG.
- `sw.js` — guscio offline e notifiche (push, tocco sulla notifica → la chat
  giusta). **Se cambi file del guscio, alza `CACHE`.**
- `test/` — collaudo end-to-end con GitHub finto.

## Regole

- Lo stile è quello dell'app Articoli (`andrisis2/articoli-`): JavaScript ES5
  con le Promise, nomi in italiano, commenti che spiegano il perché.
- Il token sta in `localStorage`: niente `innerHTML` con testo non passato da
  `escapeHtml`, niente link fuori da `urlSicuro`, niente iframe con
  `allow-scripts` + `allow-same-origin` insieme, niente `blob:` per pagine HTML.
- Tutto ciò che apre qualcosa sopra (una chat che non è Regia, calendario,
  file, pagine, pannelli, tendina) passa da `apriLivello`, e per aprire una cosa
  dopo averne chiusa un'altra si usa `s.close(function(){ … })` /
  `chiudiLivello(fn)` / `chiudiTutto(fn)`, mai un `setTimeout`. I livelli a
  schermo intero si mostrano e nascondono con `mostraEl` / `nascondiEl`
  (l'animazione d'uscita non cambia lo stato). Regia è la base: le altre chat ci
  vanno sopra, e indietro torna a Regia.
- Niente parole di GitHub davanti: token, repo, segreti stanno in Impostazioni →
  Avanzate e nelle spiegazioni dei connettori. Per Andrea è un «codice di accesso».
- L'agenda non si riscrive mai dalla copia locale: si accoda un'operazione
  (`accodaAgenda`) che dice solo cosa cambia; dall'app si toglie e si segna
  fatto, per aggiungere si chiede a Regia. Gli eventi di Google Calendar non si
  toccano (`agendaConGoogle` solo per mostrare). `impostazioni.json`,
  `chat.json` (`cambiaMeta`), `voti.json` e `notifiche/iscrizioni.json` si
  rileggono prima di scriverli.
- Prima di pubblicare: `node test/prova.js` deve finire con «TUTTO OK», e gli
  screenshot vanno guardati (chiaro e scuro, telefono).

## Git e merge

Come negli altri repo di Andrea: si parte da `origin/main`
(`git fetch origin && git checkout -B <branch> origin/main`), commit, push,
PR, e **il merge lo fa Claude senza chiedere conferma** (PR da draft a ready,
squash-merge). Si chiede prima solo se è il *contenuto* a essere ambiguo.
