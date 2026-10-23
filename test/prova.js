// Collaudo end-to-end di Regia: Chromium con schermo da telefono, GitHub finto.
// uso: node test/prova.js   (serve Playwright; REGIA_DATI = cartella di regia-dati, di fianco a regia)
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const fs = require('fs');
const path = require('path');
const { Repo, gestisci } = require('./mockgh');

const APP = path.join(__dirname, '..');
const DATI = process.env.REGIA_DATI || path.join(APP, '..', 'regia-dati');
const SHOTS = process.env.REGIA_SHOTS || path.join(require('os').tmpdir(), 'regia-shots');
fs.mkdirSync(SHOTS, { recursive: true });

let ok = true, n = 0;
function verifica(cond, cosa) { console.log((cond ? '  ✓ ' : '  ✗ ') + cosa); if (!cond) ok = false; }
function stampa(d) { const p = x => String(x).padStart(2, '0'); return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + '-' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()); }
function oggiRoma(k = 0) { const d = new Date(Date.now() + k * 864e5); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isoTra = ms => new Date(Date.now() + ms).toISOString();
const nomeTra = (ms, autore) => stampa(new Date(Date.now() + ms)) + '-' + autore + '-' + Math.random().toString(36).slice(2, 6) + '.md';

async function servi(context, repo) {
  await context.route('https://api.github.com/**', r => gestisci(repo, r));
  await context.route('https://regia.test/**', r => {
    let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html';
    const f = path.join(APP, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: 'no' });
    const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
    r.fulfill({ status: 200, headers: { 'Content-Type': tipi[path.extname(f)] || 'application/octet-stream' }, body: fs.readFileSync(f) });
  });
}

// prima della foto si lasciano finire le animazioni d'entrata (livelli, pannelli)
async function shot(page, nome) { n++; await sleep(400); await page.screenshot({ path: path.join(SHOTS, String(n).padStart(2, '0') + '-' + nome + '.png') }); }
// i messaggi di Andrea nel repo, dal più vecchio
function diAndrea(repo, chat) { return Object.keys(repo.files()).filter(p => new RegExp('^chat/' + chat + '/messaggi/.*-andrea-').test(p)).sort(); }
// Claude risponde (simulato): un messaggio suo, e la chat segnata come risposta
function rispondi(repo, chat, testo, extra) {
  const f = Object.assign({}, repo.files());
  const fino = diAndrea(repo, chat).pop();
  f['chat/' + chat + '/messaggi/' + nomeTra(2000, 'claude')] = repo.putBlob(Buffer.from(testo));
  if (fino) f['chat/' + chat + '/stato.json'] = repo.putBlob(Buffer.from(JSON.stringify({ risposto_fino_a: fino.split('/').pop(), run: 'x' })));
  Object.assign(f, extra || {});
  repo.commit(f, 'Claude risponde: ' + chat);
}
function scrivi(repo, files, msg) {
  const f = Object.assign({}, repo.files());
  for (const [p, t] of Object.entries(files)) f[p] = repo.putBlob(Buffer.from(t));
  repo.commit(f, msg || 'scrive');
}
const json = p => JSON.parse(p);
const ultimoDi = (repo, chat) => repo.text(diAndrea(repo, chat).pop());
const aspettaInvio = page => page.waitForFunction(() => !document.querySelector('#cmsgs .msg.out'), null, { timeout: 15000 });
// aspetta che nel repo compaia (o cambi) un file
async function aspettaFile(repo, p, cond, ms = 10000) {
  for (let t = 0; t < ms; t += 250) { const x = repo.text(p); if (x != null && (!cond || cond(x))) return x; await sleep(250); }
  return repo.text(p);
}

