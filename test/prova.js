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
async function shot(page, nome) { n++; await sleep(350); await page.screenshot({ path: path.join(SHOTS, String(n).padStart(2, '0') + '-' + nome + '.png') }); }
// i messaggi di Andrea nel repo, dal più vecchio
function diAndrea(repo, chat) { return Object.keys(repo.files()).filter(p => new RegExp('^chat/' + chat + '/messaggi/.*-andrea-').test(p)).sort(); }
// Claude risponde (simulato): un messaggio suo, e la chat segnata come risposta
function rispondi(repo, chat, testo, extra) {
  const f = Object.assign({}, repo.files());
  const fino = diAndrea(repo, chat).pop();
  f['chat/' + chat + '/messaggi/' + stampa(new Date(Date.now() + 2000)) + '-claude-' + Math.random().toString(36).slice(2, 6) + '.md'] = repo.putBlob(Buffer.from(testo));
  if (fino) f['chat/' + chat + '/stato.json'] = repo.putBlob(Buffer.from(JSON.stringify({ risposto_fino_a: fino.split('/').pop(), run: 'x' })));
  Object.assign(f, extra || {});
  repo.commit(f, 'Claude risponde: ' + chat);
}

(async () => {
  const browser = await chromium.launch();
  const repo = new Repo(DATI);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await servi(context, repo);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://regia.test' });
  const page = await context.newPage();
  // tocchi veri (col dito): per il gesto dal bordo e per «tira giù per aggiornare»
  const cdp = await context.newCDPSession(page);
  async function trascina(x0, y0, x1, y1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 10, y: y0 + (y1 - y0) * i / 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  let letture = 0;
  page.on('request', r => { if (/\/git\/ref\/heads\/main$/.test(r.url())) letture++; });
  const appunti = () => page.evaluate(() => navigator.clipboard.readText());
  const errori = [];
  page.on('pageerror', e => errori.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) errori.push('console: ' + m.text()); });
  let dialoghi = 0;
  page.on('dialog', d => { dialoghi++; d.dismiss(); });

  // quello che scrive il workflow: l'uso di Claude (14 giorni di turni) e Google Calendar
  const isoTra = ms => new Date(Date.now() + ms).toISOString();
  const turni = [];
  for (let k = 13; k >= 0; k--) {
    const quanti = k === 0 ? 3 : (k * 7) % 4;
    for (let j = 0; j < quanti; j++) {
      const opus = (k + j) % 3 === 0;
      turni.push({ quando: isoTra(-k * 864e5 - j * 3600e3 - 60e3), esito: 'ok', modello: opus ? 'claude-opus-5-5' : 'claude-sonnet-5-5', chat: [k % 2 ? 'generale' : 'notizie'],
        routine: 0, secondi: 40 + k * 9, passi: 6, costo_usd: opus ? 0.42 : 0.11,
        token: { input: 1200, output: 900 + k * 120, cache_letti: 30000 + k * 4000, cache_scritti: 5000 },
        modelli: opus ? { 'claude-opus-5-5': { token_out: 900, token_in: 36000, costo_usd: 0.42 } } : { 'claude-sonnet-5-5': { token_out: 900, token_in: 36000, costo_usd: 0.11 } } });
    }
  }
  repo.write('uso/uso.json', JSON.stringify({ versione: 1, aggiornato: isoTra(-20 * 60e3),
    limiti: { five_hour: { percento: 42, stato: 'allowed', azzera: isoTra(2 * 3600e3), visto: isoTra(-20 * 60e3) },
              seven_day: { percento: 76, stato: 'allowed_warning', azzera: isoTra(3 * 864e5), visto: isoTra(-20 * 60e3) } }, turni }, null, 1), 'turno: uso');
  repo.write('agenda/google.json', JSON.stringify({ versione: 1, aggiornato: isoTra(-30 * 60e3), calendari: ['Personale'],
    eventi: [{ id: 'g-1a2b3c4d5e', titolo: 'Call con Luca', data: oggiRoma(9), ora: '10:00', ora_fine: '10:30', luogo: 'Meet', fonte: 'google', calendario: 'Personale' }] }), 'calendario google');

  console.log('1. primo avvio senza token');
  await page.goto('https://regia.test/');
  await page.waitForSelector('.welcome');
  verifica((await page.textContent('#hSaluto')) === 'Benvenuto in Regia', 'schermata di benvenuto');
  verifica(await page.isHidden('#dock'), 'senza token niente casella in basso');
  await shot(page, 'benvenuto');

  console.log('2. impostazioni: token salvato → pagina di partenza');
  await page.click('#_imp');
  await page.fill('#_tok', 'tok-finto');
  await shot(page, 'impostazioni');
  await page.click('#_salva');
  await page.waitForSelector('.chatcard');
  const titoli = await page.$$eval('.cc-t', els => els.map(e => e.textContent));
  verifica(titoli[0] === 'Generale' && titoli.length === 8, 'Generale in cima, poi le altre aree: ' + titoli.join(', '));
  verifica(await page.isVisible('.aree .chatcard.area.larga.gen') && (await page.$$('.aree .chatcard.area')).length === 8, 'le aree in una griglia di tessere');
  verifica((await page.textContent('.chatcard.area:has-text("Notizie") .rt-a')).includes('Rassegna del mattino'), 'sulla tessera la prossima routine');
  verifica(await page.isVisible('#uso') && (await page.textContent('#usoNum')) === '42', 'l\'uso di Claude sempre in vista: 42%');
  verifica(await page.getAttribute('#uso', 'class') === 'uso avviso', 'l\'arco è tranquillo (42%) ma il pallino avvisa: la settimana è al 76%');
  verifica(/^(Buongiorno|Buon pomeriggio|Buonasera|Ciao), Andrea$/.test(await page.textContent('#hSaluto')), 'saluto: ' + await page.textContent('#hSaluto'));
  verifica(await page.isVisible('.card.oggi'), 'la giornata in breve');
  verifica(await page.textContent('.chatcard.gen .badge') === '1', 'un messaggio non letto (il benvenuto)');
  verifica(await page.isVisible('#ptMenu'), 'il pallino sul menu dice che c\'è da leggere');
  verifica(await page.isVisible('#dock #hInput') && await page.isVisible('#hChips .chip'), 'casella e idee in basso');
  await shot(page, 'partenza');

  console.log('3. apro Generale');
  await page.click('.chatcard.gen');
  await page.waitForSelector('#cmsgs .msg.claude');
  verifica((await page.textContent('#cmsgs')).includes('Questa è **Regia**'.replace(/\*/g, '')) || (await page.textContent('#cmsgs')).includes('Regia'), 'messaggio di benvenuto visibile');
  verifica(await page.isVisible('.mini.compito'), 'scheda del compito sotto il messaggio');
  verifica(await page.isVisible('#cChips .chip'), 'suggerimenti sopra la casella');
  verifica(await page.isVisible('.msg.claude .acts ._cp'), 'sotto la risposta: copia, leggi, condividi, cita');
  verifica(await page.isVisible('#uso'), 'l\'anello dell\'uso c\'è anche nella chat');
  await shot(page, 'generale');

  console.log('4. scrivo e mando un messaggio');
  await page.fill('#cInput', 'Ricordami il dentista martedì alle 15');
  await page.click('#cSend');
  await page.waitForFunction(() => !document.querySelector('#cmsgs .msg.out'), null, { timeout: 15000 });
  const inviati = diAndrea(repo, 'generale');
  verifica(inviati.length === 1, 'il messaggio è un file nel repo: ' + inviati[0]);
  verifica(repo.text(inviati[0]) === 'Ricordami il dentista martedì alle 15\n', 'contenuto giusto (senza frontmatter)');
  verifica(repo.log[repo.log.length - 1] === 'messaggio da app: chat/generale', 'messaggio di commit giusto');
  // il workflow parte, ed è al passo «Turno di Claude»
  repo.runs = [{ id: 1, status: 'in_progress', conclusion: null, html_url: 'https://github.com/x/runs/1', created_at: new Date().toISOString(), run_started_at: new Date().toISOString(), event: 'push',
    steps: [{ name: 'Set up job', status: 'completed' }, { name: 'Installa Claude Code', status: 'completed' }, { name: 'Turno di Claude', status: 'in_progress' }, { name: 'Salva su GitHub', status: 'queued' }] }];
  await page.click('#cBack'); await page.click('#btnRefresh'); await sleep(800);
  verifica((await page.textContent('#hAttivita')).includes('Claude sta lavorando'), 'la pagina di partenza dice che Claude lavora');
  verifica(!(await page.$('.chatcard.gen .badge')), 'letto il benvenuto, la tessera di Generale non ha più il numero');
  verifica((await page.textContent('.chatcard.gen .stato-a')).includes('Claude sta lavorando'), 'e dice che Claude ci sta lavorando');
  await page.click('.chatcard.gen');
  await page.waitForSelector('.pensiero');
  verifica((await page.textContent('#cSub')).includes('Claude sta lavorando'), 'sottotitolo: Claude sta lavorando');
  verifica((await page.textContent('.fase.ora')) === 'Al lavoro' && (await page.$$('.fase.fatta')).length === 2, 'fasi del turno: in coda e preparo fatte, al lavoro adesso');
  const t1 = await page.textContent('.pensiero .timer'); await sleep(2100);
  verifica(t1 !== await page.textContent('.pensiero .timer'), 'il contatore va avanti da solo');
  await shot(page, 'claude-lavora');

  console.log('5. Claude risponde (simulato), mette in agenda e propone risposte rapide');
  const ag = JSON.parse(repo.text('agenda/agenda.json'));
  const martedi = (() => { for (let k = 1; k < 8; k++) { const g = oggiRoma(k); if (new Date(g + 'T12:00:00Z').getUTCDay() === 2) return g; } })();
  ag.eventi.push({ id: 'e-dentista1', titolo: 'Dentista', data: martedi, ora: '15:00', ora_fine: '16:00', luogo: 'Via Roma 3', creato_da: 'claude' });
  const ser = d => '{\n  "versione": 1,\n  "fuso": "Europe/Rome",\n  "eventi": [\n' + d.eventi.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ],\n  "compiti": [\n' + d.compiti.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ]\n}\n';
  rispondi(repo, 'generale', '---\neventi: [e-dentista1]\nproposte: Sì, il giorno prima | No grazie\n---\n📅 Messo in agenda: **dentista**, martedì alle 15.\n\n```bash\necho promemoria\n```\n\nVuoi un promemoria il giorno prima?\n',
    { 'agenda/agenda.json': repo.putBlob(Buffer.from(ser(ag))) });
  repo.runs[0].status = 'completed'; repo.runs[0].conclusion = 'success';
  await page.waitForSelector('.mini:not(.compito)', { timeout: 15000 });
  verifica(!(await page.isVisible('.pensiero')), 'niente più «sta lavorando»');
  verifica((await page.textContent('.mini:not(.compito) .mt')) === 'Dentista', 'scheda dell\'evento nella risposta');
  verifica(await page.$$eval('.proposta', b => b.map(x => x.textContent).join('|')) === 'Sì, il giorno prima|No grazie', 'le risposte rapide sotto la risposta');
  verifica(await page.isVisible('.msg.claude.nuovo'), 'la risposta nuova entra con l\'animazione');
  verifica((await page.textContent('.code .code-h span')) === 'bash' && await page.isVisible('.code .cpy'), 'blocco di codice con la lingua e «Copia»');
  await shot(page, 'risposta');
  await page.click('.mini:not(.compito)');
  await page.waitForSelector('.sheet #_t');
  verifica(await page.inputValue('.sheet #_t') === 'Dentista', 'la scheda apre l\'evento');
  verifica((await page.getAttribute('#_gc', 'href')).includes('calendar.google.com'), 'link a Google Calendar');
  await shot(page, 'evento');
  await page.click('.sheet #_an'); await sleep(300);

  console.log('5b. una risposta rapida parte con un tocco');
  await page.click('.proposta:has-text("No grazie")');
  await page.waitForFunction(() => !document.querySelector('#cmsgs .msg.out'), null, { timeout: 15000 });
  verifica(repo.text(diAndrea(repo, 'generale').pop()) === 'No grazie\n', 'mandata come messaggio di Andrea');
  verifica((await page.$$('.proposta')).length === 0, 'e le proposte spariscono');

  console.log('5c. sotto la risposta: copia, cita, leggi; e il codice si copia');
  await page.click('.msg.claude:has-text("Messo in agenda") ._cp');
  await sleep(200);
  verifica((await appunti()).startsWith('📅 Messo in agenda: **dentista**'), 'copia: il testo della risposta (in markdown)');
  await page.click('.msg.claude:has-text("Messo in agenda") .code .cpy');
  await sleep(200);
  verifica((await appunti()) === 'echo promemoria', 'copia del blocco di codice');
  await page.click('.msg.claude:has-text("Messo in agenda") ._qu');
  verifica((await page.inputValue('#cInput')).startsWith('> 📅 Messo in agenda: dentista'), 'cita: la risposta citata nella casella');
  await page.fill('#cInput', '');
  await page.click('.msg.claude:has-text("Messo in agenda") ._vo');
  await sleep(300);
  verifica(true, 'leggi ad alta voce: nessun errore');

  console.log('6. sicurezza: link pericolosi in un messaggio');
  rispondi(repo, 'generale', 'Prova [clic](javascript:alert(1)) e <img src=x onerror=alert(2)> e [attr](a"onmouseover="alert(3)) e ![i](javascript:alert(4)) e [ok](file/nota.md) e https://example.com/a?b=1&c=2.\n',
    { 'chat/generale/file/nota.md': repo.putBlob(Buffer.from('# Una nota\n\nScritta da Claude.\n\n```\nnon eseguire\n```\n')) });
  await page.waitForFunction(() => document.querySelector('#cmsgs').textContent.includes('Prova'), null, { timeout: 30000 });
  const hrefs = await page.$$eval('#cmsgs a', as => as.map(a => a.getAttribute('href')));
  verifica(!hrefs.some(h => /javascript:/i.test(h || '')), 'nessun href javascript:');
  verifica(await page.$$eval('#cmsgs [onerror], #cmsgs [onmouseover]', x => x.length) === 0, 'nessun attributo onerror/onmouseover');
  await page.click('#cmsgs a.repo:text("ok")');
  await page.waitForSelector('#viewer:not(.hide) #preview h1');
  verifica((await page.textContent('#preview h1')) === 'Una nota', 'il link a un file della chat si apre nel lettore');
  verifica(await page.isVisible('#preview .code .cpy'), 'anche nel lettore il codice ha «Copia»');
  await page.click('#vBack'); await sleep(300);
  verifica(dialoghi === 0, 'nessun alert eseguito');

  console.log('7. istruzioni della chat: modifica e salvataggio');
  await page.click('#cMenu'); await page.click('#_ist');
  await page.waitForSelector('#preview h1');
  await page.click('#vEdit');
  await page.fill('#editor', (await page.inputValue('#editor')).replace('*(ancora nessuna)*', '- Risposte brevi.'));
  await page.click('#vSave');
  await page.waitForFunction(() => document.querySelector('#vSave').disabled, null, { timeout: 8000 });
  await sleep(500);
  verifica((repo.text('chat/generale/istruzioni.md') || '').includes('- Risposte brevi.'), 'istruzioni salvate nel repo');
  verifica(repo.log[repo.log.length - 1] === 'modifica da app: chat/generale/istruzioni.md', 'commit «modifica da app»');
  await page.click('#vBack'); await sleep(300);

  console.log('8. allegato (foto) + modo «ragiona» + messaggio in un commit solo');
  const png = path.join(require('os').tmpdir(), 'foto.png');
  fs.copyFileSync(path.join(APP, 'icon-192.png'), png);
  const [scelta] = await Promise.all([page.waitForEvent('filechooser'), page.click('#cAttach')]);
  await scelta.setFiles(png);
  await page.waitForSelector('#cAtts .patt');
  await page.click('#cComp .modo[data-modo="pensa"]');
  verifica(await page.getAttribute('#cComp .modo[data-modo="pensa"]', 'aria-pressed') === 'true', 'il modo «Ragiona» si accende');
  await page.fill('#cInput', 'Ecco la foto dello scontrino');
  const commitPrima = repo.log.length;
  await page.click('#cSend');
  await page.waitForFunction(() => !document.querySelector('#cmsgs .msg.out'), null, { timeout: 15000 });
  await sleep(600);
  const allegati = Object.keys(repo.files()).filter(p => p.startsWith('chat/generale/allegati/'));
  verifica(allegati.length === 1 && allegati[0].endsWith('foto.png'), 'allegato nel repo: ' + allegati[0]);
  verifica(repo.log.length === commitPrima + 1, 'un commit solo per messaggio + allegato');
  const ultimoMsg = diAndrea(repo, 'generale').pop();
  verifica(/^---\nallegati: \[allegati\/[^\]]+foto\.png\]\nmodo: pensa\n---\nEcco la foto/.test(repo.text(ultimoMsg)), 'frontmatter con allegato e modo');
  verifica(await page.getAttribute('#cComp .modo[data-modo="pensa"]', 'aria-pressed') === 'false', 'dopo l\'invio il modo si spegne');
  await page.waitForSelector('.att.img img[src^="data:image"]', { timeout: 8000 });
  verifica((await page.$$eval('#cmsgs .msg.andrea', els => (els.pop().querySelector('.tagmodo') || {}).textContent)) === 'Ragiona a fondo', 'sotto il messaggio: «Ragiona a fondo»');
  await shot(page, 'allegato');

  console.log('9. offline: il messaggio resta in coda e parte dopo');
  repo.offline = true;
  await page.fill('#cInput', 'Scritto senza rete');
  await page.click('#cSend');
  await page.waitForSelector('.msg.fail', { timeout: 8000 });
  verifica(await page.isVisible('text=non inviato'), 'bolla «non inviato»');
  verifica((await page.textContent('#chatview .cbanner')).includes('Offline'), 'avviso offline anche dentro la chat');
  await shot(page, 'offline');
  repo.offline = false;
  await page.click('.msg.fail ._re');
  await page.waitForFunction(() => !document.querySelector('#cmsgs .msg.out'), null, { timeout: 15000 });
  verifica(Object.keys(repo.files()).some(p => /-andrea-/.test(p) && repo.text(p) === 'Scritto senza rete\n'), 'tornata la rete, il messaggio è partito');

  console.log('10. errore di Claude → Riprova');
  const f3 = Object.assign({}, repo.files());
  f3['chat/generale/messaggi/' + stampa(new Date(Date.now() + 9000)) + '-sistema-er01.md'] = repo.putBlob(Buffer.from('---\ntipo: errore\n---\n⚠️ Per adesso hai finito l\'utilizzo di Claude.\n'));
  repo.commit(f3, 'Claude risponde: generale');
  await page.waitForSelector('.msg.sistema ._rip', { timeout: 30000 });
  await page.click('.msg.sistema ._rip');
  await sleep(800);
  verifica(repo.dispatches.length === 1 && repo.dispatches[0].inputs.modo === 'risposte', 'Riprova fa ripartire il workflow');
  await shot(page, 'errore');
  await page.click('#cBack'); await sleep(300);

  console.log('11. agenda: prossimi, mese, da fare');
  await page.click('#btnAgenda');
  await page.waitForSelector('#agendaview:not(.hide) .ev');
  verifica((await page.textContent('#abody')).includes('Dentista'), 'il dentista è nei prossimi giorni');
  verifica(/1 evento in 7 giorni/.test(await page.textContent('#aSub')), 'riassunto sotto il titolo: ' + await page.textContent('#aSub'));
  verifica((await page.textContent('.ev:has-text("Call con Luca") .tag.google')) === 'Google' && (await page.textContent('.ev:has-text("Call con Luca") .es')).includes('Meet'), 'l\'evento di Google Calendar c\'è, col segno «Google» e il luogo');
  await shot(page, 'agenda-prossimi');
  await page.click('#agSeg [data-v="mese"]');
  await page.waitForSelector('.griglia');
  await shot(page, 'agenda-mese');
  await page.click('#agSeg [data-v="dafare"]');
  await page.waitForSelector('#_qa');
  await page.fill('#_qa', 'Comprare il latte');
  await page.press('#_qa', 'Enter');
  await page.waitForFunction(() => document.querySelector('#abody').textContent.includes('Comprare il latte'));
  await sleep(2500);
  let agTesto = repo.text('agenda/agenda.json');
  verifica(/"titolo":"Comprare il latte"/.test(agTesto), 'compito salvato nel repo');
  verifica(/\n    \{"id":"c-[a-z0-9]{8}","titolo":"Comprare il latte","creato_da":"andrea","creato":"\d{4}-\d\d-\d\dT\d\d:\d\d"\}/.test(agTesto), 'una voce per riga, campi vuoti tolti, chiavi in ordine');
  verifica(/^agenda da app: nuovo compito «Comprare il latte»/.test(repo.log[repo.log.length - 1]), 'commit «agenda da app»');
  // Claude intanto cambia l'agenda: la spunta dall'app non deve cancellare il suo lavoro
  const ag2 = JSON.parse(agTesto);
  ag2.eventi.push({ id: 'e-claude2', titolo: 'Palestra', data: oggiRoma(1), ora: '18:00', ripeti: { ogni: 'settimana', giorni: [1, 3, 5] } });
  repo.write('agenda/agenda.json', ser(ag2), 'Claude risponde: generale');
  await page.click('.todo:has-text("Comprare il latte") .check');
  await sleep(3000);
  const ag3 = JSON.parse(repo.text('agenda/agenda.json'));
  verifica(ag3.compiti.find(c => c.titolo === 'Comprare il latte').fatto === true, 'spunta salvata');
  verifica(!!ag3.eventi.find(e => e.id === 'e-claude2'), 'e l\'evento aggiunto da Claude nel frattempo c\'è ancora');
  await shot(page, 'agenda-dafare');

  console.log('12. nuovo evento dal modulo');
  await page.click('#agSeg [data-v="prossimi"]');
  await page.click('#fab');
  await page.waitForSelector('.sheet #_t');
  await page.fill('.sheet #_t', 'Cena con Marco');
  await page.fill('.sheet #_d', oggiRoma(2));
  await page.uncheck('.sheet #_tg');
  await page.fill('.sheet #_o1', '20:30');
  await page.fill('.sheet #_lu', 'Trattoria');
  await shot(page, 'nuovo-evento');
  await page.click('.sheet #_ok');
  await sleep(2500);
  const ag4 = JSON.parse(repo.text('agenda/agenda.json'));
  const cena = ag4.eventi.find(e => e.titolo === 'Cena con Marco');
  verifica(cena && cena.ora === '20:30' && cena.data === oggiRoma(2) && cena.luogo === 'Trattoria' && !cena.tipo, 'evento salvato: ' + JSON.stringify(cena));
  verifica((await page.textContent('#abody')).includes('Palestra'), 'la palestra ricorrente compare');

  console.log('13. evento ripetuto: «solo questa volta»');
  await page.click('.ev:has-text("Palestra")');
  await page.waitForSelector('.sheet #_del');
  await page.click('.sheet #_del');
  await page.waitForSelector('#_alt');
  await page.click('#_alt');
  await sleep(2500);
  const ag5 = JSON.parse(repo.text('agenda/agenda.json'));
  verifica((ag5.eventi.find(e => e.id === 'e-claude2').ripeti.salta || []).length === 1, 'una data in «salta»');
  console.log('13b. un evento di Google Calendar si vede ma non si cambia');
  await page.click('.ev:has-text("Call con Luca")');
  await page.waitForSelector('.sheet #_gc');
  verifica((await page.textContent('.sheet h2')) === 'Call con Luca' && !(await page.$('.sheet #_del')) && !(await page.$('.sheet input')), 'scheda in sola lettura');
  verifica((await page.textContent('.sheet #_q')).includes('10:00–10:30') && !(await page.textContent('.sheet #_q')).includes('Meet'), 'con giorno e ora (il luogo a parte)');
  await shot(page, 'evento-google');
  await page.click('.sheet #_ch'); await sleep(300);
  await page.click('#aBack'); await sleep(300);
  verifica(await page.isHidden('#agendaview'), 'indietro chiude l\'agenda');

  console.log('14. nuova chat');
  await page.click('#_nuovaChat');
  await page.fill('.sheet #_t', 'Viaggio a Mosca');
  await page.fill('.sheet #_d', 'Organizzare il viaggio di dicembre.');
  const c0 = repo.log.length;
  await page.click('.sheet #_si');
  await page.waitForSelector('#chatview:not(.hide)', { timeout: 10000 });
  verifica(await page.textContent('#cTitle') === 'Viaggio a Mosca', 'la chat nuova si apre');
  verifica(['chat.json', 'istruzioni.md', 'memoria.md'].every(x => repo.files()['chat/viaggio-a-mosca/' + x]), 'tre file creati');
  verifica(repo.log.length === c0 + 1 && repo.log[c0] === 'nuova chat da app: Viaggio a Mosca', 'in un commit solo');
  await shot(page, 'chat-nuova');
  await page.click('#cBack'); await sleep(300);

  console.log('14b. area nuova da un\'idea, con icona e routine');
  await page.click('#_nuovaChat');
  await page.click('.sheet #_idee .chip:has-text("Salute e sport")');
  verifica(await page.inputValue('.sheet #_t') === 'Salute e sport' && await page.isVisible('.sheet #_rw') && await page.isVisible('.sheet #_em button.on'), 'l\'idea riempie titolo, icona e routine');
  await shot(page, 'area-nuova');
  await page.click('.sheet #_si');
  await page.waitForSelector('#chatview:not(.hide)', { timeout: 10000 });
  const salute = JSON.parse(repo.text('chat/salute-e-sport/chat.json'));
  verifica(salute.icona === '💪' && salute.routine.length === 1 && salute.routine[0].quando === 'mattina' && /^r-[a-z0-9]{8}$/.test(salute.routine[0].id) && salute.routine[0].attiva === true,
    'chat.json con icona e routine: ' + JSON.stringify(salute.routine[0]).slice(0, 80));
  verifica(Object.keys(salute).join() === 'titolo,descrizione,icona,repo,routine,creata', 'chiavi nell\'ordine di comune.py');
  await page.click('#cBack'); await sleep(300);

  console.log('15. la casella della pagina di partenza: modo «ricerca» e scelta della chat');
  await page.click('#hChips .chip:has-text("Cerca sul web")');
  verifica((await page.inputValue('#hInput')) === 'Cerca sul web ' && await page.getAttribute('#hComp .modo[data-modo="ricerca"]', 'aria-pressed') === 'true', 'l\'idea riempie la casella e accende «Ricerca»');
  await page.fill('#hInput', 'Cerca sul web i musei di Mosca aperti a dicembre');
  await shot(page, 'partenza-scrivo');
  await page.click('#hSend');
  await page.waitForSelector('#chatview:not(.hide)');
  verifica(await page.textContent('#cTitle') === 'Generale', 'si apre la chat dove è andato il messaggio');
  await page.waitForFunction(() => !document.querySelector('#cmsgs .msg.out'), null, { timeout: 15000 });
  verifica(repo.text(diAndrea(repo, 'generale').pop()) === '---\nmodo: ricerca\n---\nCerca sul web i musei di Mosca aperti a dicembre\n', 'nel repo, col modo nel frontmatter');
  await page.click('#cBack'); await sleep(300);
  verifica((await page.inputValue('#hInput')) === '', 'la casella si è svuotata');
  await page.click('#hDove');
  await page.click('.sheet .drchat:has-text("Russo")');
  await sleep(300);
  verifica((await page.textContent('#hDove')).includes('Russo') && (await page.getAttribute('#hInput', 'placeholder')).includes('Russo'), 'scelta la chat Russo');
  await page.fill('#hInput', 'Come si dice «buongiorno»?');
  await page.click('#hSend');
  await page.waitForSelector('#chatview:not(.hide)');
  await page.waitForFunction(() => !document.querySelector('#cmsgs .msg.out'), null, { timeout: 15000 });
  verifica(await page.textContent('#cTitle') === 'Russo' && diAndrea(repo, 'russo').length === 1, 'il messaggio è andato in Russo');

  console.log('16. ricarico la pagina: riprende da dove era');
  await page.reload();
  await page.waitForSelector('#chatview:not(.hide)', { timeout: 8000 });
  verifica(await page.textContent('#cTitle') === 'Russo', 'dopo il ricaricamento la chat Russo è ancora aperta');
  await page.goBack(); await sleep(400);
  verifica(await page.isHidden('#chatview'), 'indietro chiude la chat');

  console.log('17. menu laterale e ricerca nei messaggi');
  rispondi(repo, 'generale', 'Il dentista è martedì alle 15, in via Roma 3.\n');
  await page.click('#btnRefresh'); await sleep(800);
  await page.click('#btnMenu');
  await page.waitForSelector('.sheet.drawer .drchat');
  verifica((await page.$$eval('.sheet.drawer #_chat .drchat', b => b.length)) === 10, 'nel menu tutte le aree');
  verifica((await page.textContent('.sheet.drawer #_uso')).includes('42%') && (await page.textContent('.sheet.drawer #_rou')).includes('4 attive'), 'nel menu: uso al 42% e 4 routine attive');
  await shot(page, 'menu');
  await page.fill('#_q', 'dentista via roma');
  await page.waitForSelector('#_ris .ris', { timeout: 8000 });
  verifica(await page.$$eval('#_ris .ris mark', m => m.map(x => x.textContent.toLowerCase()).includes('roma')), 'risultati con le parole evidenziate');
  await page.fill('#_q', 'onerror');
  await page.waitForFunction(() => document.querySelectorAll('#_ris .ris').length > 0, null, { timeout: 8000 });
  verifica(await page.$$eval('#_ris img, #_ris [onerror]', x => x.length) === 0, 'nei risultati il testo resta testo (niente img)');
  await page.fill('#_q', 'dentista via roma');
  await page.waitForSelector('#_ris .ris');
  await shot(page, 'cerca');
  await page.click('#_ris .ris');
  await page.waitForSelector('#chatview:not(.hide) .msg.lampeggia', { timeout: 8000 });
  verifica((await page.textContent('.msg.lampeggia')).includes('via Roma 3'), 'il risultato apre la chat sul messaggio giusto');
  await sleep(400);   // finisce di entrare
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 8, y: 420 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 60, y: 422 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: 424 }] });
  await sleep(100);   // i touchmove arrivano al frame dopo
  verifica(await page.$eval('#chatview', el => new DOMMatrix(getComputedStyle(el).transform).m41) > 100, 'la chat segue il dito');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 300, y: 430 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(500);
  verifica(await page.isHidden('#chatview'), 'col dito dal bordo sinistro si torna indietro');
  const prima = letture;
  await trascina(200, 260, 200, 620); await sleep(1500);
  verifica(letture > prima, 'tirando giù la pagina di partenza si aggiorna');

  console.log('18. controllo della configurazione, senza permesso Actions');
  repo.permessoActions = false;
  await page.click('#btnMenu'); await page.click('#_imp');
  await page.waitForSelector('#_check'); await page.click('#_check');
  await page.waitForSelector('.checks li:nth-child(5)', { timeout: 10000 });
  const voci = await page.$$eval('.checks li', l => l.map(x => x.className + ' ' + x.textContent.slice(0, 60)));
  console.log('     ' + voci.join('\n     '));
  verifica(voci.some(v => v.startsWith('forse') && v.includes('non vede i turni')), 'segnala che manca il permesso Actions');
  await shot(page, 'configurazione');

  console.log('18b. impostazioni: tema, briefing spento, .ics, opacità del pannello');
  await page.goBack(); await sleep(300);
  repo.permessoActions = true;
  await page.click('#btnMenu'); await page.click('#_imp'); await page.waitForSelector('#_brief'); await sleep(700);
  await shot(page, 'impostazioni-ferme');
  const opaco = await page.$eval('.sheet', el => getComputedStyle(el).opacity);
  verifica(opaco === '1', 'pannello opaco a fine animazione');
  await page.click('#_tema [data-v="scuro"]');
  verifica(await page.getAttribute('html', 'data-tema') === 'scuro' && (await page.$$eval('meta[name="theme-color"]', m => m.map(x => x.content))).every(c => c === '#09090b'), 'tema scuro scelto a mano');
  await page.click('#_tema [data-v="auto"]');
  verifica(await page.getAttribute('html', 'data-tema') === null, 'e di nuovo quello del telefono');
  await page.uncheck('#_brief'); await sleep(1500);
  verifica(JSON.parse(repo.text('impostazioni.json')).briefing_mattino === false, 'briefing spento in impostazioni.json');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#_ics')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8');
  verifica(dl.suggestedFilename() === 'regia-agenda.ics', 'scarica regia-agenda.ics');
  verifica(/BEGIN:VEVENT[\s\S]*SUMMARY:Dentista/.test(ics) && /RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR/.test(ics) && /EXDATE;TZID=Europe\/Rome:/.test(ics), 'ics con eventi, ricorrenza ed eccezione');
  await page.goBack(); await sleep(300);

  console.log('18c. «Organizza» apre Generale con la frase pronta');
  await page.click('#btnAgenda');
  await page.click('#btnOrganizza');
  await page.waitForSelector('#chatview:not(.hide)');
  verifica((await page.inputValue('#cInput')) === 'Organizzami la settimana: ', 'bozza pronta nella casella');

  console.log('18d. ricarico con agenda + chat + pannello aperti: indietro non si blocca');
  await page.click('#cMenu'); await page.waitForSelector('.sheet');
  await page.reload();
  await page.waitForSelector('#chatview:not(.hide)', { timeout: 8000 });
  await sleep(500);
  verifica(await page.isHidden('.sheet'), 'dopo il ricaricamento il pannello non c\'è più');
  verifica(await page.isVisible('#agendaview'), 'l\'agenda è ancora sotto la chat');
  await page.goBack(); await sleep(400);
  verifica(await page.isHidden('#chatview') && await page.isVisible('#agendaview'), 'un «indietro» chiude la chat e lascia l\'agenda');
  await page.goBack(); await sleep(400);
  verifica(await page.isHidden('#agendaview'), 'un altro chiude l\'agenda');
  verifica(page.url().startsWith('https://regia.test'), 'e si resta nell\'app');

  console.log('20. uso di Claude: il pannello');
  await page.click('#uso');
  await page.waitForSelector('.sheet .misura');
  verifica((await page.$$('.sheet .misura')).length === 2 && (await page.$$('.sheet .misura.attenzione')).length === 1, 'due limiti, la settimana in arancione');
  verifica((await page.textContent('.sheet .misura.attenzione')).includes('76%') && (await page.textContent('.sheet .misura.attenzione small')).includes('si azzera'), 'con la percentuale e quando si azzera');
  verifica((await page.textContent('#_tiles .tile:first-child .tv')) === '3', 'oggi: 3 turni');
  await page.click('#_per [data-g="6"]');
  verifica(+(await page.textContent('#_tiles .tile:first-child .tv')) > 3, 'in 7 giorni: di più');
  verifica((await page.$$('.grafico .col')).length >= 10 && (await page.$$('.grafico .col.oggi')).length === 1, 'le colonne dei 14 giorni, oggi evidenziato');
  await page.click('.grafico .hit[data-i="13"]');
  verifica(/token · 3 turni/.test(await page.textContent('#_sug')), 'un tocco sulla colonna dice i numeri: ' + await page.textContent('#_sug'));
  verifica((await page.$$('#_mod .mu')).length === 2 && (await page.textContent('#_mod')).includes('Opus 5.5'), 'il peso di ogni modello');
  verifica((await page.$$('#_aree .drchat')).length === 2, 'le aree dove ha lavorato');
  verifica((await page.getAttribute('.sheet .links a', 'href')) === 'https://claude.ai/settings/usage', 'e il link ai dettagli su claude.ai');
  await shot(page, 'uso');
  await page.goBack(); await sleep(300);

  console.log('21. il modello: per un messaggio, per un\'area, per tutto');
  await page.click('.chatcard.gen'); await page.waitForSelector('#chatview:not(.hide)');
  verifica((await page.textContent('#cModello span')) === 'Auto', 'all\'inizio il modello è automatico');
  await page.click('#cModello');
  await page.waitForSelector('.sheet .scelta-modello button');
  verifica((await page.$$('.sheet .scelta-modello button')).length === 5, 'cinque scelte: automatico e i quattro modelli');
  await shot(page, 'modelli');
  await page.click('.sheet .scelta-modello button:has-text("Opus 5.5")'); await sleep(400);
  verifica((await page.textContent('#cModello span')) === 'Opus' && (await page.getAttribute('#cModello', 'class')).includes('scelto'), 'la casella dice Opus');
  await page.fill('#cInput', 'Una domanda difficile');
  await page.click('#cSend');
  await page.waitForFunction(() => !document.querySelector('#cmsgs .msg.out'), null, { timeout: 15000 });
  verifica(repo.text(diAndrea(repo, 'generale').pop()) === '---\nmodello: claude-opus-5-5\n---\nUna domanda difficile\n', 'il modello nel frontmatter del messaggio');
  verifica((await page.$$eval('#cmsgs .msg.andrea', els => (els.pop().querySelector('.tagmodello') || {}).textContent)) === 'Opus', 'sotto il messaggio: Opus');
  await page.click('#cModello'); await page.click('.sheet .scelta-modello button:has-text("Automatico")'); await sleep(400);
  await page.click('#cBack'); await sleep(300);
  // per un'area: dal menu della chat, in chat.json
  await page.click('.chatcard.area:has-text("Russo")'); await page.waitForSelector('#chatview:not(.hide)');
  await page.click('#cMenu'); await page.click('.sheet #_mdl');
  await page.click('.sheet .scelta-modello button:has-text("Haiku 5.5")'); await sleep(1200);
  verifica(JSON.parse(repo.text('chat/russo/chat.json')).modello === 'claude-haiku-5-5', 'il modello dell\'area in chat.json');
  verifica((await page.textContent('#cModello span')) === 'Haiku' && !(await page.getAttribute('#cModello', 'class')).includes('scelto'), 'e la casella lo mostra come automatico');
  await page.click('#cBack'); await sleep(300);
  // per tutto: nelle Impostazioni (e il briefing spento prima resta spento)
  await page.click('#btnMenu'); await page.click('#_imp'); await page.waitForSelector('#_mp'); await sleep(400);
  await page.click('#_mp');
  await page.waitForSelector('.sheet .scelta-modello');
  await page.click('.sheet .scelta-modello button:has-text("Sonnet 5.5")'); await sleep(1500);
  const imp = JSON.parse(repo.text('impostazioni.json'));
  verifica(imp.modello === 'claude-sonnet-5-5' && imp.briefing_mattino === false, 'impostazioni.json: Sonnet per tutto, briefing ancora spento');
  verifica((await page.textContent('#hModello span')) === 'Haiku', 'la casella della partenza scrive in Russo: Haiku, il modello dell\'area');
  await page.click('.chatcard.gen'); await page.waitForSelector('#chatview:not(.hide)');
  verifica((await page.textContent('#cModello span')) === 'Sonnet', 'in Generale: Sonnet, quello delle Impostazioni');
  await page.click('#cBack'); await sleep(300);

  console.log('22. routine: elenco, accendi e spegni, modifica, fai ora');
  await page.click('#btnMenu'); await page.click('.sheet.drawer #_rou');
  await page.waitForSelector('.sheet .rt');
  verifica((await page.$$('.sheet .rt')).length === 5, 'tutte le routine delle aree (con quella di Salute e sport)');
  verifica((await page.textContent('.sheet .rt:has-text("La parola del giorno") .area-r')) === 'Spenta', 'quella spenta lo dice');
  await shot(page, 'routine');
  await page.click('.sheet .rt:has-text("Rassegna del mattino") .interruttore'); await sleep(1500);
  verifica(JSON.parse(repo.text('chat/notizie/chat.json')).routine[0].attiva === false, 'spenta in chat.json');
  await page.click('.sheet .rt:has-text("Rassegna del mattino") .interruttore'); await sleep(1500);
  verifica(JSON.parse(repo.text('chat/notizie/chat.json')).routine[0].attiva === true, 'e riaccesa (due tocchi di fila)');
  await page.click('.sheet .rt:has-text("Rassegna del mattino") .ri');
  await page.waitForSelector('.sheet #_g');
  await page.click('.sheet #_g [data-g="6"]'); await page.click('.sheet #_g [data-g="7"]');
  await page.click('.sheet #_q [data-v="sera"]');
  await shot(page, 'routine-modulo');
  await page.click('.sheet #_si'); await sleep(1500);
  const rass = JSON.parse(repo.text('chat/notizie/chat.json')).routine[0];
  verifica(JSON.stringify(rass.giorni) === '[1,2,3,4,5]' && rass.quando === 'sera' && rass.id === 'r-rassegna', 'giorni feriali, la sera: ' + JSON.stringify(rass).slice(0, 90));
  await page.click('.chatcard.area:has-text("Notizie")'); await page.waitForSelector('#chatview:not(.hide)');
  await page.click('#cMenu'); await page.click('.sheet #_rou'); await page.waitForSelector('.sheet .rt');
  await page.click('.sheet .rt .ri'); await page.waitForSelector('.sheet #_ora');
  await page.click('.sheet #_ora');
  await page.waitForFunction(() => !document.querySelector('#cmsgs .msg.out'), null, { timeout: 15000 });
  verifica(/^Fai adesso la routine «Rassegna del mattino»:/.test(repo.text(diAndrea(repo, 'notizie').pop())), '«Fai ora» manda la routine come messaggio');
  rispondi(repo, 'notizie', '---\ntipo: routine\nroutine: r-rassegna\n---\n## Le notizie di oggi\n\n1. Una cosa importante.\n');
  await page.waitForSelector('.msg.claude.routine', { timeout: 15000 });
  verifica((await page.textContent('.msg.claude.routine .who')).includes('Routine · Rassegna del mattino'), 'la risposta della routine ha il suo nome sopra');
  await shot(page, 'routine-risposta');
  await page.click('#cBack'); await sleep(300);

  console.log('19. tema scuro');
  await page.emulateMedia({ colorScheme: 'dark' });
  await sleep(300);
  await shot(page, 'scuro-partenza');
  await page.click('.chatcard.gen'); await sleep(900);
  await shot(page, 'scuro-chat');
  await page.goBack(); await sleep(300);
  await page.click('#btnMenu'); await sleep(400);
  await shot(page, 'scuro-menu');
  await page.goBack(); await sleep(300);
  await page.click('#btnAgenda'); await sleep(500);
  await shot(page, 'scuro-agenda');
  await page.click('#agSeg [data-v="mese"]'); await sleep(300);
  await shot(page, 'scuro-mese');
  await page.click('#aBack'); await sleep(300);
  await page.click('#uso'); await page.waitForSelector('.sheet .misura');
  await shot(page, 'scuro-uso');
  await page.goBack(); await sleep(300);
  await page.click('#btnMenu'); await page.click('.sheet.drawer #_rou'); await page.waitForSelector('.sheet .rt');
  await shot(page, 'scuro-routine');
  await page.goBack(); await sleep(300);

  verifica(errori.length === 0, 'nessun errore in console' + (errori.length ? ': ' + errori.join(' | ') : ''));
  await browser.close();
  console.log(ok ? '\nTUTTO OK' : '\nQUALCOSA NON VA');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
