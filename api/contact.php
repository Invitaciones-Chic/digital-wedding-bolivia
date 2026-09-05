<?php
/**
 * ============================================================
 *  Digital Wedding Bolivia — Backend de contacto
 * ============================================================
 *  Recibe los datos del formulario vía POST (JSON),
 *  los valida, aplica protección anti-spam y envía
 *  el correo a diegogonzales@publicist.com
 * ============================================================
 */

// ── Configuración ──────────────────────────────────────────
define('DESTINATARIO',  'diegogonzales@publicist.com');
define('SITIO_NOMBRE',  'Digital Wedding Bolivia');
define('RATE_LIMIT_SEG', 60);   // 1 envío por IP cada 60 segundos
define('RATE_LIMIT_DIR', __DIR__ . '/rate_logs');

// ── CORS: permitir solo tu dominio ─────────────────────────
$origenesPermitidos = [
    'https://digitalweddingbolivia.dpdns.org',
    'http://localhost',
    'http://127.0.0.1'
];

$origen = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origen, $origenesPermitidos, true)) {
    header("Access-Control-Allow-Origin: $origen");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// Preflight (CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Solo POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder(405, 'Método no permitido.');
}

// ── Leer JSON del body ─────────────────────────────────────
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    responder(400, 'Datos inválidos.');
}

// ── Honeypot: campo oculto que los bots rellenan ───────────
if (!empty($data['website'] ?? '')) {
    // Un humano nunca llena este campo (está oculto con CSS).
    responder(200, '¡Gracias! Tu mensaje fue enviado.');  // respuesta falsa al bot
}

// ── Validación ─────────────────────────────────────────────
$nombre   = limpiar($data['nombre']   ?? '');
$email    = limpiar($data['email']    ?? '');
$whatsapp = limpiar($data['whatsapp'] ?? '');
$fecha    = limpiar($data['fecha']    ?? 'No especificada');
$paquete  = limpiar($data['paquete']  ?? 'No seleccionado');
$mensaje  = limpiar($data['mensaje']  ?? 'Sin mensaje adicional');

$errores = [];

if (mb_strlen($nombre) < 2) {
    $errores[] = 'El nombre es muy corto.';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errores[] = 'El email no es válido.';
}
if (strlen(preg_replace('/\D/', '', $whatsapp)) < 7) {
    $errores[] = 'El WhatsApp necesita al menos 7 dígitos.';
}

if ($errores) {
    responder(422, implode(' ', $errores));
}

// ── Rate limit por IP ──────────────────────────────────────
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

if (!is_dir(RATE_LIMIT_DIR)) {
    @mkdir(RATE_LIMIT_DIR, 0700, true);
}

$archivoIP = RATE_LIMIT_DIR . '/' . md5($ip) . '.txt';

if (file_exists($archivoIP)) {
    $ultimoEnvio = (int) file_get_contents($archivoIP);
    if ((time() - $ultimoEnvio) < RATE_LIMIT_SEG) {
        $restante = RATE_LIMIT_SEG - (time() - $ultimoEnvio);
        responder(429, "Espera {$restante} segundos antes de enviar otro mensaje.");
    }
}

// Registrar este envío
file_put_contents($archivoIP, time(), LOCK_EX);

// Limpiar logs viejos (> 1 hora) cada cierto tiempo
if (rand(1, 10) === 1) {
    limpiarLogs();
}

// ── Construir y enviar el correo ───────────────────────────
$asunto = "💍 Nuevo contacto desde " . SITIO_NOMBRE . " — $nombre";

$cuerpo = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#FAF8F4; font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4; padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(28,26,22,.08);">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#1C1A16 0%,#33302A 100%); padding:28px 32px; text-align:center;">
      <h1 style="margin:0; font-size:20px; font-weight:600; color:#C9A227; letter-spacing:0.5px;">
        ✉️ Nuevo mensaje de contacto
      </h1>
      <p style="margin:6px 0 0; font-size:13px; color:#A9A091;">
        {$nombre} quiere información sobre sus invitaciones
      </p>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:28px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #F2EEE6;">
            <strong style="color:#6B6358; font-size:12px; text-transform:uppercase; letter-spacing:1px;">Nombre</strong><br>
            <span style="font-size:15px; color:#1C1A16;">{$nombre}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #F2EEE6;">
            <strong style="color:#6B6358; font-size:12px; text-transform:uppercase; letter-spacing:1px;">Email</strong><br>
            <a href="mailto:{$email}" style="font-size:15px; color:#A6831A; text-decoration:none;">{$email}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #F2EEE6;">
            <strong style="color:#6B6358; font-size:12px; text-transform:uppercase; letter-spacing:1px;">WhatsApp</strong><br>
            <a href="https://wa.me/{$whatsapp}" style="font-size:15px; color:#A6831A; text-decoration:none;">{$whatsapp}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #F2EEE6;">
            <strong style="color:#6B6358; font-size:12px; text-transform:uppercase; letter-spacing:1px;">Fecha de boda</strong><br>
            <span style="font-size:15px; color:#1C1A16;">{$fecha}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #F2EEE6;">
            <strong style="color:#6B6358; font-size:12px; text-transform:uppercase; letter-spacing:1px;">Paquete</strong><br>
            <span style="font-size:15px; color:#1C1A16;">{$paquete}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0 4px;">
            <strong style="color:#6B6358; font-size:12px; text-transform:uppercase; letter-spacing:1px;">Mensaje</strong><br>
            <p style="font-size:15px; color:#1C1A16; line-height:1.6; margin:6px 0 0; white-space:pre-wrap;">{$mensaje}</p>
          </td>
        </tr>
      </table>

      <!-- Botón WhatsApp -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
        <tr><td align="center">
          <a href="https://wa.me/{$whatsapp}" target="_blank"
             style="display:inline-block; background:#25D366; color:#fff; font-size:14px; font-weight:600;
                    padding:12px 28px; border-radius:50px; text-decoration:none; letter-spacing:0.3px;">
            Responder por WhatsApp →
          </a>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#FAF8F4; padding:18px 32px; text-align:center; border-top:1px solid #E7E1D5;">
      <p style="margin:0; font-size:11px; color:#A9A091;">
        Enviado automáticamente desde digitalweddingbolivia.dpdns.org
      </p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>
HTML;

$headers  = "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";
$headers .= "From: " . SITIO_NOMBRE . " <noreply@digitalweddingbolivia.dpdns.org>\r\n";
$headers .= "Reply-To: {$nombre} <{$email}>\r\n";
$headers .= "X-Mailer: DigitalWeddingBolivia/1.0\r\n";

$enviado = mail(DESTINATARIO, $asunto, $cuerpo, $headers);

if ($enviado) {
    responder(200, '¡Gracias! Tu mensaje fue enviado. Te escribimos pronto.');
} else {
    responder(500, 'No pudimos enviar el correo. Intenta por WhatsApp.');
}


// ── Funciones auxiliares ───────────────────────────────────

function limpiar($valor) {
    return htmlspecialchars(trim($valor), ENT_QUOTES, 'UTF-8');
}

function responder($codigo, $mensaje) {
    http_response_code($codigo);
    echo json_encode([
        'ok'      => $codigo >= 200 && $codigo < 300,
        'mensaje' => $mensaje
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function limpiarLogs() {
    $archivos = glob(RATE_LIMIT_DIR . '/*.txt');
    $ahora = time();
    foreach ($archivos as $archivo) {
        $tiempo = (int) file_get_contents($archivo);
        if (($ahora - $tiempo) > 3600) {
            @unlink($archivo);
        }
    }
}
