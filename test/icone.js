// Disegna le icone dell'app da un SVG solo (la scintilla calda su fondo quasi nero).
// uso: node test/icone.js   — riscrive icon.png, icon-192.png, icon-maskable.png, apple-touch-icon.png
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const path = require('path');
const APP = path.join(__dirname, '..');

// tondo: angoli trasparenti (icone «any»); pieno: tutto il quadrato colorato
// (maskable e iPhone, che gli angoli li taglia da sé); scala: quanto è grande
// la scintilla (nella maskable deve stare dentro la zona sicura, l'80% centrale)
function svg(lato, { tondo, scala }) {
  const r = tondo ? lato * 0.225 : 0, s = lato * scala, o = (lato - s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lato}" height="${lato}" viewBox="0 0 ${lato} ${lato}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1d1d22"/><stop offset="1" stop-color="#08080a"/>
    </linearGradient>
    <radialGradient id="alone" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#e47c50" stop-opacity=".42"/><stop offset="1" stop-color="#e47c50" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="spark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f9c09a"/><stop offset=".48" stop-color="#e98457"/><stop offset="1" stop-color="#b9472b"/>
    </linearGradient>
  </defs>
  <rect width="${lato}" height="${lato}" rx="${r}" fill="url(#fondo)"/>
  <circle cx="${lato / 2}" cy="${lato / 2}" r="${s * 0.62}" fill="url(#alone)"/>
  <g transform="translate(${o} ${o}) scale(${s / 24})">
    <path d="M12 2.2c.75 5.3 4.5 9.05 9.8 9.8-5.3.75-9.05 4.5-9.8 9.8-.75-5.3-4.5-9.05-9.8-9.8 5.3-.75 9.05-4.5 9.8-9.8z" fill="url(#spark)"/>
  </g>
</svg>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fatte = [
    ['icon.png', 512, { tondo: true, scala: 0.62 }],
    ['icon-192.png', 192, { tondo: true, scala: 0.62 }],
    ['icon-maskable.png', 512, { tondo: false, scala: 0.5 }],
    ['apple-touch-icon.png', 180, { tondo: false, scala: 0.6 }]
  ];
  for (const [nome, lato, opz] of fatte) {
    await page.setViewportSize({ width: lato, height: lato });
    await page.setContent('<html><body style="margin:0;background:transparent">' + svg(lato, opz) + '</body></html>');
    await page.screenshot({ path: path.join(APP, nome), omitBackground: opz.tondo, clip: { x: 0, y: 0, width: lato, height: lato } });
    console.log(nome);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
