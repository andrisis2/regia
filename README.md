# Regia — l'app

PWA per avere Claude sempre a portata di mano, «come l'app di Claude, ma
migliorata e fatta su misura»: si apre su **Regia**, la chat principale, che
risponde subito alle cose veloci (domande secche, consigli, l'agenda) e **smista**
il lavoro lungo agli **agenti** (una chat che nasce per quel lavoro, poi va in
archivio) o alle **chat fisse** (Russo, Articoli, Lavoro, Posta, Fede, Le mie app);
il canale delle **News** con 👍 e 👎; il calendario; gli archivi; le notifiche sul
telefono. In alto, sempre, **quanto si sta usando Claude**.

- Live: https://andrisis2.github.io/regia/
- Dati: repo **privato** `andrisis2/regia-dati` — **qui non c'è nessuna chat e nessun appuntamento**

## Come funziona

```
telefono (questa app) ──commit──► regia-dati (privato) ──push──► GitHub Actions: Claude Code
        ▲                                                     (un turno per chat, in parallelo;
        │                                                      Regia fa partire gli agenti)
        └──── l'app vede il commit di risposta (e arriva la notifica) ◄──commit──┘
```

1. Scrivi in una chat: il messaggio diventa un file in
   `chat/<chat>/messaggi/` di `regia-dati` (un commit vero, «messaggio da app:
   chat/<chat>»).
2. Il commit fa partire il turno di **quella** chat nel workflow di
   `regia-dati`: **Claude Code** legge i messaggi nuovi, fa quello che chiedi
   e risponde con un altro commit. Le chat lavorano in parallelo: Regia
   risponde subito anche mentre un agente lavora da mezz'ora.
3. In Regia, un lavoro lungo diventa un agente: nella risposta compare la sua
   scheda (sta lavorando… · ha finito ✓), che si apre con un tocco.
4. L'app guarda il repo ogni pochi secondi mentre Claude lavora, e il telefono
   riceve la notifica quando risponde.

Il protocollo (come si chiama un messaggio, quando una chat aspetta risposta,
i tipi di chat, la finestra di 24 ore, gli agenti, il formato dell'agenda) è
scritto in `regia-dati/CLAUDE.md` e negli script `regia-dati/.regia/`. L'app ne
ha un gemello in JavaScript: se cambi una regola di là, va cambiata anche qui.

## Cosa c'è nell'app

L'aspetto è quello dell'app di Claude, ma più asciutto, con le chat come su
Telegram: fondo quasi bianco o quasi nero, i messaggi in nuvolette, un solo
accento caldo. Segue il tema del telefono, o lo si sceglie nelle Impostazioni.

- **In alto**, una riga sola: il menu (☰, col pallino se una chat ti ha
  scritto; nelle altre chat al suo posto c'è indietro e il nome della chat),
  l'**uso di Claude** in due cerchietti con la percentuale, come la batteria
  del telefono: quanto **resta** della sessione di 5 ore e della settimana
  (arancioni sotto il 30%, rossi sotto il 10%: un tocco apre il pannello con i
  numeri), e il **calendario**. Nient'altro.
- **Regia**, la chat principale, è quella che si apre sempre. Si vedono le
  ultime 24 ore; il resto va nell'archivio della chat (un tocco su «Le
  conversazioni di prima sono nell'archivio»). Quando non c'è niente, il
  saluto e qualche idea pronta.
- **Gli agenti**: quando Regia affida un lavoro, sotto la risposta c'è la
  scheda dell'agente col suo stato; un tocco apre la sua chat (col compito,
  «Affidato da Regia»), dove gli puoi rispondere. Quando ha finito e l'hai
  visto, dopo 5 ore va nell'archivio; quello che ha prodotto resta
  nell'**Archivio lavoro**.
- **La tendina** (☰, o col dito dal bordo sinistro): Regia, le chat fisse,
  gli agenti al lavoro (con lo stato). Il triangolino di ogni chat apre il suo
  **archivio** (le conversazioni passate, giorno per giorno) e le sue
  impostazioni. In fondo, in una riga, **Archivio chat** (agenti conclusi,
  chat archiviate, conversazioni passate), **Archivio lavoro** (tutti i file
  prodotti da Claude, con filtro e ricerca) e **Impostazioni**. In cima, la
  **ricerca** in tutti i messaggi.
- **Le chat**, come su Telegram: le risposte di Claude in nuvolette a
  sinistra, i tuoi messaggi a destra (color pesca), con la codina, l'ora
  dentro e, nei tuoi, le spunte (✓ arrivato, ✓✓ Claude ha risposto). Un
  tocco su un messaggio apre il suo menu: in cima 👍 e 👎 (Claude li legge e
  impara cosa ti piace; la reazione resta sulla nuvoletta), poi copia,
  **rigenera**, rispondi citando, leggi ad alta voce, condividi; nei tuoi
  copia e **modifica**. Le risposte rapide proposte da Claude sono bottoni
  sotto il messaggio, come quelli dei bot; le schede dei file prodotti
  («artifact»), delle voci d'agenda e degli agenti stanno dentro la
  nuvoletta. Mentre Claude lavora si vedono le fasi del turno, e la freccia
  d'invio diventa **«Ferma»**.
- **La casella**: il «+» per fotocamera, foto e file, **Ricerca approfondita**
  e **Ragiona a fondo**; il **modello e lo sforzo** (Fable, Opus, Sonnet,
  Haiku; sforzo basso, medio, alto, extra, massimo) per i prossimi messaggi di
  quella chat; la dettatura. Di partenza: Regia con Sonnet e sforzo medio, le
  altre chat e gli agenti con Haiku e sforzo extra.
- **News**: un canale, come su Telegram. Ogni notizia è un post, con 👍, 👎 e
  «Approfondisci».
- **Calendario**: solo il calendario. Il mese (in alto, con le frecce e
  «Oggi») e sotto il giorno scelto: i suoi impegni, anche di **Google
  Calendar**, e le cose da fare che scadono quel giorno. Niente liste a parte.
  Si guarda e basta: si può togliere un impegno (anche «solo questa volta» in
  uno che si ripete) o segnare fatta una cosa; per aggiungere o spostare si
  chiede a Regia («Chiedi a Regia» nella scheda di un impegno).
- **Notifiche**: si accendono dalle Impostazioni (su iPhone, con l'app sulla
  schermata Home). Arrivano quando una chat ti scrive (per chat: Regia,
  agenti, News, le altre), e poco prima di ogni impegno (i promemoria).
- **Impostazioni**: modello e sforzo di Regia e delle altre chat, uso di
  Claude, briefing del mattino, promemoria, routine, notifiche, chat fisse
  (e una nuova), connettori (Gmail, Google Calendar, le tue app, il web, e cosa
  non arriva qui), aspetto. GitHub sta in **Avanzate**: il codice di accesso, il
  controllo della configurazione, l'esportazione del calendario in `.ics`.

## Perché è un repo a sé

Come per Articoli: serve un sito su HTTPS per installare la PWA, e Pages
pubblica solo da repo pubblici. Qui vive solo l'interfaccia, che non contiene
segreti; le chat e l'agenda restano nel repo privato.

## File

- `index.html` — tutta l'app (interfaccia + logica, nessuna dipendenza esterna)
- `manifest.json`, `sw.js` — installazione sul telefono, guscio offline e notifiche
- `icon.png`, `icon-192.png`, `icon-maskable.png`, `apple-touch-icon.png` — icone
  (si rifanno con `node test/icone.js`, da un SVG solo)
- `test/` — collaudo con un GitHub finto (vedi sotto)

## Come parla con GitHub

API REST con un token *fine-grained* che si incolla una volta nelle
Impostazioni e sta **solo** nel `localStorage` del telefono:

- su `regia-dati`: **Contents: Read and write** (chat, agenda) e
  **Actions: Read and write** (vedere quando e a che passo Claude lavora,
  «Ferma», «Riprova»);
- `git/ref` + `git/trees` per sapere cosa c'è, `git/blobs` per leggere
  (i blob non cambiano mai, quindi si tengono in IndexedDB per sempre),
  `contents` per scrivere un file, `git/trees` + `git/commits` per scriverne
  più d'uno in un commit solo (messaggio + allegati, chat nuova).

Il service worker tiene in cache solo il guscio e lascia passare tutto ciò che
va verso `api.github.com`; in più riceve le notifiche (cifrate per il telefono,
le manda il workflow) e apre la chat giusta al tocco.

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
memoria (`test/mockgh.js`, con gli sha veri di git): primo avvio, Regia coi
due cerchietti dell'uso e la finestra di 24 ore, invio, fasi del turno, «Ferma», un
agente dalla scheda alla sparizione dopo 5 ore (col «visto»), archivi, il menu
dei messaggi come su Telegram (copia, 👍, rigenera, modifica, cita), ora e spunte, il «+» con ricerca e foto,
modello e sforzo, link pericolosi, offline, Riprova, una chat fissa e il gesto
dal bordo, il canale delle News con i voti, il calendario in sola lettura,
impostazioni e notifiche (con un servizio push finto), uso, ricerca, apertura da
una notifica, ricaricamento, tema scuro. Gli screenshot finiscono in
`$TMPDIR/regia-shots`.