(async () => {
  const browser = await chromium.launch();
  const repo = new Repo(DATI);
  // la conversazione di Regia la scrive il collaudo: via i messaggi veri di Andrea (e gli avvisi)
  // che ci sono nel repo dei dati, se no il risultato dipende da cosa ha scritto oggi
  for (const p of Object.keys(repo.files())) if (/^chat\/regia\/messaggi\/.*-(andrea|sistema)-/.test(p)) repo.remove(p, 'collaudo: Regia da capo');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await servi(context, repo);
  await context.grantPermissions(['clipboard-read', 'clipboard-write', 'notifications'], { origin: 'https://regia.test' });
  const page = await context.newPage();
  // un servizio di notifiche finto: il telefono «si iscrive» e dà il suo indirizzo
  await page.addInitScript(() => {
    if (!navigator.serviceWorker) return;
    const reg = { pushManager: {
      _sub: null,
      getSubscription() { return Promise.resolve(this._sub); },
      subscribe(o) { window.__chiaveApp = o.applicationServerKey; this._sub = { endpoint: 'https://push.example.com/telefono-1',
        toJSON: () => ({ endpoint: 'https://push.example.com/telefono-1', keys: { p256dh: 'BOr-chiave-del-telefono', auth: 'segreto-auth' } }),
        unsubscribe: () => { reg.pushManager._sub = null; return Promise.resolve(true); } }; return Promise.resolve(this._sub); } },
      showNotification(t, o) { window.__notifiche = (window.__notifiche || []).concat([[t, o.body]]); return Promise.resolve(); } };
    Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve(reg) });
    navigator.serviceWorker.register = () => Promise.resolve(reg);
    window.PushManager = window.PushManager || function () {};
  });
  // tocchi veri (col dito): per i gesti dal bordo
  const cdp = await context.newCDPSession(page);
  async function trascina(x0, y0, x1, y1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 10, y: y0 + (y1 - y0) * i / 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  const appunti = () => page.evaluate(() => navigator.clipboard.readText());
  const errori = [];
  page.on('pageerror', e => errori.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) errori.push('console: ' + m.text()); });
  let dialoghi = 0;
  page.on('dialog', d => { dialoghi++; d.dismiss(); });
  const sync = async () => { await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(900); };

  // quello che scrive il workflow: l'uso di Claude (14 giorni di turni) e Google Calendar
  const turni = [];
  for (let k = 13; k >= 0; k--) {
    const quanti = k === 0 ? 3 : (k * 7) % 4;
    for (let j = 0; j < quanti; j++) {
      const opus = (k + j) % 3 === 0;
      turni.push({ quando: isoTra(-k * 864e5 - j * 3600e3 - 60e3), esito: 'ok', modello: opus ? 'claude-opus-5-5' : 'claude-sonnet-5-5', chat: [k % 2 ? 'regia' : 'notizie'],
        routine: 0, secondi: 40 + k * 9, passi: 6, costo_usd: opus ? 0.42 : 0.11,
        token: { input: 1200, output: 900 + k * 120, cache_letti: 30000 + k * 4000, cache_scritti: 5000 },
        modelli: opus ? { 'claude-opus-5-5': { token_out: 900, token_in: 36000, costo_usd: 0.42 } } : { 'claude-sonnet-5-5': { token_out: 900, token_in: 36000, costo_usd: 0.11 } } });
    }
  }
  let vecchia;
  scrivi(repo, {
    'uso/uso.json': JSON.stringify({ versione: 1, aggiornato: isoTra(-20 * 60e3),
      limiti: { five_hour: { percento: 42, stato: 'allowed', azzera: isoTra(2 * 3600e3), visto: isoTra(-20 * 60e3) },
                seven_day: { percento: 76, stato: 'allowed_warning', azzera: isoTra(3 * 864e5), visto: isoTra(-20 * 60e3) } }, turni }, null, 1),
    'agenda/google.json': JSON.stringify({ versione: 1, aggiornato: isoTra(-30 * 60e3), calendari: ['Personale'],
      eventi: [{ id: 'g-1a2b3c4d5e', titolo: 'Call con Luca', data: oggiRoma(2), ora: '10:00', ora_fine: '10:30', luogo: 'Meet', fonte: 'google', calendario: 'Personale' }] }),
    // Regia: una conversazione di tre giorni fa (archivio, già risposta) e il benvenuto di oggi
    ['chat/regia/messaggi/' + (vecchia = nomeTra(-3 * 864e5, 'andrea'))]: 'Che tempo fa a Mosca a dicembre?\n',
    'chat/regia/stato.json': JSON.stringify({ risposto_fino_a: vecchia }),
    ['chat/regia/messaggi/' + nomeTra(-3 * 864e5 + 60e3, 'claude')]: 'Freddo: tra −5 e −10 gradi, poche ore di luce.\n',
    ['chat/regia/messaggi/' + nomeTra(-2 * 3600e3, 'claude')]: 'Ciao Andrea! Da oggi Regia smista il lavoro agli agenti.\n',
    // News: due notizie stamattina
    ['chat/notizie/messaggi/' + nomeTra(-90 * 60e3, 'claude')]: '---\ntipo: notizia\nroutine: r-rassegna\n---\n**La BCE lascia i tassi fermi**\nLa decisione era attesa; Lagarde apre a un taglio a dicembre. https://www.ecb.europa.eu\n',
    ['chat/notizie/messaggi/' + nomeTra(-89 * 60e3, 'claude')]: '---\ntipo: notizia\nroutine: r-rassegna\n---\n**L\'Istat rivede il PIL**\nCrescita del terzo trimestre allo 0,2%. https://www.istat.it\n'
  }, 'turno: uso, calendario, messaggi');
  const runRegia = { id: 1, status: 'in_progress', conclusion: null, html_url: 'https://github.com/x/runs/1', created_at: isoTra(0), run_started_at: isoTra(0), event: 'push',
    display_title: 'messaggio da app: chat/regia',
    steps: [{ name: 'Set up job', status: 'completed' }, { name: 'Installa Claude Code', status: 'completed' }, { name: 'Turno di Claude', status: 'in_progress' }, { name: 'Salva su GitHub', status: 'queued' }] };

  console.log('1. primo avvio: solo il codice di accesso');
  await page.goto('https://regia.test/');
  await page.waitForSelector('#benvenuto:not(.hide)');
  verifica(!/github|repo|token/i.test(await page.innerText('#benvenuto')) && (await page.isHidden('#benvenuto details ol')), 'niente parole di GitHub davanti (le istruzioni sono chiuse)');
  await shot(page, 'benvenuto');
  await page.fill('#bTok', 'tok-finto');
  await page.click('#bEntra');
  await page.waitForSelector('#benvenuto', { state: 'hidden' });
  await page.waitForSelector('#cmsgs .msg');

  console.log('2. si apre su Regia: in alto il menu, i due cerchietti dell\'uso e il calendario, e basta');
  verifica(await page.isHidden('#cTesta'), 'in Regia niente nome della chat');
  verifica((await page.$$('#topbar > :not(.hide):not(.grow)')).length === 3, 'la barra in alto: menu, uso, calendario');
  verifica(await page.textContent('#ub5 b') === '58%' && await page.textContent('#ub7 b') === '24%', 'i cerchietti dicono quanto resta, come la batteria: 5 ore 58%, settimana 24%');
  await sleep(900);
  const arco = sel => page.$eval(sel + ' .arco', a => { const [p, g] = getComputedStyle(a).strokeDasharray.split(',').map(parseFloat); return Math.round(100 * p / g); });
  verifica(await arco('#ub5') === 58 && await arco('#ub7') === 24, 'e sono pieni quanto resta');
  verifica((await page.getAttribute('#ub7', 'class')).includes('attenzione') && !(await page.getAttribute('#ub5', 'class')).includes('attenzione'), 'la settimana in arancione (resta meno di un terzo)');
  verifica((await page.getAttribute('#uso', 'aria-label')).includes('Sessione di 5 ore: resta il 58%'), 'e il nome per chi non vede i cerchietti');
  const testoRegia = await page.textContent('#cmsgs');
  verifica(testoRegia.includes('smista il lavoro') && !testoRegia.includes('Mosca a dicembre'), 'si vedono le ultime 24 ore, non la conversazione di tre giorni fa');
  verifica(await page.isVisible('.arch-nota button'), 'che sta nell\'archivio (un tocco la apre)');
  verifica((await page.textContent('#cModello span')) === 'Sonnet · Medio', 'Regia parte con Sonnet, sforzo medio');
  verifica(await page.isVisible('#cChips .chip'), 'idee pronte sopra la casella');
  await shot(page, 'regia');

  console.log('3. scrivo a Regia');
  await page.fill('#cInput', 'Trovami i voli per Mosca a dicembre');
  await page.click('#cSend');
  await aspettaInvio(page);
  verifica(ultimoDi(repo, 'regia') === 'Trovami i voli per Mosca a dicembre\n', 'il messaggio è un file in chat/regia (senza frontmatter)');
  verifica(repo.log[repo.log.length - 1] === 'messaggio da app: chat/regia', 'col commit che fa partire il turno di Regia');
  repo.runs = [runRegia];
  await sync();
  await page.waitForSelector('.pensiero');
  verifica((await page.textContent('.fase.ora')) === 'Al lavoro', 'le fasi del turno: al lavoro');
  verifica(await page.getAttribute('#cSend', 'aria-label') === 'Ferma Claude' && (await page.getAttribute('#cSend', 'class')).includes('stop'), 'mentre Claude lavora la freccia diventa «Ferma»');
  await shot(page, 'claude-lavora');

  console.log('4. «Ferma», come nell\'app di Claude');
  await page.click('#cSend');
  await sleep(600);
  verifica(repo.annullati.includes(1), 'il turno di Regia è annullato');
  // il workflow scrive «Fermato» e segna la richiesta come chiusa
  const fermata = diAndrea(repo, 'regia').pop().split('/').pop();
  scrivi(repo, { ['chat/regia/messaggi/' + nomeTra(1000, 'sistema')]: '---\ntipo: fermato\n---\nFermato.\n',
    'chat/regia/stato.json': JSON.stringify({ risposto_fino_a: fermata }) }, 'Claude risponde: regia');
  await sync();
  await page.waitForSelector('.fermato');
  verifica((await page.textContent('.fermato')).includes('Fermato da te') && !(await page.$('.pensiero')), 'una riga «Fermato da te», niente più attesa');

  console.log('5. Regia affida il lavoro a un agente: la scheda, e l\'agente nella tendina');
  await page.fill('#cInput', 'Riprova pure, con calma');
  await page.click('#cSend');
  await aspettaInvio(page);
  const compito = nomeTra(1500, 'andrea');
  rispondi(repo, 'regia', '---\nagenti: [agente-voli-per-mosca]\nproposte: Grazie | Fai presto\n---\nCi pensa l\'agente *Voli per Mosca*: ti scrive lì.\n', {
    'chat/agente-voli-per-mosca/chat.json': repo.putBlob(Buffer.from(JSON.stringify({ titolo: 'Voli per Mosca', descrizione: 'Voli Roma–Mosca a dicembre, sotto i 400 euro.', icona: '✈️', tipo: 'agente', repo: [], creata: oggiRoma(), da: 'regia' }, null, 2))),
    'chat/agente-voli-per-mosca/istruzioni.md': repo.putBlob(Buffer.from('# Voli per Mosca — istruzioni per l\'agente\n')),
    'chat/agente-voli-per-mosca/memoria.md': repo.putBlob(Buffer.from('# memoria\n')),
    ['chat/agente-voli-per-mosca/messaggi/' + compito]: repo.putBlob(Buffer.from('---\nda: regia\n---\nTrova i voli Roma–Mosca per dicembre, sotto i 400 euro.\n'))
  });
  repo.runs = [Object.assign({}, runRegia, { id: 2, status: 'in_progress', display_title: 'Claude · chat/agente-voli-per-mosca', created_at: isoTra(0) })];
  await sync();
  await page.waitForSelector('.mini.agente');
  verifica((await page.textContent('.mini.agente .mt')) === 'Agente · Voli per Mosca' && (await page.textContent('.mini.agente .ms')) === 'sta lavorando…', 'sotto la risposta la scheda dell\'agente: sta lavorando');
  verifica(await page.$$eval('.proposta', b => b.map(x => x.textContent).join('|')) === 'Grazie|Fai presto', 'e le risposte rapide');
  verifica(!(await page.$('.pensiero')), 'Regia intanto è libera (l\'agente lavora nel suo turno)');
  await shot(page, 'regia-agente');
  await page.click('#btnMenu');
  await page.waitForSelector('.sheet.drawer');
  const agenti = await page.$$eval('.dr-sec', s => s.map(x => x.textContent));
  verifica(agenti.join() === 'Chat,Agenti', 'nella tendina: Regia, le chat fisse, gli agenti');
  verifica((await page.textContent('.sheet.drawer .drchat:has-text("Voli per Mosca") small')) === 'sta lavorando…', 'l\'agente è nella tendina, con lo stato');
  verifica((await page.$$('.sheet.drawer #_nav .drchat')).length === 9, 'Regia, sette chat fisse e l\'agente');
  await shot(page, 'tendina');
  await page.click('.sheet.drawer .drriga:has-text("Regia") .espandi');
  // la prima riga di ogni conversazione arriva un attimo dopo (si legge il messaggio)
  await page.waitForSelector('.dr-arch:not(.hide) button:has-text("Che tempo fa a Mosca")', { timeout: 5000 }).catch(() => {});
  verifica((await page.textContent('.dr-arch:not(.hide)')).includes('Che tempo fa a Mosca'), 'il triangolino apre l\'archivio di quella chat');
  await shot(page, 'tendina-archivio');
  await page.click('.dr-arch:not(.hide) button:has-text("Che tempo fa")');
  await page.waitForSelector('.layer:not(.hide) .lbody .msg');
  verifica((await page.textContent('.layer:not(.hide) .lbody')).includes('Freddo: tra −5 e −10'), 'la conversazione passata si rilegge com\'era');
  await shot(page, 'conversazione-archivio');
  await page.click('.layer:not(.hide) .riprendi button');
  await sleep(600);
  verifica((await page.inputValue('#cInput')).startsWith('Riprendiamo la conversazione di'), '«Riprendi» torna in Regia con la frase pronta');
  await page.fill('#cInput', '');

  console.log('6. apro l\'agente dalla scheda; finisce; lo vedo');
  await page.click('.mini.agente');
  await page.waitForSelector('#cTesta:not(.hide)');
  verifica((await page.textContent('#cTitle')) === 'Voli per Mosca' && (await page.textContent('#cSub')).includes('sta lavorando'), 'in alto il nome dell\'agente e cosa sta facendo');
  verifica(await page.isHidden('#btnMenu') && await page.isVisible('#topbar #cRegia') && await page.isVisible('#uso') && await page.isVisible('#btnCal'), 'una riga sola in alto: indietro, il nome, l\'uso e il calendario');
  verifica((await page.textContent('.msg.andrea .inoltro')).includes('Affidato da Regia'), 'il compito, scritto da Regia a nome tuo');
  verifica((await page.textContent('#cModello span')) === 'Haiku · Extra', 'gli agenti partono con Haiku, sforzo extra');
  repo.runs[0].status = 'completed'; repo.runs[0].conclusion = 'success';
  const metaAg = json(repo.text('chat/agente-voli-per-mosca/chat.json'));
  rispondi(repo, 'agente-voli-per-mosca', '---\nfine: fatto\n---\nEcco i tre voli migliori: [confronto](file/voli.md).\n', {
    'chat/agente-voli-per-mosca/file/voli.md': repo.putBlob(Buffer.from('# Voli Roma–Mosca\n\n| Volo | Prezzo |\n|---|---|\n| Turkish via Istanbul | 320 € |\n')),
    'chat/agente-voli-per-mosca/chat.json': repo.putBlob(Buffer.from(JSON.stringify(Object.assign({}, metaAg, { finito: isoTra(0) }), null, 2)))
  });
  await sync();
  await page.waitForSelector('.msg.claude .who:has-text("Lavoro finito")');
  verifica(await page.isVisible('.mini.file') && (await page.textContent('.mini.file .mt')) === 'voli.md', 'il file prodotto ha la sua scheda');
  const visto = json(await aspettaFile(repo, 'chat/agente-voli-per-mosca/chat.json', t => /"visto"/.test(t)));
  verifica(!!visto.visto && visto.finito && new Date(visto.visto) >= new Date(visto.finito) && Object.keys(visto).join() === 'titolo,descrizione,icona,tipo,repo,creata,da,finito,visto',
    'aperto da finito: «visto» in chat.json, chiavi nell\'ordine di comune.py');
  await shot(page, 'agente-finito');
  await page.click('.mini.file');
  await page.waitForSelector('#viewer:not(.hide) #preview table');
  verifica((await page.textContent('#vSub')) === 'Voli per Mosca · lavoro di Claude', 'il file si apre nel lettore (niente percorsi del repo)');
  await page.click('#vBack'); await sleep(300);
  await page.click('#cRegia');
  await sleep(500);
  verifica(await page.isHidden('#cTesta') && (await page.textContent('.mini.agente .ms')) === 'ha finito ✓', 'tornato in Regia: la scheda dice che ha finito');

  console.log('7. cinque ore dopo averlo visto, l\'agente va in archivio');
  scrivi(repo, { 'chat/agente-voli-per-mosca/chat.json': JSON.stringify(Object.assign({}, visto, { finito: isoTra(-7 * 3600e3), visto: isoTra(-6 * 3600e3) }), null, 2) }, 'prova: sei ore dopo');
  await sync();
  await page.click('#btnMenu');
  await page.waitForSelector('.sheet.drawer');
  verifica(!(await page.$('.sheet.drawer #_nav .drchat:has-text("Voli per Mosca")')) && (await page.textContent('.sheet.drawer .dr-vuoto')).includes('Nessun agente'), 'non è più nella tendina');
  await page.click('#_ac');
  await page.waitForSelector('.layer:not(.hide) .conv');
  verifica((await page.textContent('.layer:not(.hide) .lbody')).includes('Agenti conclusi') && (await page.textContent('.layer:not(.hide) .lbody')).includes('Voli per Mosca'), 'è nell\'Archivio chat, tra gli agenti conclusi');
  await shot(page, 'archivio-chat');
  await page.goBack(); await sleep(400);
  await page.click('#btnMenu'); await page.click('#_al');
  await page.waitForSelector('.layer:not(.hide) .conv');
  verifica((await page.textContent('.layer:not(.hide) .lbody')).includes('voli.md') && (await page.textContent('.layer:not(.hide) .lbody')).includes('candidature.md'), 'e il suo lavoro resta nell\'Archivio lavoro, con quello delle altre chat');
  await shot(page, 'archivio-lavoro');
  await page.goBack(); await sleep(400);

  console.log('8. come su Telegram: un tocco sul messaggio apre il menu (👍 👎, copia, rigenera, cita…; nei miei copia e modifica)');
  // si tocca il testo, in alto a sinistra (non una scheda o un link)
  const menuDi = async sel => { await page.click(sel + ' .bubble', { position: { x: 14, y: 12 } }); await page.waitForSelector('.sheet .menu'); await sleep(300); };
  verifica(!(await page.$('.msg.claude:has-text("Ci pensa") ._cp, .acts')), 'sotto le risposte niente fila di bottoni');
  verifica(/^\d\d:\d\d$/.test(await page.textContent('.msg.claude:has-text("Ci pensa") .bubble .tm')), 'l\'ora sta dentro la nuvoletta');
  verifica(await page.$eval('.msg.andrea:has-text("Riprova pure") .tm svg use', u => u.getAttribute('href')) === '#i-check2', 'nei miei le due spunte: Claude ha risposto');
  await menuDi('.msg.claude:has-text("Ci pensa")');
  verifica(await page.isVisible('.sheet .reazioni #_su') && await page.isVisible('.sheet #_rg'), 'il menu: in cima 👍 👎, sotto copia, rigenera…');
  await shot(page, 'menu-messaggio');
  await page.click('.sheet #_cp');
  await sleep(400);
  verifica((await appunti()).startsWith('Ci pensa l\'agente *Voli per Mosca*'), 'copia: la risposta in markdown');
  await menuDi('.msg.claude:has-text("Ci pensa")');
  await page.click('.sheet #_su');
  const voti = json(await aspettaFile(repo, 'chat/regia/voti.json'));
  verifica(voti.voti.length === 1 && voti.voti[0].voto === 1 && voti.voti[0].estratto.startsWith('Ci pensa'), '👍 salvato in chat/regia/voti.json, con l\'estratto per Claude');
  await page.waitForSelector('.msg.claude:has-text("Ci pensa") .reaz');
  verifica((await page.textContent('.msg.claude:has-text("Ci pensa") .reaz')) === '👍', 'e il 👍 resta sulla nuvoletta, come una reazione');
  verifica(/^voti da app: chat\/regia$/.test(repo.log[repo.log.length - 1]), 'commit «voti da app» (non fa partire Claude)');
  await menuDi('.msg.claude:has-text("Ci pensa")');
  await page.click('.sheet #_rg');
  await aspettaInvio(page);
  verifica(/^---\nrifai: \d{8}-\d{6}-claude-[a-z0-9]{4}\.md\n---\nRifai la risposta\n$/.test(ultimoDi(repo, 'regia')), 'rigenera: un messaggio «rifai» che dice quale risposta');
  verifica(await page.isVisible('.msg.andrea .rigenera'), 'che in chat si vede come «Rifai la risposta»');
  await menuDi('.msg.andrea:has-text("Riprova pure")');
  await page.click('.sheet #_mo'); await sleep(400);
  verifica((await page.inputValue('#cInput')) === 'Riprova pure, con calma' && await page.isVisible('.cmodo.modifica'), 'modifica: il testo torna nella casella');
  await page.fill('#cInput', 'Riprova pure, ma entro stasera');
  await page.click('#cSend');
  await aspettaInvio(page);
  verifica(/^---\ncorregge: \d{8}-\d{6}-andrea-[a-z0-9]{4}\.md\n---\nRiprova pure, ma entro stasera\n$/.test(ultimoDi(repo, 'regia')), 'e parte come correzione del messaggio di prima');
  await menuDi('.msg.claude:has-text("Ci pensa")');
  verifica(await page.isVisible('.sheet #_vo') && await page.isVisible('.sheet #_qu') && await page.isVisible('.sheet #_sh'), 'e anche leggi ad alta voce, condividi, cita');
  await page.click('.sheet #_qu'); await sleep(400);
  verifica((await page.inputValue('#cInput')).startsWith('> Ci pensa l\'agente Voli per Mosca'), 'cita: la risposta citata nella casella');
  await page.fill('#cInput', '');
  rispondi(repo, 'regia', 'Fatto.\n');
  await sync();

  console.log('9. il «+»: ricerca approfondita e una foto; il modello e lo sforzo');
  await page.click('#cPiu');
  await page.waitForSelector('.sheet [data-modo="ricerca"]');
  await shot(page, 'piu');
  await page.click('.sheet [data-modo="ricerca"]');
  await sleep(400);
  verifica((await page.textContent('#cModi')).includes('Ricerca approfondita'), 'la ricerca accesa si vede sopra il testo');
  const png = path.join(require('os').tmpdir(), 'foto.png');
  fs.copyFileSync(path.join(APP, 'icon-192.png'), png);
  await page.click('#cPiu'); await page.waitForSelector('.sheet #_file');
  const [scelta] = await Promise.all([page.waitForEvent('filechooser'), page.click('.sheet #_file')]);
  await scelta.setFiles(png);
  await page.waitForSelector('#cAtts .patt img');
  await page.click('#cModello');
  await page.waitForSelector('.sheet .scelta-modello button');
  verifica((await page.$$('.sheet .scelta-modello button')).length === 5 && (await page.$$('.sheet #_sf button')).length === 6, 'cinque modelli e sei sforzi (con «Auto»)');
  await page.click('.sheet #_sf button:has-text("Alto")');
  await shot(page, 'modelli');
  await page.click('.sheet .scelta-modello button:has-text("Opus 5.5")');
  await sleep(400);
  verifica((await page.textContent('#cModello span')) === 'Opus · Alto' && (await page.getAttribute('#cModello', 'class')).includes('scelto'), 'la casella dice Opus · Alto');
  await page.fill('#cInput', 'Confronta i voli con il treno');
  const c0 = repo.log.length;
  await page.click('#cSend');
  await aspettaInvio(page);
  await sleep(500);
  verifica(/^---\nallegati: \[allegati\/[^\]]+foto\.png\]\nmodo: ricerca\nmodello: claude-opus-5-5\nsforzo: high\n---\nConfronta i voli con il treno\n$/.test(ultimoDi(repo, 'regia')), 'frontmatter: allegato, modo, modello, sforzo');
  verifica(repo.log.length === c0 + 1, 'un commit solo per messaggio e foto');
  verifica((await page.$$eval('#cmsgs .msg.andrea', els => (els.pop().querySelector('.tagmodello') || {}).textContent)) === 'Opus · Alto', 'sotto il messaggio: Opus · Alto');
  verifica(!(await page.textContent('#cModi')), 'dopo l\'invio la ricerca si spegne');
  await page.click('#cModello'); await page.click('.sheet #_def'); await sleep(400);
  verifica((await page.textContent('#cModello span')) === 'Sonnet · Medio', '«Come la chat» torna a Sonnet · Medio');
  rispondi(repo, 'regia', 'Il treno ci mette due giorni.\n');
  await sync();

  console.log('10. sicurezza: link pericolosi in un messaggio');
  rispondi(repo, 'regia', 'Prova [clic](javascript:alert(1)) e <img src=x onerror=alert(2)> e [attr](a"onmouseover="alert(3)) e ![i](javascript:alert(4)) e [ok](file/nota.md) e https://example.com/a?b=1&c=2.\n',
    { 'chat/regia/file/nota.md': repo.putBlob(Buffer.from('# Una nota\n\nScritta da Claude.\n\n```\nnon eseguire\n```\n')) });
  await sync();
  await page.waitForFunction(() => document.querySelector('#cmsgs').textContent.includes('Prova'), null, { timeout: 15000 });
  const hrefs = await page.$$eval('#cmsgs a', as => as.map(a => a.getAttribute('href')));
  verifica(!hrefs.some(h => /javascript:/i.test(h || '')), 'nessun href javascript:');
  verifica(await page.$$eval('#cmsgs [onerror], #cmsgs [onmouseover]', x => x.length) === 0, 'nessun attributo onerror/onmouseover');
  await page.click('#cmsgs a.repo:text("ok")');
  await page.waitForSelector('#viewer:not(.hide) #preview h1');
  verifica(await page.isVisible('#preview .code .cpy'), 'il link a un file si apre nel lettore, col codice copiabile');
  await page.click('#vBack'); await sleep(300);
  verifica(dialoghi === 0, 'nessun alert eseguito');

  console.log('11. offline: il messaggio resta in coda e parte dopo');
  repo.offline = true;
  await page.fill('#cInput', 'Scritto senza rete');
  await page.click('#cSend');
  await page.waitForSelector('.msg.fail', { timeout: 8000 });
  verifica(await page.isVisible('text=non inviato') && (await page.textContent('#app .gbanner')).includes('Offline'), 'bolla «non inviato» e avviso offline');
  await shot(page, 'offline');
  repo.offline = false;
  await page.click('.msg.fail ._re');
  await aspettaInvio(page);
  verifica(Object.keys(repo.files()).some(p => /-andrea-/.test(p) && repo.text(p) === 'Scritto senza rete\n'), 'tornata la rete, il messaggio è partito');

  console.log('12. errore di Claude → Riprova fa ripartire il turno di quella chat');
  scrivi(repo, { ['chat/regia/messaggi/' + nomeTra(9000, 'sistema')]: '---\ntipo: errore\n---\n⚠️ Per adesso hai finito l\'utilizzo di Claude.\n' }, 'Claude risponde: regia');
  await sync();
  await page.waitForSelector('.msg.sistema ._rip', { timeout: 15000 });
  await page.click('.msg.sistema ._rip');
  await sleep(800);
  verifica(repo.dispatches.length === 1 && repo.dispatches[0].inputs.chat === 'regia' && repo.dispatches[0].inputs.modo === 'risposte', 'Riprova: workflow con chat=regia');
  rispondi(repo, 'regia', 'Eccomi.\n');
  await sync();

  console.log('13. una chat fissa: Russo, col suo modello, e indietro a Regia');
  await page.click('#btnMenu'); await page.click('.sheet.drawer .drchat:has-text("Russo")');
  await page.waitForSelector('#cTesta:not(.hide)');
  verifica((await page.textContent('#cTitle')) === 'Russo' && (await page.getAttribute('#cInput', 'placeholder')).includes('Russo'), 'si apre Russo, col nome in alto');
  verifica((await page.textContent('#cModello span')) === 'Haiku · Extra', 'le chat fisse partono con Haiku, sforzo extra');
  await page.fill('#cInput', 'Come si dice «buongiorno»?');
  await page.click('#cSend');
  await aspettaInvio(page);
  verifica(diAndrea(repo, 'russo').length === 1 && repo.log[repo.log.length - 1] === 'messaggio da app: chat/russo', 'il messaggio va in Russo (e fa partire il turno di Russo)');
  await page.click('#cInfo');
  await page.waitForSelector('.sheet #_mdl');
  verifica(await page.isVisible('.sheet #_ist') && await page.isVisible('.sheet #_mem') && await page.isVisible('.sheet #_arc2'), 'il menu della chat: istruzioni, memoria, archivio…');
  await shot(page, 'menu-chat');
  await page.click('.sheet #_mdl');
  await page.click('.sheet .scelta-modello button:has-text("Sonnet 5.5")'); await sleep(1500);
  verifica(json(repo.text('chat/russo/chat.json')).modello === 'claude-sonnet-5-5', 'il modello della chat in chat.json');
  await page.goBack(); await sleep(500);
  verifica(await page.isHidden('#cTesta'), 'indietro torna a Regia');
  await page.click('#btnMenu'); await page.click('.sheet.drawer .drchat:has-text("Russo")'); await page.waitForSelector('#cTesta:not(.hide)');
  await sleep(400);
  await trascina(8, 420, 300, 430); await sleep(500);
  verifica(await page.isHidden('#cTesta'), 'anche col dito dal bordo sinistro');
  await trascina(8, 420, 300, 430); await sleep(600);
  verifica(await page.isVisible('.sheet.drawer'), 'in Regia, lo stesso gesto apre la tendina');
  await page.goBack(); await sleep(400);

  console.log('14. il canale delle News: un post per notizia, 👍 e 👎');
  await page.click('#btnMenu'); await page.click('.sheet.drawer .drchat:has-text("News")');
  await page.waitForSelector('.post');
  verifica((await page.$$('.post')).length === 2 && (await page.textContent('.post .md strong')) === 'La BCE lascia i tassi fermi', 'le notizie sono post a sé');
  await page.click('.post:has-text("Istat") ._gi');
  const vn = json(await aspettaFile(repo, 'chat/notizie/voti.json') || '{"voti":[]}');
  verifica(vn.voti.length === 1 && vn.voti[0].voto === -1 && vn.voti[0].estratto.includes('Istat'), '👎 salvato nei voti delle News (così impara cosa ti piace)');
  await page.click('.post:has-text("BCE") ._ap');
  verifica((await page.inputValue('#cInput')).startsWith('Approfondisci: «La BCE lascia i tassi fermi»'), '«Approfondisci» prepara la domanda');
  await page.fill('#cInput', '');
  await shot(page, 'news');
  await page.goBack(); await sleep(400);

  console.log('15. il calendario: solo il mese e il giorno scelto; si può togliere una voce');
  const ag = JSON.parse(repo.text('agenda/agenda.json'));
  ag.eventi.push({ id: 'e-dentista1', titolo: 'Dentista', data: oggiRoma(1), ora: '15:00', ora_fine: '16:00', luogo: 'Via Roma 3', creato_da: 'claude' });
  ag.eventi.push({ id: 'e-palestra', titolo: 'Palestra', data: oggiRoma(1), ora: '18:00', ripeti: { ogni: 'settimana' } });
  ag.eventi.push({ id: 'e-cena', titolo: 'Cena da Marco', data: oggiRoma(2), ora: '20:30' });
  ag.compiti.push({ id: 'c-senzadata', titolo: 'Rinnovare il passaporto', priorita: 'normale' });
  ag.compiti.push({ id: 'c-ritardo', titolo: 'Pagare la bolletta', scadenza: oggiRoma(-3), priorita: 'normale' });
  const ser = d => '{\n  "versione": 1,\n  "fuso": "Europe/Rome",\n  "eventi": [\n' + d.eventi.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ],\n  "compiti": [\n' + d.compiti.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ]\n}\n';
  scrivi(repo, { 'agenda/agenda.json': ser(ag) }, 'Claude risponde: regia');
  await sync();
  await page.click('#btnCal');
  await page.waitForSelector('#calview:not(.hide) .griglia');
  // un giorno nella griglia (se è in un altro mese, prima ci si va con le frecce)
  const giorno = async g => {
    if (!(await page.$('.cella[data-g="' + g + '"]'))) await page.click(g < oggiRoma() ? '#calPrima' : '#calDopo');
    await page.click('.cella[data-g="' + g + '"]');
    await page.waitForSelector('.cella.sel[data-g="' + g + '"]');
  };
  const mese = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }).format(new Date());
  verifica((await page.textContent('#calMese')).toLowerCase() === mese && await page.isHidden('#calOggi'), 'in alto il mese (e niente «Oggi»: si è già su oggi)');
  const cal = await page.textContent('#calBody');
  verifica(!/Rinnovare il passaporto|Pagare la bolletta|In ritardo|senza data|Chiedi/.test(cal) && (await page.$$('#calBody .day')).length === 1, 'solo il calendario: niente liste di cose da fare, niente note');
  verifica(!(await page.$('#calview input, #calview .fab, #fab')), 'niente moduli né «+»: per aggiungere si chiede a Regia');
  await giorno(oggiRoma(1));
  verifica((await page.textContent('#calBody .day')).includes('Dentista') && (await page.textContent('#calBody .day')).includes('Palestra') && await page.isVisible('#calOggi'), 'un tocco su un giorno: i suoi impegni (e torna «Oggi»)');
  await shot(page, 'calendario');
  await page.click('.ev:has-text("Dentista")');
  await page.waitForSelector('.sheet #_del');
  verifica(!(await page.$('.sheet input')) && (await page.textContent('.sheet #_q')).includes('15:00–16:00'), 'la scheda si legge, non si modifica');
  await page.click('.sheet #_del');
  await page.waitForSelector('#_si');
  await page.click('#_si');
  await sleep(2500);
  verifica(!JSON.parse(repo.text('agenda/agenda.json')).eventi.some(e => e.id === 'e-dentista1') && /^agenda da app: elimina «Dentista»/.test(repo.log[repo.log.length - 1]), 'eliminato dal calendario');
  await page.click('.ev:has-text("Palestra")');
  await page.waitForSelector('.sheet #_del');
  await page.click('.sheet #_del');
  await page.waitForSelector('#_alt');
  await page.click('#_alt');
  await sleep(2500);
  verifica((JSON.parse(repo.text('agenda/agenda.json')).eventi.find(e => e.id === 'e-palestra').ripeti.salta || []).length === 1, 'un evento ripetuto: «solo questa volta»');
  await giorno(oggiRoma(2));
  await page.click('.ev:has-text("Call con Luca")');
  await page.waitForSelector('.sheet #_gc');
  verifica(!(await page.$('.sheet #_del')), 'un evento di Google Calendar si guarda soltanto');
  await page.click('.sheet #_ch'); await sleep(300);
  await giorno(oggiRoma(-3));
  verifica((await page.textContent('#calBody .day')).includes('Pagare la bolletta') && (await page.textContent('#calBody .day .tag')) === 'scaduto', 'una cosa da fare sta nel suo giorno');
  await page.click('#calOggi');
  verifica(await page.isHidden('#calOggi') && (await page.getAttribute('.cella.sel', 'data-g')) === oggiRoma(), '«Oggi» torna a oggi');
  await giorno(oggiRoma(2));
  await page.click('.ev:has-text("Cena da Marco")');
  await page.click('.sheet #_ask');
  await sleep(700);
  verifica(await page.isHidden('#calview') && (await page.inputValue('#cInput')).startsWith('A proposito di «Cena da Marco»'), '«Chiedi a Regia» apre Regia con la frase pronta');
  await page.fill('#cInput', '');

  console.log('16. impostazioni: semplici davanti, GitHub nascosto in «Avanzate»');
  await page.click('#btnMenu'); await page.click('#_imp');
  await page.waitForSelector('.layer:not(.hide) #_mr');
  verifica(await page.isHidden('.layer:not(.hide) #_tok'), 'il codice di accesso non si vede finché non apri «Avanzate»');
  verifica((await page.textContent('.layer:not(.hide) #_mr > small')) === 'Sonnet 5.5 · Medio' && (await page.textContent('.layer:not(.hide) #_ma > small')) === 'Haiku 5.5 · Extra', 'i modelli di partenza: Regia Sonnet medio, le altre Haiku extra');
  await shot(page, 'impostazioni');
  await page.click('.layer:not(.hide) #_ma');
  await page.click('.sheet #_sf button:has-text("Alto")'); await sleep(1500);
  verifica(json(repo.text('impostazioni.json')).sforzo_altre === 'high', 'lo sforzo delle altre chat in impostazioni.json');
  await page.click('.sheet .scelta-modello button:has-text("Haiku 5.5")'); await sleep(1500);
  await page.click('.layer:not(.hide) #_prom'); await sleep(1500);
  verifica(json(repo.text('impostazioni.json')).promemoria === false && json(repo.text('impostazioni.json')).sforzo_altre === 'high', 'promemoria spenti (e il resto resta)');
  await page.click('.layer:not(.hide) #_noti');
  await sleep(2000);
  const isc = json(repo.text('notifiche/iscrizioni.json') || '{}');
  verifica(isc.vapid && /^[A-Za-z0-9_-]{87}$/.test(isc.vapid.pubblica) && /^[A-Za-z0-9_-]{43}$/.test(isc.vapid.privata), 'le notifiche: l\'app crea le chiavi VAPID (P-256)');
  verifica(isc.iscrizioni.length === 1 && isc.iscrizioni[0].endpoint === 'https://push.example.com/telefono-1' && isc.iscrizioni[0].auth === 'segreto-auth', 'e iscrive il telefono');
  verifica(await page.evaluate(() => window.__chiaveApp && window.__chiaveApp.length === 65), 'con la chiave pubblica giusta');
  await page.click('.layer:not(.hide) #_prova'); await sleep(300);
  const notifiche = await page.evaluate(() => [window.__notifiche || [], Notification.permission, 'PushManager' in window]);
  verifica(notifiche[0].length === 1, '«Prova una notifica» ne mostra una ' + JSON.stringify(notifiche));
  await page.click('.layer:not(.hide) #_n_canale'); await sleep(1500);
  verifica(json(repo.text('impostazioni.json')).notifiche.canale === false, 'le News senza notifiche');
  await page.click('.layer:not(.hide) .come summary');
  verifica(await page.isVisible('.layer:not(.hide) #_tok'), '«Avanzate» apre il codice di accesso');
  await page.click('.layer:not(.hide) #_tema [data-v="scuro"]');
  verifica(await page.getAttribute('html', 'data-tema') === 'scuro', 'tema scuro scelto a mano');
  await page.click('.layer:not(.hide) #_tema [data-v="auto"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.layer:not(.hide) #_ics')]);
  verifica(dl.suggestedFilename() === 'regia-agenda.ics', 'esporta il calendario in .ics');
  await page.click('.layer:not(.hide) #_c_mcp');
  await page.waitForSelector('.sheet #_ok');
  verifica((await page.textContent('.sheet')).includes('non arrivano qui'), 'i connettori: dice onestamente cosa c\'è e cosa no');
  await page.click('.sheet #_ok'); await sleep(300);
  await page.click('.layer:not(.hide) #_check');
  await page.waitForSelector('.sheet .checks li:nth-child(5)', { timeout: 10000 });
  verifica((await page.textContent('.sheet .checks')).includes('Notifiche: 1 telefono iscritto'), 'il controllo della configurazione');
  await page.goBack(); await sleep(300);
  await page.goBack(); await sleep(400);

  console.log('17. uso di Claude: il pannello');
  await page.click('#uso');
  await page.waitForSelector('.sheet .misura');
  verifica((await page.$$('.sheet .misura')).length === 2 && (await page.$$('.sheet .misura.attenzione')).length === 1, 'due limiti, la settimana in arancione');
  verifica((await page.textContent('.sheet .misura.attenzione .pct')) === '24%resta', 'anche qui quanto resta');
  verifica((await page.textContent('#_tiles .tile:first-child .tv')) === '3', 'oggi: 3 turni');
  await shot(page, 'uso');
  await page.goBack(); await sleep(300);
  verifica((repo.nonCambiati || 0) > 0, 'mentre aspetta Claude, GitHub risponde «niente di nuovo» (304, con l\'ETag): si guarda spesso senza consumare');
  // la sessione di 5 ore si è azzerata e Claude non ha ancora fatto un turno: è di nuovo piena
  const usoOra = JSON.parse(repo.text('uso/uso.json'));
  usoOra.limiti.five_hour.azzera = isoTra(-60e3);
  scrivi(repo, { 'uso/uso.json': JSON.stringify(usoOra) }, 'turno: uso');
  await sync(); await sleep(400);
  verifica(await page.textContent('#ub5 b') === '100%' && await page.textContent('#ub7 b') === '24%', 'una finestra azzerata torna piena (100%), l\'altra resta com\'era');

  console.log('18. ricerca nei messaggi');
  await page.click('#btnMenu');
  await page.fill('#_q', 'freddo gradi');
  await page.waitForSelector('#_ris .ris', { timeout: 8000 });
  await page.click('#_ris .ris');
  await page.waitForSelector('.layer:not(.hide) .msg.lampeggia', { timeout: 8000 });
  verifica((await page.textContent('.layer:not(.hide) .msg.lampeggia')).includes('Freddo'), 'un messaggio vecchio si apre nel suo giorno d\'archivio');
  await page.goBack(); await sleep(400);

  console.log('19. dalla notifica: si apre la chat giusta; ricaricando si riparte da Regia');
  await page.goto('https://regia.test/?app&chat=russo');
  await page.waitForSelector('#cTesta:not(.hide)', { timeout: 8000 });
  verifica((await page.textContent('#cTitle')) === 'Russo', '?chat=russo apre Russo');
  await page.goBack(); await sleep(500);
  verifica(await page.isHidden('#cTesta'), 'e indietro c\'è Regia');
  await page.reload();
  await page.waitForSelector('#cmsgs .msg');
  verifica(await page.isHidden('#cTesta') && page.url().startsWith('https://regia.test'), 'ricaricando: Regia');

  console.log('20. tema scuro');
  await page.emulateMedia({ colorScheme: 'dark' });
  await sleep(300);
  await shot(page, 'scuro-regia');
  await page.click('#btnMenu'); await sleep(400);
  await shot(page, 'scuro-tendina');
  await page.click('.sheet.drawer .drchat:has-text("News")'); await sleep(700);
  await shot(page, 'scuro-news');
  await page.goBack(); await sleep(400);
  await page.click('#btnCal'); await sleep(600);
  await shot(page, 'scuro-calendario');
  await page.click('#calBack'); await sleep(300);
  await page.click('#btnMenu'); await page.click('#_imp'); await sleep(600);
  await shot(page, 'scuro-impostazioni');
  await page.goBack(); await sleep(300);

  verifica(errori.length === 0, 'nessun errore in console' + (errori.length ? ': ' + errori.join(' | ') : ''));
  await browser.close();
  console.log(ok ? '\nTUTTO OK' : '\nQUALCOSA NON VA');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
