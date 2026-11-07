/*
 * Temporada navideña (ver navidad.css).
 *  - Nieve, guirnalda de luces y accesos a la promoción en la página de inicio.
 *  - Pop-up "Promoción navideña" que se abre solo al llegar al dominio
 *    principal (no en subdominios ni en otras rutas), una vez por sesión.
 *  - Todo se apaga solo después de FIN_TEMPORADA.
 */
(function () {
    'use strict';

    var DOMINIO = 'digitalweddingbolivia.dpdns.org';
    var FIN_TEMPORADA = new Date('2027-01-07T00:00:00-04:00');
    var CLAVE_SESION = 'dwb-promo-navidad-vista';
    var IMAGEN = '/assets/promo-navidad.png';
    var WHATSAPP = 'https://wa.me/59178216419?text=' + encodeURIComponent(
        'Hola, quiero la promoción navideña de invitaciones digitales corporativas.');

    if (new Date() >= FIN_TEMPORADA) return;

    var reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var ICONO_REGALO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C9 3 11 5 12 8c1-3 3-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';
    var ICONO_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

    /* ---------- Nieve en canvas ---------- */
    function crearCopo(color, borde) {
        var s = 32, c = document.createElement('canvas');
        c.width = c.height = s;
        var g = c.getContext('2d');
        var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        r.addColorStop(0, color);
        r.addColorStop(.55, color);
        r.addColorStop(.75, borde);
        r.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = r;
        g.fillRect(0, 0, s, s);
        return c;
    }

    function Nieve(canvas, opciones) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.densidad = opciones.densidad;      // copos por cada 10.000 px²
        this.maximo = opciones.maximo;
        this.sprite = opciones.sprite;
        this.copos = [];
        this.activo = false;
        this.ultimo = 0;
        this._cuadro = this.cuadro.bind(this);
        this._medir = this.medir.bind(this);
    }
    Nieve.prototype.medir = function () {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = this.canvas.clientWidth;
        this.h = this.canvas.clientHeight;
        this.canvas.width = Math.round(this.w * dpr);
        this.canvas.height = Math.round(this.h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var n = Math.min(this.maximo, Math.round(this.w * this.h / 10000 * this.densidad));
        while (this.copos.length < n) this.copos.push(this.nuevo(true));
        this.copos.length = n;
    };
    Nieve.prototype.nuevo = function (enCualquierAltura) {
        var z = Math.random();                   // profundidad: los cercanos son grandes y rápidos
        return {
            x: Math.random() * (this.w || window.innerWidth),
            y: enCualquierAltura ? Math.random() * (this.h || window.innerHeight) : -12,
            r: 2 + z * 4.5,
            v: 18 + z * 42,                       // px por segundo
            fase: Math.random() * Math.PI * 2,
            amplitud: 10 + Math.random() * 22,
            alfa: .45 + z * .5
        };
    };
    Nieve.prototype.cuadro = function (t) {
        if (!this.activo) return;
        var dt = Math.min((t - (this.ultimo || t)) / 1000, .05);
        this.ultimo = t;
        var ctx = this.ctx, w = this.w, h = this.h;
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < this.copos.length; i++) {
            var c = this.copos[i];
            c.y += c.v * dt;
            c.fase += dt * .8;
            var x = c.x + Math.sin(c.fase) * c.amplitud;
            if (c.y > h + 12) { this.copos[i] = this.nuevo(false); continue; }
            ctx.globalAlpha = c.alfa;
            ctx.drawImage(this.sprite, x - c.r, c.y - c.r, c.r * 2, c.r * 2);
        }
        ctx.globalAlpha = 1;
        requestAnimationFrame(this._cuadro);
    };
    Nieve.prototype.iniciar = function () {
        if (this.activo) return;
        this.medir();
        this.activo = true;
        this.ultimo = 0;
        window.addEventListener('resize', this._medir);
        requestAnimationFrame(this._cuadro);
    };
    Nieve.prototype.detener = function () {
        this.activo = false;
        window.removeEventListener('resize', this._medir);
        this.ctx.clearRect(0, 0, this.w || 0, this.h || 0);
    };

    // Sobre fondo blanco un copo blanco no se ve: el de la página lleva un borde azul grisáceo.
    var spritePagina = crearCopo('rgba(255,255,255,1)', 'rgba(120,145,175,.55)');
    var spriteModal = crearCopo('rgba(255,255,255,1)', 'rgba(255,255,255,.35)');

    var nievePagina = null;
    if (!reducirMovimiento) {
        var lienzo = document.createElement('canvas');
        lienzo.className = 'xmas-snow';
        lienzo.setAttribute('aria-hidden', 'true');
        document.body.appendChild(lienzo);
        nievePagina = new Nieve(lienzo, {
            densidad: window.innerWidth < 640 ? .8 : .55, maximo: 140, sprite: spritePagina
        });
        nievePagina.iniciar();
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) nievePagina.detener();
            else if (!dialogo || !dialogo.open) nievePagina.iniciar();
        });
    }

    /* ---------- Guirnalda bajo el navbar ---------- */
    var navbar = document.getElementById('navbar');
    if (navbar) {
        var luces = document.createElement('div');
        luces.className = 'xmas-lights';
        luces.setAttribute('aria-hidden', 'true');
        navbar.appendChild(luces);
        var colores = ['#E0263F', '#E3B341', '#1F8A4C', '#F4F1E8'];
        var pintarLuces = function () {
            var total = Math.ceil(navbar.clientWidth / 48);
            var html = '';
            for (var i = 0; i < total; i++) {
                html += '<span class="xmas-bulb" style="left:' + (i * 48 + 24) + 'px;--c:' +
                    colores[i % colores.length] + ';--d:' + ((i % 5) * -.45).toFixed(2) + 's"></span>';
            }
            luces.innerHTML = html;
        };
        pintarLuces();
        window.addEventListener('resize', pintarLuces);
    }

    /* ---------- Pop-up ---------- */
    var dialogo = document.createElement('dialog');
    dialogo.className = 'xmas-dialog';
    dialogo.setAttribute('aria-labelledby', 'xmas-titulo');
    dialogo.innerHTML =
        '<div class="xmas-dialog__veil" data-cerrar></div>' +
        '<canvas class="xmas-dialog__snow" aria-hidden="true"></canvas>' +
        '<button type="button" class="xmas-dialog__close" data-cerrar aria-label="Cerrar promoción">' + ICONO_X + '</button>' +
        '<div class="xmas-dialog__scroll" data-cerrar>' +
            '<div class="xmas-dialog__panel">' +
                '<span class="xmas-dialog__eyebrow">Temporada 2026</span>' +
                '<h2 id="xmas-titulo" class="xmas-dialog__title">Promoción Navideña</h2>' +
                '<figure class="xmas-dialog__figure">' +
                    '<img src="" alt="Adorno navideño dorado de Digital Wedding Bolivia: Invitación navideña corporativo" width="1254" height="1254" decoding="async">' +
                    '<div class="xmas-dialog__cta-wrap">' +
                        '<a class="rainbow-border" href="' + WHATSAPP + '" target="_blank" rel="noopener" autofocus>' +
                            ICONO_REGALO + '<span>Quiero la promoción</span>' +
                        '</a>' +
                    '</div>' +
                '</figure>' +
                '<p class="xmas-dialog__note">Invitaciones digitales para tu evento corporativo de fin de año.</p>' +
            '</div>' +
        '</div>';
    document.body.appendChild(dialogo);

    var imagen = dialogo.querySelector('img');
    var nieveModal = reducirMovimiento ? null : new Nieve(dialogo.querySelector('.xmas-dialog__snow'), {
        densidad: 1, maximo: 220, sprite: spriteModal
    });

    function cargarImagen() {
        if (!imagen.getAttribute('src')) imagen.src = IMAGEN;
        return imagen.decode ? imagen.decode().catch(function () {}) : Promise.resolve();
    }

    function abrir() {
        if (dialogo.open) return;
        cargarImagen().then(function () {
            if (dialogo.open) return;
            document.documentElement.classList.add('xmas-lock');
            dialogo.classList.remove('is-closing');
            dialogo.showModal();
            if (nievePagina) nievePagina.detener();
            if (nieveModal) nieveModal.iniciar();
            try { sessionStorage.setItem(CLAVE_SESION, '1'); } catch (e) {}
        });
    }

    function cerrar() {
        if (!dialogo.open || dialogo.classList.contains('is-closing')) return;
        var terminar = function () {
            dialogo.close();
            dialogo.classList.remove('is-closing');
        };
        if (reducirMovimiento) return terminar();
        dialogo.classList.add('is-closing');
        setTimeout(terminar, 280);
    }

    dialogo.addEventListener('close', function () {
        document.documentElement.classList.remove('xmas-lock');
        if (nieveModal) nieveModal.detener();
        if (nievePagina && !document.hidden) nievePagina.iniciar();
    });
    dialogo.addEventListener('cancel', function (e) { e.preventDefault(); cerrar(); });
    dialogo.addEventListener('click', function (e) {
        // Cierra al tocar fuera del adorno (el velo, el área vacía o la X).
        var objetivo = e.target.closest('[data-cerrar], .xmas-dialog__panel');
        if (objetivo && objetivo.hasAttribute('data-cerrar') && !e.target.closest('.xmas-dialog__figure')) cerrar();
    });
    dialogo.querySelector('.rainbow-border').addEventListener('click', function () { setTimeout(cerrar, 150); });

    /* ---------- Accesos para volver a ver la promoción ---------- */
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'xmas-fab';
    fab.setAttribute('aria-label', 'Ver la promoción navideña');
    fab.innerHTML = '<span class="xmas-fab__icon">' + ICONO_REGALO + '</span><span class="xmas-fab__label">Promo navideña</span>';
    fab.addEventListener('click', abrir);
    document.body.appendChild(fab);

    var eyebrow = document.querySelector('#inicio .eyebrow');
    if (eyebrow && eyebrow.parentElement) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'xmas-chip';
        chip.innerHTML = '<span class="xmas-chip__icon">' + ICONO_REGALO + '</span>Promoción navideña · Ver detalles';
        chip.addEventListener('click', abrir);
        var envoltura = document.createElement('div');
        envoltura.appendChild(chip);
        eyebrow.parentElement.parentElement.insertBefore(envoltura, eyebrow.parentElement);
    }

    /* ---------- Apertura automática: solo en el dominio principal ---------- */
    var host = location.hostname.toLowerCase();
    var esDominioPrincipal = host === DOMINIO || host === 'www.' + DOMINIO ||
        host === 'localhost' || host === '127.0.0.1';      // local, para probar
    var esInicio = location.pathname === '/' || location.pathname === '/index.html';
    var forzar = /[?&]promo(=|&|$)/.test(location.search); // ?promo la muestra aunque ya se haya visto
    var yaVista = false;
    try { yaVista = sessionStorage.getItem(CLAVE_SESION) === '1'; } catch (e) {}

    if (esDominioPrincipal && esInicio && (forzar || !yaVista)) {
        var programar = function () { setTimeout(abrir, 700); };
        if (document.readyState === 'complete') programar();
        else window.addEventListener('load', programar, { once: true });
    }
})();
