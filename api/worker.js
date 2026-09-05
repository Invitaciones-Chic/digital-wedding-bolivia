/**
 * ============================================================
 *  Digital Wedding Bolivia — Cloudflare Worker (Contact Form)
 * ============================================================
 *  Recibe POST /contact desde la landing en GitHub Pages,
 *  valida los datos, aplica anti-spam y envía el correo
 *  vía Resend al buzón configurado en MAIL_TO.
 * ============================================================
 *
 *  VARIABLES DEL WORKER (Settings → Variables):
 *  ────────────────────────────────────────────
 *  RESEND_API_KEY    (obligatoria, tipo Secret)  re_xxxxxxxxxxxx
 *  MAIL_FROM         (opcional)  remitente; si falta usa el de pruebas
 *  MAIL_TO           (opcional)  destinatario; si falta usa la cuenta Resend
 *  TURNSTILE_SECRET  (opcional, tipo Secret)  clave secreta del widget
 *
 *  ANTI-SPAM EN TRES CAPAS:
 *  ────────────────────────
 *  1. Honeypot   — campo oculto que solo rellenan los bots tontos.
 *  2. Turnstile  — reto de Cloudflare contra bots y automatización.
 *  3. Rate limit — máximo de envíos por IP (requiere el KV "RATE").
 *
 *  Turnstile solo se exige si TURNSTILE_SECRET está configurada. Sin
 *  esa variable el Worker registra un aviso en los logs y deja pasar
 *  el envío, para que el formulario nunca quede bloqueado mientras se
 *  termina de configurar el widget. Configúrala en cuanto tengas el
 *  sitekey puesto en index.html.
 *
 *  Endpoint en producción:
 *  https://digitalwedding-contact.diego-gonzales7891.workers.dev/contact
 *
 *  LÍMITE DEL DOMINIO DE PRUEBA:
 *  ─────────────────────────────
 *  Mientras el "From" sea onboarding@resend.dev (dominio de pruebas
 *  de Resend), la API SOLO acepta como destinatario el correo de la
 *  cuenta de Resend. Cualquier otro destino devuelve 403 "Testing
 *  domain restriction" y el correo nunca se envía. Por eso los
 *  valores por defecto de abajo apuntan a esa cuenta.
 *
 *  PARA RECIBIR EN OTRA DIRECCIÓN (p. ej. publicist.com):
 *  ──────────────────────────────────────────────────────
 *  1. Resend → Domains → verificar send.digitalweddingbolivia.dpdns.org
 *     (1 TXT de DKIM + 2 CNAME de SPF en Cloudflare, todos "DNS only").
 *  2. Con el dominio en Verified, añadir en el Worker:
 *     MAIL_FROM = Digital Wedding Bolivia <contacto@send.digitalweddingbolivia.dpdns.org>
 *     MAIL_TO   = diegogonzales@publicist.com
 *  No hay que tocar este código: las variables mandan sobre los
 *  valores por defecto.
 * ============================================================
 */

// ── Orígenes permitidos (CORS) ─────────────────────────────
// '*' para que funcione en cualquier puerto local y si cambia el dominio.
const ORIGENES_PERMITIDOS = '*';

// ── Remitente y destinatario por defecto ───────────────────
// Solo se usan si no existen las variables MAIL_FROM / MAIL_TO.
const REMITENTE_POR_DEFECTO    = 'Digital Wedding Bolivia <onboarding@resend.dev>';
const DESTINATARIO_POR_DEFECTO = 'diego.gonzales7891@gmail.com';

// ── Endpoint de validación de Turnstile ────────────────────
const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// ── Rate limit: máximo de envíos por IP ────────────────────
const RATE_LIMIT_MAX = 3;        // máximo 3 envíos
const RATE_LIMIT_WINDOW = 3600;  // por hora (en segundos)

