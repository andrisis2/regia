// Disegna le icone dell'app da un SVG solo: lo scoppio di «Boom», caldo, su fondo quasi nero.
// uso: node test/icone.js   — riscrive icon.png, icon-192.png, icon-maskable.png, apple-touch-icon.png
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const path = require('path');
const APP = path.join(__dirname, '..');

// lo scoppio, in un quadrato di 24 come le icone dell'app (è anche #i-boom in index.html):
// punte di lunghezze diverse, come nei fumetti; dentro, un nucleo più chiaro
const SCOPPIO = 'M11.35 1.12L13.18 6.22L16.50 4.21L16.45 7.55L21.21 7.39L17.49 10.88L20.58 11.48L18.07 13.24L21.53 17.50L16.10 16.10L16.16 20.32L13.28 18.27L12.61 22.08L10.86 17.58L7.60 19.62L7.69 16.31L2.43 16.78L6.12 13.20L2.52 12.57L6.51 10.88L3.34 7.00L7.55 7.55L8.02 4.04L10.82 6.22Z';

// tondo: angoli trasparenti (icone «any»); pieno: tutto il quadrato colorato
// (maskable e iPhone, che gli angoli li taglia da sé); scala: quanto è grande
// lo scoppio (nella maskable deve stare dentro la zona sicura, l'80% centrale)
function svg(lato, { tondo, scala }) {
  const r = tondo ? lato * 0.225 : 0, s = lato * scala, o = (lato - s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lato}" height="${lato}" viewBox="0 0 ${lato} ${lato}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1d1d22"/><stop offset="1" stop-color="#08080a"/>
    </linearGradient>
    <radialGradient id="alone" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#e47c50" stop-opacity=".45"/><stop offset="1" stop-color="#e47c50" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="fuoco" cx="0.5" cy="0.5" r="0.55">
      <stop offset="0" stop-color="#ffd9a8"/><stop offset=".42" stop-color="#f08a52"/><stop offset="1" stop-color="#b6452a"/>
    </radialGradient>
    <radialGradient id="nucleo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff4e2"/><stop offset="1" stop-color="#ffc98f"/>
    </radialGradient>
  </defs>
  <rect width="${lato}" height="${lato}" rx="${r}" fill="url(#fondo)"/>
  <circle cx="${lato / 2}" cy="${lato / 2}" r="${s * 0.64}" fill="url(#alone)"/>
  <g transform="translate(${o} ${o}) scale(${s / 24})">
    <path d="${SCOPPIO}" fill="url(#fuoco)" stroke="url(#fuoco)" stroke-width=".9" stroke-linejoin="round"/>
    <path d="${SCOPPIO}" fill="url(#nucleo)" transform="translate(12 12) rotate(16) scale(.42) translate(-12 -12)"/>
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
