/*
 * Temporada navideña (ver navidad.css).
 *  - Pop-up "Promoción navideña": se abre en CADA visita a la página de
 *    inicio del dominio principal (no en subdominios ni en otras rutas),
 *    apenas termina de leerse el HTML. Se cierra con la X, Esc o tocando fuera.
 *  - Nieve, guirnalda de luces y accesos para volver a abrir la promoción.
 *  - Todo se apaga solo después de FIN_TEMPORADA.
 */
(function () {
    'use strict';

    var DOMINIO = 'digitalweddingbolivia.dpdns.org';
    var FIN_TEMPORADA = new Date('2027-01-07T00:00:00-04:00');
    var IMAGEN = '/assets/promo-navidad.webp';
    var ENLACE = 'https://invitacion-navidea.dwb-demo.workers.dev/';

    if (new Date() >= FIN_TEMPORADA) return;

    var html = document.documentElement;
    var movil = window.matchMedia('(max-width: 639px)').matches;

    var ICONO_REGALO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C9 3 11 5 12 8c1-3 3-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';
    var ICONO_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

    /* ---------- Nieve: copos de CSS, los anima la GPU ---------- */
    function nieve(clase, cantidad, tamMin, tamMax) {
        var capa = document.createElement('div');
        capa.className = 'xmas-snow ' + clase;
        capa.setAttribute('aria-hidden', 'true');
        var copos = '';
        for (var i = 0; i < cantidad; i++) {
            var t = 9 + Math.random() * 9;                       // segundos en caer
            copos += '<i class="xmas-flake" style="' +
                '--x:' + (Math.random() * 100).toFixed(2) + '%;' +
                '--s:' + (tamMin + Math.random() * (tamMax - tamMin)).toFixed(1) + 'px;' +
                '--o:' + (.55 + Math.random() * .45).toFixed(2) + ';' +
                '--w:' + (10 + Math.random() * 25).toFixed(0) + 'px;' +
                '--t:' + t.toFixed(1) + 's;' +
                '--d:' + (-Math.random() * t).toFixed(1) + 's"></i>';  // negativo: ya está cayendo al cargar
        }
        capa.innerHTML = copos;
        return capa;
    }

    /* ---------- Pop-up ---------- */
    var dialogo = document.createElement('dialog');
    dialogo.className = 'xmas-dialog';
    dialogo.setAttribute('aria-labelledby', 'xmas-titulo');
    // El foco inicial va al propio pop-up (no a la X), así no aparece un anillo de foco al abrir.
    dialogo.setAttribute('autofocus', '');
    dialogo.tabIndex = -1;
    dialogo.innerHTML =
        '<div class="xmas-dialog__veil"></div>' +
        '<button type="button" class="xmas-dialog__close" aria-label="Cerrar promoción">' + ICONO_X + '</button>' +
        '<div class="xmas-dialog__scroll">' +
            '<div class="xmas-dialog__panel">' +
                '<span class="xmas-dialog__eyebrow">Temporada 2026</span>' +
                '<h2 id="xmas-titulo" class="xmas-dialog__title">Promoción Navideña</h2>' +
                '<figure class="xmas-dialog__figure">' +
                    '<img src="' + IMAGEN + '" alt="Adorno navideño dorado de Digital Wedding Bolivia: Invitación navideña corporativo" width="820" height="820" fetchpriority="high">' +
                    '<div class="xmas-dialog__cta-wrap">' +
                        '<a class="rainbow-border" href="' + ENLACE + '" target="_blank" rel="noopener">' +
                            '<span class="rainbow-border__glow" aria-hidden="true"></span>' +
                            '<span class="rainbow-border__inner">' + ICONO_REGALO + '<span>Quiero la promoción</span></span>' +
                        '</a>' +
                    '</div>' +
                '</figure>' +
                '<p class="xmas-dialog__note">Invitaciones digitales para tu evento corporativo de fin de año.</p>' +
            '</div>' +
        '</div>';
    dialogo.insertBefore(nieve('xmas-snow--modal', movil ? 22 : 34, 3, 8), dialogo.firstChild.nextSibling);
    document.body.appendChild(dialogo);

    var cerrando = false;

    function abrir() {
        if (dialogo.open) return;
        cerrando = false;
        dialogo.classList.remove('is-closing');
        html.classList.add('xmas-open');
        try { dialogo.showModal(); }
        catch (e) { dialogo.setAttribute('open', ''); }      // navegadores sin showModal
        dialogo.focus({ preventScroll: true });
    }

    function terminar() {
        cerrando = false;
        dialogo.classList.remove('is-closing');
        if (dialogo.open) {
            if (typeof dialogo.close === 'function') dialogo.close();
            else dialogo.removeAttribute('open');
        }
        html.classList.remove('xmas-open');
    }

    function cerrar() {
        if (!dialogo.open || cerrando) return;
        cerrando = true;
        dialogo.classList.add('is-closing');
        setTimeout(terminar, 230);
    }

    dialogo.addEventListener('close', function () { html.classList.remove('xmas-open'); });
    dialogo.addEventListener('cancel', function (e) { e.preventDefault(); cerrar(); });   // tecla Esc
    dialogo.querySelector('.xmas-dialog__close').addEventListener('click', cerrar);
    dialogo.addEventListener('click', function (e) {
        // Tocar fuera del contenido (el fondo oscuro) también cierra.
        if (e.target === dialogo || e.target.classList.contains('xmas-dialog__scroll')) cerrar();
    });

    /* Apertura: en cada visita, solo en la página de inicio del dominio principal. */
    var host = location.hostname.toLowerCase();
    var esDominioPrincipal = host === DOMINIO || host === 'www.' + DOMINIO ||
        host === 'localhost' || host === '127.0.0.1';      // local, para probar
    var esInicio = location.pathname === '/' || location.pathname === '/index.html';
    if (esDominioPrincipal && esInicio) abrir();

    /* ---------- Decoración (después del primer pintado, para no frenar la carga) ---------- */
    function decorar() {
        document.body.appendChild(nieve('xmas-snow--page', movil ? 12 : 22, 4, 8));

        var navbar = document.getElementById('navbar');
        if (navbar) {
            var luces = document.createElement('div');
            luces.className = 'xmas-lights';
            luces.setAttribute('aria-hidden', 'true');
            navbar.appendChild(luces);
            var colores = ['#E0263F', '#E3B341', '#1F8A4C', '#F4F1E8'];
            var ancho = 0;
            var pintar = function () {
                if (navbar.clientWidth === ancho) return;
                ancho = navbar.clientWidth;
                var total = Math.ceil(ancho / 48), h = '';
                for (var i = 0; i < total; i++) {
                    h += '<span class="xmas-bulb" style="left:' + (i * 48 + 24) + 'px;--c:' +
                        colores[i % 4] + ';--d:' + ((i % 5) * -.45).toFixed(2) + 's"></span>';
                }
                luces.innerHTML = h;
            };
            pintar();
            var espera;
            window.addEventListener('resize', function () {
                clearTimeout(espera);
                espera = setTimeout(pintar, 200);
            }, { passive: true });
        }

        var fab = document.createElement('button');
        fab.type = 'button';
        fab.className = 'xmas-fab';
        fab.setAttribute('aria-label', 'Ver la promoción navideña');
        fab.innerHTML = '<span class="xmas-fab__icon">' + ICONO_REGALO + '</span><span class="xmas-fab__label">Promo navideña</span>';
        fab.addEventListener('click', abrir);
        document.body.appendChild(fab);

        var eyebrow = document.querySelector('#inicio .eyebrow');
        if (eyebrow && eyebrow.parentElement && eyebrow.parentElement.parentElement) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'xmas-chip';
            chip.innerHTML = '<span class="xmas-chip__icon">' + ICONO_REGALO + '</span>Promoción navideña · Ver detalles';
            chip.addEventListener('click', abrir);
            var envoltura = document.createElement('div');
            envoltura.appendChild(chip);
            eyebrow.parentElement.parentElement.insertBefore(envoltura, eyebrow.parentElement);
        }
    }
    requestAnimationFrame(function () { setTimeout(decorar, 0); });
})();
