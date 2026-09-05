/**
 * ============================================================
 *  Digital Wedding Bolivia — Cloudflare Worker (Contact Form)
 * ============================================================
 *  Recibe POST /contact desde tu landing en GitHub Pages,
 *  valida los datos, aplica anti-spam y envía el correo
 *  vía Resend a diegogonzales@publicist.com
 * ============================================================
 *
 *  CONFIGURACIÓN EN CLOUDFLARE DASHBOARD:
 *  ───────────────────────────────────────
 *  1. Ve a https://dash.cloudflare.com → Workers & Pages → Create
 *  2. Nombre: "digitalwedding-contact" (o el que quieras)
 *  3. Pega este código en el editor
 *  4. Ve a Settings → Variables → Add:
 *     - RESEND_API_KEY = tu clave de Resend (re_xxxxxxxxxxxx)
 *  5. Guarda y despliega
 *
 *  Tu endpoint será:
 *  https://digitalwedding-contact.<tu-cuenta>.workers.dev/contact
 *
 *  CONFIGURACIÓN EN RESEND:
 *  ────────────────────────
 *  1. Ve a https://resend.com → Sign Up (gratis)
 *  2. Dashboard → API Keys → Create API Key
 *  3. Copia la clave y pégala como variable RESEND_API_KEY en el Worker
 *
 *  Con la cuenta gratuita de Resend, los correos se envían desde
 *  onboarding@resend.dev (el "From"). El destinatario los recibe
 *  normalmente. Si después quieres un "From" personalizado,
 *  puedes verificar tu propio dominio en Resend.
 * ============================================================
 */

// ── Orígenes permitidos (CORS) ─────────────────────────────
// Permitimos '*' para que funcione sin problemas en cualquier puerto local
// o si cambias de dominio en el futuro.
const ORIGENES_PERMITIDOS = '*';

// ── Destinatario ───────────────────────────────────────────
const DESTINATARIO = 'diegogonzales@publicist.com';

// ── Rate limit: máximo de envíos por IP ────────────────────
const RATE_LIMIT_MAX = 3;        // máximo 3 envíos
const RATE_LIMIT_WINDOW = 3600;  // por hora (en segundos)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origen = request.headers.get('Origin') || '';

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

    // ── Validación ───────────────────────────────────────
    const nombre   = limpiar(data.nombre   || '');
    const email    = limpiar(data.email    || '');
    const whatsapp = limpiar(data.whatsapp || '');
    const fecha    = limpiar(data.fecha    || 'No especificada');
    const paquete  = limpiar(data.paquete  || 'No seleccionado');
    const mensaje  = limpiar(data.mensaje  || 'Sin mensaje adicional');

    const errores = [];
    if (nombre.length < 2) errores.push('El nombre es muy corto.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errores.push('El email no es válido.');
    if (whatsapp.replace(/\D/g, '').length < 7) errores.push('El WhatsApp necesita al menos 7 dígitos.');

    if (errores.length) {
      return responder(422, errores.join(' '), corsHeaders);
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

    // ── Construir email HTML ─────────────────────────────
    const waLink = `https://wa.me/${whatsapp.replace(/\D/g, '')}`;

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
        ${nombre} quiere información sobre sus invitaciones
      </p>
    </td>
  </tr>

  <tr>
    <td style="padding:28px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${campo('Nombre', nombre)}
        ${campo('Email', `<a href="mailto:${email}" style="color:#A6831A;text-decoration:none;">${email}</a>`)}
        ${campo('WhatsApp', `<a href="${waLink}" style="color:#A6831A;text-decoration:none;">${whatsapp}</a>`)}
        ${campo('Fecha de boda', fecha)}
        ${campo('Paquete', paquete)}
        <tr>
          <td style="padding:14px 0 4px;">
            <strong style="color:#6B6358;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Mensaje</strong><br>
            <p style="font-size:15px;color:#1C1A16;line-height:1.6;margin:6px 0 0;white-space:pre-wrap;">${mensaje}</p>
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
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Digital Wedding Bolivia <onboarding@resend.dev>',
        to: [DESTINATARIO],
        reply_to: email,
        subject: `💍 Nuevo contacto — ${nombre}`,
        html: htmlEmail
      })
    });

    if (resendRes.ok) {
      return responder(200, '¡Gracias! Tu mensaje fue enviado. Te escribimos pronto.', corsHeaders);
    }

    const errorData = await resendRes.text();
    console.error('Resend error:', resendRes.status, errorData);
    return responder(500, 'No pudimos enviar el correo. Intenta por WhatsApp.', corsHeaders);
  }
};


// ── Funciones auxiliares ─────────────────────────────────────

function limpiar(valor) {
  return valor.trim()
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
