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
  await context.route('http://regia.test/**', r => {
    let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html';
    const f = path.join(APP, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: 'no' });
    const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
    r.fulfill({ status: 200, headers: { 'Content-Type': tipi[path.extname(f)] || 'application/octet-stream' }, body: fs.readFileSync(f) });
  });
}

async function shot(page, nome) { n++; await page.screenshot({ path: path.join(SHOTS, String(n).padStart(2, '0') + '-' + nome + '.png') }); }

(async () => {
  const browser = await chromium.launch();
  const repo = new Repo(DATI);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', locale: 'it-IT', timezoneId: 'Europe/Rome' });
  await servi(context, repo);
  const page = await context.newPage();
  const errori = [];
  page.on('pageerror', e => errori.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) errori.push('console: ' + m.text()); });
  let dialoghi = 0;
  page.on('dialog', d => { dialoghi++; d.dismiss(); });

  console.log('1. primo avvio senza token');
  await page.goto('http://regia.test/');
  await page.waitForSelector('.welcome');
  verifica(await page.isVisible('text=Benvenuto in Regia'), 'schermata di benvenuto');
  await shot(page, 'benvenuto');

  console.log('2. impostazioni: token salvato → chat');
  await page.click('#_imp');
  await page.fill('#_tok', 'tok-finto');
  await shot(page, 'impostazioni');
  await page.click('#_salva');
  await page.waitForSelector('.chatcard');
  const titoli = await page.$$eval('.cc-t', els => els.map(e => e.textContent));
  verifica(JSON.stringify(titoli) === JSON.stringify(['Generale', 'Articoli', 'Russo']) || titoli[0] === 'Generale', 'Generale in cima: ' + titoli.join(', '));
  verifica(await page.textContent('#badgeChat') === '1', 'un messaggio non letto (il benvenuto)');
  await shot(page, 'elenco-chat');

  console.log('3. apro Generale');
  await page.click('.chatcard.gen');
  await page.waitForSelector('#cmsgs .msg.claude');
  verifica(await page.isVisible('text=Questa è Regia') || (await page.textContent('#cmsgs')).includes('Regia'), 'messaggio di benvenuto visibile');
  verifica(await page.isVisible('.mini.compito'), 'scheda del compito sotto il messaggio');
  verifica(await page.isVisible('.chip'), 'suggerimenti sopra la casella');
  await shot(page, 'generale');

  console.log('4. scrivo e mando un messaggio');
  await page.fill('#cInput', 'Ricordami il dentista martedì alle 15');
  await page.click('#cSend');
  await page.waitForFunction(() => !document.querySelector('#cmsgs .msg.out'), null, { timeout: 15000 });
  const inviati = Object.keys(repo.files()).filter(p => /^chat\/generale\/messaggi\/.*-andrea-/.test(p));
  verifica(inviati.length === 1, 'il messaggio è un file nel repo: ' + inviati[0]);
  verifica(repo.text(inviati[0]) === 'Ricordami il dentista martedì alle 15\n', 'contenuto giusto');
  verifica(repo.log[repo.log.length - 1] === 'messaggio da app: chat/generale', 'messaggio di commit giusto');
  // il workflow parte
  repo.runs = [{ id: 1, status: 'in_progress', conclusion: null, html_url: 'https://github.com/x/runs/1', created_at: new Date().toISOString(), run_started_at: new Date().toISOString(), event: 'push' }];
  await page.click('#cBack'); await page.click('#btnRefresh'); await sleep(800);
  await page.click('.chatcard.gen');
  await page.waitForSelector('.typing');
  verifica((await page.textContent('#cSub')).includes('Claude sta lavorando'), 'sottotitolo: Claude sta lavorando');
  await shot(page, 'claude-lavora');

  console.log('5. Claude risponde (simulato) e mette in agenda');
  const ag = JSON.parse(repo.text('agenda/agenda.json'));
  const martedi = (() => { for (let k = 1; k < 8; k++) { const g = oggiRoma(k); if (new Date(g + 'T12:00:00Z').getUTCDay() === 2) return g; } })();
  ag.eventi.push({ id: 'e-dentista1', titolo: 'Dentista', data: martedi, ora: '15:00', ora_fine: '16:00', luogo: 'Via Roma 3', creato_da: 'claude' });
  const ser = d => '{\n  "versione": 1,\n  "fuso": "Europe/Rome",\n  "eventi": [\n' + d.eventi.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ],\n  "compiti": [\n' + d.compiti.map(e => '    ' + JSON.stringify(e)).join(',\n') + '\n  ]\n}\n';
  const nomeRisp = stampa(new Date(Date.now() + 2000)) + '-claude-ab12.md';
  const f = Object.assign({}, repo.files());
  f['agenda/agenda.json'] = repo.putBlob(Buffer.from(ser(ag)));
  f['chat/generale/messaggi/' + nomeRisp] = repo.putBlob(Buffer.from('---\neventi: [e-dentista1]\n---\n📅 Messo in agenda: **dentista**, martedì alle 15.\n\nVuoi un promemoria il giorno prima?\n'));
  f['chat/generale/stato.json'] = repo.putBlob(Buffer.from(JSON.stringify({ risposto_fino_a: inviati[0].split('/').pop(), run: 'x' })));
  repo.commit(f, 'Claude risponde: generale');
  repo.runs[0].status = 'completed'; repo.runs[0].conclusion = 'success';
  await page.waitForSelector('.mini:not(.compito)', { timeout: 15000 });
  verifica(!(await page.isVisible('.typing')), 'niente più «sta lavorando»');
  verifica((await page.textContent('.mini:not(.compito) .mt')) === 'Dentista', 'scheda dell\'evento nella risposta');
  await shot(page, 'risposta');
  await page.click('.mini:not(.compito)');
  await page.waitForSelector('.sheet #_t');
  verifica(await page.inputValue('.sheet #_t') === 'Dentista', 'la scheda apre l\'evento');
  verifica((await page.getAttribute('#_gc', 'href')).includes('calendar.google.com'), 'link a Google Calendar');
  await shot(page, 'evento');
  await page.click('.sheet #_an'); await sleep(300);

  console.log('6. sicurezza: link pericolosi in un messaggio');
  const f2 = Object.assign({}, repo.files());
  f2['chat/generale/messaggi/' + stampa(new Date(Date.now() + 5000)) + '-claude-xs55.md'] = repo.putBlob(Buffer.from(
    'Prova [clic](javascript:alert(1)) e <img src=x onerror=alert(2)> e [attr](a"onmouseover="alert(3)) e ![i](javascript:alert(4)) e [ok](file/nota.md) e https://example.com/a?b=1&c=2.\n'));
  f2['chat/generale/file/nota.md'] = repo.putBlob(Buffer.from('# Una nota\n\nScritta da Claude.\n'));
  repo.commit(f2, 'Claude risponde: generale');
  await page.waitForFunction(() => document.querySelector('#cmsgs').textContent.includes('Prova'), null, { timeout: 30000 });
  const hrefs = await page.$$eval('#cmsgs a', as => as.map(a => a.getAttribute('href')));
  verifica(!hrefs.some(h => /javascript:/i.test(h || '')), 'nessun href javascript:');
  verifica(await page.$$eval('#cmsgs [onerror], #cmsgs [onmouseover]', x => x.length) === 0, 'nessun attributo onerror/onmouseover');
  await page.click('#cmsgs a.repo:text("ok")');
  await page.waitForSelector('#viewer:not(.hide) #preview h1');
  verifica((await page.textContent('#preview h1')) === 'Una nota', 'il link a un file della chat si apre nel lettore');
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
  await page.click('#vBack'); await sleep(200);

  console.log('8. allegato (foto) + messaggio in un commit solo');
  const png = path.join(require('os').tmpdir(), 'foto.png');
  fs.copyFileSync(path.join(APP, 'icon-192.png'), png);
  await page.setInputFiles('#filePick', png);
  await page.waitForSelector('.patt');
  await page.fill('#cInput', 'Ecco la foto dello scontrino');
  const commitPrima = repo.log.length;
  await page.click('#cSend');
  await page.waitForFunction(() => !document.querySelector('#cmsgs .msg.out'), null, { timeout: 15000 });
  await sleep(600);
  const allegati = Object.keys(repo.files()).filter(p => p.startsWith('chat/generale/allegati/'));
  verifica(allegati.length === 1 && allegati[0].endsWith('foto.png'), 'allegato nel repo: ' + allegati[0]);
  verifica(repo.log.length === commitPrima + 1, 'un commit solo per messaggio + allegato');
  const ultimoMsg = Object.keys(repo.files()).filter(p => /generale\/messaggi\/.*-andrea-/.test(p)).sort().pop();
  verifica(repo.text(ultimoMsg).startsWith('---\nallegati: [allegati/'), 'il messaggio cita l\'allegato nel frontmatter');
  await page.waitForSelector('.att.img img[src^="data:image"]', { timeout: 8000 });
  verifica(true, 'miniatura della foto nella bolla');
  await shot(page, 'allegato');

  console.log('9. offline: il messaggio resta in coda e parte dopo');
  repo.offline = true;
  await page.fill('#cInput', 'Scritto senza rete');
  await page.click('#cSend');
  await page.waitForSelector('.msg.fail', { timeout: 8000 });
  verifica(await page.isVisible('text=non inviato'), 'bolla «non inviato»');
  verifica((await page.textContent('#gbanner')).includes('Offline'), 'avviso offline');
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
  await page.click('#tabbar [data-tab="agenda"]');
  await page.waitForSelector('.ev');
  verifica((await page.textContent('#main')).includes('Dentista'), 'il dentista è nei prossimi giorni');
  await shot(page, 'agenda-prossimi');
  await page.click('#agSeg [data-v="mese"]');
  await page.waitForSelector('.griglia');
  await shot(page, 'agenda-mese');
  await page.click('#agSeg [data-v="dafare"]');
  await page.waitForSelector('#_qa');
  await page.fill('#_qa', 'Comprare il latte');
  await page.press('#_qa', 'Enter');
  await page.waitForFunction(() => document.querySelector('#main').textContent.includes('Comprare il latte'));
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
  verifica((await page.textContent('#main')).includes('Palestra'), 'la palestra ricorrente compare');

  console.log('13. evento ripetuto: «solo questa volta»');
  await page.click('.ev:has-text("Palestra")');
  await page.waitForSelector('.sheet #_del');
  await page.click('.sheet #_del');
  await page.waitForSelector('#_alt');
  await page.click('#_alt');
  await sleep(2500);
  const ag5 = JSON.parse(repo.text('agenda/agenda.json'));
  verifica((ag5.eventi.find(e => e.id === 'e-claude2').ripeti.salta || []).length === 1, 'una data in «salta»');

  console.log('14. nuova chat');
  await page.click('#tabbar [data-tab="chat"]');
  await page.click('#fab');
  await page.fill('.sheet #_t', 'Viaggio a Mosca');
  await page.fill('.sheet #_d', 'Organizzare il viaggio di dicembre.');
  const c0 = repo.log.length;
  await page.click('.sheet #_si');
  await page.waitForSelector('#chatview:not(.hide)', { timeout: 10000 });
  verifica(await page.textContent('#cTitle') === 'Viaggio a Mosca', 'la chat nuova si apre');
  verifica(['chat.json', 'istruzioni.md', 'memoria.md'].every(x => repo.files()['chat/viaggio-a-mosca/' + x]), 'tre file creati');
  verifica(repo.log.length === c0 + 1 && repo.log[c0] === 'nuova chat da app: Viaggio a Mosca', 'in un commit solo');
  await shot(page, 'chat-nuova');
  await page.click('#cBack'); await sleep(200);

  console.log('15. ricarico la pagina: riprende da dove era');
  await page.click('.chatcard:has-text("Russo")');
  await page.waitForSelector('#chatview:not(.hide)');
  await page.reload();
  await page.waitForSelector('#chatview:not(.hide)', { timeout: 8000 });
  verifica(await page.textContent('#cTitle') === 'Russo', 'dopo il ricaricamento la chat Russo è ancora aperta');
  await page.goBack(); await sleep(300);
  verifica(await page.isHidden('#chatview'), 'indietro chiude la chat');

  console.log('16. controllo della configurazione, senza permesso Actions');
  repo.permessoActions = false;
  await page.click('#btnSettings'); await page.click('#_check');
  await page.waitForSelector('.checks li:nth-child(5)', { timeout: 10000 });
  const voci = await page.$$eval('.checks li', l => l.map(x => x.className + ' ' + x.textContent.slice(0, 60)));
  console.log('     ' + voci.join('\n     '));
  verifica(voci.some(v => v.startsWith('forse') && v.includes('non vede i turni')), 'segnala che manca il permesso Actions');
  await shot(page, 'configurazione');

  console.log('16b. impostazioni: briefing spento, .ics, opacità del pannello');
  await page.goBack(); await sleep(300);
  repo.permessoActions = true;
  await page.click('#btnSettings'); await page.waitForSelector('#_brief'); await sleep(700);
  await shot(page, 'impostazioni-ferme');
  const opaco = await page.$eval('.sheet', el => getComputedStyle(el).opacity);
  verifica(opaco === '1', 'pannello opaco a fine animazione');
  await page.uncheck('#_brief'); await sleep(1500);
  verifica(JSON.parse(repo.text('impostazioni.json')).briefing_mattino === false, 'briefing spento in impostazioni.json');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#_ics')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8');
  verifica(dl.suggestedFilename() === 'regia-agenda.ics', 'scarica regia-agenda.ics');
  verifica(/BEGIN:VEVENT[\s\S]*SUMMARY:Dentista/.test(ics) && /RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR/.test(ics) && /EXDATE;TZID=Europe\/Rome:/.test(ics), 'ics con eventi, ricorrenza ed eccezione');
  await page.goBack(); await sleep(300);

  console.log('16c. «Organizza» apre Generale con la frase pronta');
  await page.click('#tabbar [data-tab="agenda"]');
  await page.click('#btnOrganizza');
  await page.waitForSelector('#chatview:not(.hide)');
  verifica((await page.inputValue('#cInput')) === 'Organizzami la settimana: ', 'bozza pronta nella casella');

  console.log('16d. ricarico con chat + pannello aperti: indietro non si blocca');
  await page.click('#cMenu'); await page.waitForSelector('.sheet');
  await page.reload();
  await page.waitForSelector('#chatview:not(.hide)', { timeout: 8000 });
  await sleep(500);
  verifica(await page.isHidden('.sheet'), 'dopo il ricaricamento il pannello non c\'è più');
  await page.goBack(); await sleep(400);
  verifica(await page.isHidden('#chatview'), 'un solo «indietro» chiude la chat');
  verifica(page.url().startsWith('http://regia.test'), 'e si resta nell\'app');

  console.log('17. tema scuro');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.click('#tabbar [data-tab="chat"]'); await sleep(200);
  await page.click('.chatcard.gen'); await sleep(800);
  await shot(page, 'scuro-chat');
  await page.goBack(); await sleep(200);
  await page.click('#tabbar [data-tab="agenda"]'); await sleep(400);
  await shot(page, 'scuro-agenda');

  verifica(errori.length === 0, 'nessun errore in console' + (errori.length ? ': ' + errori.join(' | ') : ''));
  await browser.close();
  console.log(ok ? '\nTUTTO OK' : '\nQUALCOSA NON VA');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