// ── Largo máximo por campo (corta payloads abusivos) ───────
const LARGO_MAXIMO = {
  nombre: 120, email: 160, whatsapp: 40,
  fecha: 40, paquete: 80, mensaje: 3000
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── CORS Headers ─────────────────────────────────────
    const corsHeaders = {
      'Access-Control-Allow-Origin': ORIGENES_PERMITIDOS,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Solo responder en /contact
    if (url.pathname !== '/contact') {
      return responder(404, 'No encontrado.', corsHeaders);
    }

    // Solo POST
    if (request.method !== 'POST') {
      return responder(405, 'Método no permitido.', corsHeaders);
    }

    // ── Leer y parsear JSON ──────────────────────────────
    let data;
    try {
      data = await request.json();
    } catch {
      return responder(400, 'Datos inválidos.', corsHeaders);
    }

    // ── Honeypot: campo oculto que los bots rellenan ─────
    if (data.website) {
      // Respuesta falsa al bot — cree que tuvo éxito
      return responder(200, '¡Gracias! Tu mensaje fue enviado.', corsHeaders);
    }

    // ── Normalización ────────────────────────────────────
    // Los valores se guardan en crudo (sin escapar) porque también
    // alimentan la versión en texto plano del correo. El escapado
    // HTML se aplica solo al interpolar dentro de la plantilla.
    const nombre   = normalizar(data.nombre,   LARGO_MAXIMO.nombre);
    const email    = normalizar(data.email,    LARGO_MAXIMO.email);
    const whatsapp = normalizar(data.whatsapp, LARGO_MAXIMO.whatsapp);
    const fecha    = normalizar(data.fecha,    LARGO_MAXIMO.fecha)   || 'No especificada';
    const paquete  = normalizar(data.paquete,  LARGO_MAXIMO.paquete) || 'No seleccionado';
    const mensaje  = normalizar(data.mensaje,  LARGO_MAXIMO.mensaje, true) || 'Sin mensaje adicional';

    // ── Validación ───────────────────────────────────────
    const errores = [];
    if (nombre.length < 2) errores.push('El nombre es muy corto.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errores.push('El email no es válido.');
    if (whatsapp.replace(/\D/g, '').length < 7) errores.push('El WhatsApp necesita al menos 7 dígitos.');

    if (errores.length) {
      return responder(422, errores.join(' '), corsHeaders);
    }

    // ── Turnstile: reto anti-bot de Cloudflare ───────────
    // Va después de la validación a propósito: cada token sirve una
    // sola vez y caduca a los 5 minutos, así que no se gasta uno en
    // un envío que igualmente iba a rebotar por datos incompletos.
    if (env.TURNSTILE_SECRET) {
      const token = typeof data.turnstile === 'string' ? data.turnstile : '';

      if (!token) {
        return responder(403, 'Falta la verificación anti-robots. Recarga la página e inténtalo de nuevo.', corsHeaders);
      }

      const verificacion = await fetch(TURNSTILE_VERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET,
          response: token,
          remoteip: request.headers.get('CF-Connecting-IP') || undefined
        })
      });

      const resultado = await verificacion.json().catch(() => ({ success: false }));

      if (!resultado.success) {
        console.warn('Turnstile rechazado:', resultado['error-codes']);
        return responder(403, 'No pudimos verificar que seas una persona. Recarga la página o escríbenos por WhatsApp.', corsHeaders);
      }
    } else {
      // Aviso visible en los logs para que no pase inadvertido que la
      // capa anti-bot está apagada.
      console.warn('TURNSTILE_SECRET no configurada: envío aceptado sin verificar.');
    }

    // ── Rate limit (usando KV si está disponible) ────────
    // Si configuraste un KV namespace llamado "RATE" en el Worker:
    if (env.RATE) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const clave = `rate:${ip}`;
      const registro = await env.RATE.get(clave, { type: 'json' });

      if (registro && registro.count >= RATE_LIMIT_MAX) {
        return responder(429, 'Demasiados envíos. Intenta más tarde o escríbenos por WhatsApp.', corsHeaders);
      }

      const nuevoConteo = registro ? registro.count + 1 : 1;
      await env.RATE.put(clave, JSON.stringify({ count: nuevoConteo }), {
        expirationTtl: RATE_LIMIT_WINDOW
      });
    }

    const waLink = `https://wa.me/${whatsapp.replace(/\D/g, '')}`;

    // ── Versión en texto plano ───────────────────────────
    // Un correo con html + text pasa mejor los filtros de spam que
    // uno solo-HTML, y se lee bien en cualquier cliente.
    const textoEmail = [
      'NUEVO MENSAJE DE CONTACTO',
      `${nombre} quiere información sobre sus invitaciones`,
      '',
      `Nombre:         ${nombre}`,
      `Email:          ${email}`,
      `WhatsApp:       ${whatsapp}`,
      `Fecha de boda:  ${fecha}`,
      `Paquete:        ${paquete}`,
      '',
      'Mensaje:',
      mensaje,
      '',
      `Responder por WhatsApp: ${waLink}`,
      '',
      '— Enviado desde digitalweddingbolivia.dpdns.org'
    ].join('\n');

    // ── Versión HTML ─────────────────────────────────────
    const htmlEmail = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF8F4;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(28,26,22,.08);">

  <tr>
    <td style="background:linear-gradient(135deg,#1C1A16,#33302A);padding:28px 32px;text-align:center;">
      <h1 style="margin:0;font-size:20px;font-weight:600;color:#C9A227;letter-spacing:.5px;">
        ✉️ Nuevo mensaje de contacto
      </h1>
      <p style="margin:6px 0 0;font-size:13px;color:#A9A091;">
        ${escapar(nombre)} quiere información sobre sus invitaciones
      </p>
    </td>
  </tr>

  <tr>
    <td style="padding:28px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${campo('Nombre', escapar(nombre))}
        ${campo('Email', `<a href="mailto:${escapar(email)}" style="color:#A6831A;text-decoration:none;">${escapar(email)}</a>`)}
        ${campo('WhatsApp', `<a href="${waLink}" style="color:#A6831A;text-decoration:none;">${escapar(whatsapp)}</a>`)}
        ${campo('Fecha de boda', escapar(fecha))}
        ${campo('Paquete', escapar(paquete))}
        <tr>
          <td style="padding:14px 0 4px;">
            <strong style="color:#6B6358;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Mensaje</strong><br>
            <p style="font-size:15px;color:#1C1A16;line-height:1.6;margin:6px 0 0;white-space:pre-wrap;">${escapar(mensaje)}</p>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
        <tr><td align="center">
          <a href="${waLink}" target="_blank"
             style="display:inline-block;background:#25D366;color:#fff;font-size:14px;font-weight:600;
                    padding:12px 28px;border-radius:50px;text-decoration:none;">
            Responder por WhatsApp →
          </a>
        </td></tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="background:#FAF8F4;padding:18px 32px;text-align:center;border-top:1px solid #E7E1D5;">
      <p style="margin:0;font-size:11px;color:#A9A091;">
        Enviado desde digitalweddingbolivia.dpdns.org
      </p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;

    // ── Enviar vía Resend API ────────────────────────────
    // Nombres de campo según la referencia REST de Resend:
    // reply_to en snake_case (replyTo es la forma del SDK de Node).
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.MAIL_FROM || REMITENTE_POR_DEFECTO,
        to: [env.MAIL_TO || DESTINATARIO_POR_DEFECTO],
        reply_to: [email],
        subject: `💍 Nuevo contacto — ${nombre}`,
        html: htmlEmail,
        text: textoEmail
      })
    });

    if (resendRes.ok) {
      return responder(200, '¡Gracias! Tu mensaje fue enviado. Te escribimos pronto.', corsHeaders);
    }

    // El detalle queda en los logs del Worker (wrangler tail o el
    // dashboard); al visitante solo se le da una salida alternativa.
    const errorData = await resendRes.text();
    console.error('Resend error:', resendRes.status, errorData);
    return responder(500, 'No pudimos enviar el correo. Intenta por WhatsApp.', corsHeaders);
  }
};


// ── Funciones auxiliares ─────────────────────────────────────

// Recorta, limita el largo y quita caracteres de control.
// multilinea=true conserva los saltos de línea del mensaje.
function normalizar(valor, maximo, multilinea = false) {
  if (typeof valor !== 'string') return '';
  const control = multilinea ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g;
  return valor.replace(control, ' ').trim().slice(0, maximo);
}

// Escapa para interpolar dentro del HTML del correo.
function escapar(valor) {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function responder(codigo, mensaje, headers = {}) {
  return new Response(
    JSON.stringify({
      ok: codigo >= 200 && codigo < 300,
      mensaje
    }),
    {
      status: codigo,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
    }
  );
}

function campo(label, valor) {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #F2EEE6;">
        <strong style="color:#6B6358;font-size:12px;text-transform:uppercase;letter-spacing:1px;">${label}</strong><br>
        <span style="font-size:15px;color:#1C1A16;">${valor}</span>
      </td>
    </tr>`;
}
