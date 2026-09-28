#!/usr/bin/env node
/*
 * Cambia el dominio del sitio en todos los archivos que lo nombran
 * (canonical, Open Graph, JSON-LD, robots.txt, sitemap.xml, llms.txt,
 * CNAME y el worker de contacto).
 *
 *   npm run dominio -- digitalweddingbolivia.com
 *
 * El dominio actual se lee de CNAME, que es la fuente de verdad para
 * GitHub Pages. Despues de correrlo:
 *   1. Revisar el diff y subir los cambios.
 *   2. GitHub → Settings → Pages: confirmar el dominio nuevo y HTTPS.
 *   3. Cloudflare (zona del dominio viejo): regla de redireccion 301 de
 *      todo el dominio viejo hacia el nuevo, conservando la ruta.
 *   4. Search Console: "Cambio de direccion" del dominio viejo al nuevo.
 *   5. Volver a desplegar el worker (api/worker.js) y verificar el dominio
 *      de envio en Resend.
 */
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const nuevo = (process.argv[2] || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');

if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(nuevo)) {
  console.error('Uso: npm run dominio -- midominio.com');
  process.exit(1);
}

const actual = fs.readFileSync(path.join(raiz, 'CNAME'), 'utf8').trim();
if (actual === nuevo) {
  console.log(`El sitio ya usa ${nuevo}.`);
  process.exit(0);
}

const ignorar = new Set(['node_modules', '.git']);
const extensiones = new Set(['.html', '.txt', '.xml', '.js', '.md', '']);

function recorrer(dir, salida = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignorar.has(entrada.name)) continue;
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) recorrer(ruta, salida);
    else if (extensiones.has(path.extname(entrada.name))) salida.push(ruta);
  }
  return salida;
}

let total = 0;
for (const archivo of recorrer(raiz)) {
  if (archivo === __filename) continue;
  const texto = fs.readFileSync(archivo, 'utf8');
  const veces = texto.split(actual).length - 1;
  if (!veces) continue;
  fs.writeFileSync(archivo, texto.split(actual).join(nuevo));
  console.log(`${String(veces).padStart(3)}  ${path.relative(raiz, archivo)}`);
  total += veces;
}

console.log(`\n${total} reemplazos: ${actual} → ${nuevo}`);
