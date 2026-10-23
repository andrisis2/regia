# Regia — l'app

PWA per dare ordini a Claude dal telefono: **una chat per ogni progetto**, una
chat **Generale** per tutto il resto, e un'**agenda** che Claude tiene in ordine.

- Live: https://andrisis2.github.io/regia/
- Dati: repo **privato** `andrisis2/regia-dati` — **qui non c'è nessuna chat e nessun appuntamento**

## Come funziona

```
telefono (questa app) ──commit──► regia-dati (privato) ──push──► GitHub Actions: Claude Code
        ▲                                                                │
        └────────────── l'app vede il commit di risposta ◄──commit───────┘
```

1. Scrivi in una chat: il messaggio diventa un file in
   `chat/<chat>/messaggi/` di `regia-dati` (un commit vero).
2. Il commit fa partire il workflow di `regia-dati`, dove **Claude Code**
   legge i messaggi nuovi, fa quello che chiedi (agenda, ricerche, file,
   lavoro sui repo collegati alla chat) e risponde con un altro commit.
3. L'app guarda il repo ogni pochi secondi mentre Claude lavora, e mostra la
   risposta. Ci vogliono di solito uno o due minuti.

Il protocollo (come si chiama un messaggio, quando una chat aspetta risposta,
il formato dell'agenda) è scritto in `regia-dati/CLAUDE.md` e negli script
`regia-dati/.regia/`. L'app ne ha un gemello in JavaScript: se cambi una
regola di là, va cambiata anche qui.

## Cosa c'è nell'app

L'aspetto è quello delle app di chat con un'IA (Grok, in primis): fondo quasi
nero o quasi bianco, la casella di scrittura al centro della scena, un solo
accento caldo. Segue il tema del telefono, o lo si sceglie nelle Impostazioni.

- **Pagina di partenza**: il saluto, la giornata in breve (briefing del
  mattino, eventi di oggi o di domani sera, cose da fare in scadenza), se
  Claude sta lavorando e dove, le chat. In basso la casella: si scrive a Claude
  da lì, scegliendo la chat (Generale di solito), con le idee pronte sopra.
- **Casella di scrittura** (uguale nella pagina di partenza e nelle chat):
  allegati (anche incollati o trascinati dal computer; foto ridotte a 2000 px),
  **dettatura** col microfono, e due modi per il prossimo messaggio:
  **Ricerca** (ricerca approfondita sul web, con rapporto e fonti) e
  **Ragiona** (ragiona a fondo prima di rispondere). Bozze che non si perdono,
  messaggi che partono quando torna la rete.
- **Chat**: le risposte di Claude a tutta larghezza, come in Grok, con sotto
  copia, leggi ad alta voce, condividi e «rispondi citando»; il codice ha il
  suo «Copia». Mentre Claude lavora si vedono le fasi del turno (in coda,
  preparo, al lavoro, salvo) e da quanto si aspetta. Sotto l'ultima risposta,
  le **risposte rapide** proposte da Claude: un tocco e partono. Riga «Nuovi»
  dove cominciano i messaggi non letti, bottone per tornare in fondo.
  Se qualcosa non va, «Riprova».
- **Menu laterale** (☰): **cerca** nei titoli e in tutti i messaggi (un tocco
  apre la chat sul messaggio), nuova chat, agenda, tutte le chat, impostazioni.
- Dal menu ⋯ di una chat (o toccando il titolo): **istruzioni** per Claude e
  **memoria** di Claude (si leggono e si correggono), **file** prodotti da
  Claude, titolo, descrizione e **repo collegati**, archivia.
- **Agenda** (📅 in alto): *Prossimi* (sei settimane), *Mese* (griglia),
  *Da fare* (compiti con scadenza e priorità). Eventi ripetuti, eventi di più
  giorni, «solo questa volta». Un tocco su un evento: modifica, Google
  Calendar, «Chiedi a Claude». «Organizza» apre Generale con la richiesta pronta.
- **Impostazioni**: token, aspetto (automatico, scuro, chiaro) e nome per il
  saluto, briefing del mattino acceso/spento, controllo della configurazione,
  esportazione dell'agenda in `.ics`.
- Gesti: tirare giù la pagina di partenza la aggiorna; dal bordo sinistro
  verso destra si torna indietro (utile su iPhone, dove l'app installata non
  ha il gesto del sistema).

## Perché è un repo a sé

Come per Articoli: serve un sito su HTTPS per installare la PWA, e Pages
pubblica solo da repo pubblici. Qui vive solo l'interfaccia, che non contiene
segreti; le chat e l'agenda restano nel repo privato.

## File

- `index.html` — tutta l'app (interfaccia + logica, nessuna dipendenza esterna)
- `manifest.json`, `sw.js` — installazione sul telefono e guscio offline
- `icon.png`, `icon-192.png`, `icon-maskable.png`, `apple-touch-icon.png` — icone
  (si rifanno con `node test/icone.js`, da un SVG solo)
- `test/` — collaudo con un GitHub finto (vedi sotto)

## Come parla con GitHub

API REST con un token *fine-grained* che si incolla una volta nelle
Impostazioni e sta **solo** nel `localStorage` del telefono:

- su `regia-dati`: **Contents: Read and write** (chat, agenda) e
  **Actions: Read and write** (vedere quando e a che passo Claude lavora,
  «Riprova»);
- `git/ref` + `git/trees` per sapere cosa c'è, `git/blobs` per leggere
  (i blob non cambiano mai, quindi si tengono in IndexedDB per sempre),
  `contents` per scrivere un file, `git/trees` + `git/commits` per scriverne
  più d'uno in un commit solo (messaggio + allegati, chat nuova).

Il service worker tiene in cache solo il guscio e lascia passare tutto ciò che
va verso `api.github.com`.

### Sicurezza

Il token sta nella pagina, quindi:

- il markdown dei messaggi esce tutto con l'escape, e i link vanno solo a
  `http(s)`, `mailto`, `tel` o a un file del repo (niente `javascript:`);
- le pagine HTML prodotte da Claude si aprono in un iframe in sandbox
  **senza** `allow-same-origin` (come in Articoli: le due cose non vanno
  mai rimesse insieme);
- i file che non si leggono nell'app si scaricano, non si aprono come
  pagine (`blob:` erediterebbe l'origine dell'app).

## Agenda e fusioni

L'agenda è un file solo (`agenda/agenda.json`), con **una voce per riga**.
L'app non riscrive mai il file intero a partire dalla sua copia: mette in coda
le modifiche (campo per campo) e al salvataggio le applica all'ultima versione
su GitHub. Così se Claude ha cambiato qualcosa nel frattempo, non si perde.
Dalla parte del workflow, `merge_agenda.py` fa lo stesso voce per voce.

## Pubblicazione

GitHub Pages, dal branch `main`, cartella radice (`/`).

## Collaudo

```bash
node test/prova.js        # con regia-dati clonato di fianco (o REGIA_DATI=…)
```

Apre l'app in Chromium con lo schermo di un telefono, contro un GitHub finto in
memoria (`test/mockgh.js`, con gli sha veri di git): primo avvio, pagina di
partenza, chat, invio, fasi del turno, risposta di Claude con risposte rapide,
link pericolosi, allegati e modi, offline, Riprova, agenda (anche con Claude
che scrive nel frattempo), chat nuova, casella della pagina di partenza,
ricerca, ricaricamento, tema scelto a mano, tema scuro.
Gli screenshot finiscono in `$TMPDIR/regia-shots`.
