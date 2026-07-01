// ── Nav scroll ──────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// ── Fade-up on scroll ───────────────────────
const fadeEls = document.querySelectorAll('.fade-up');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
fadeEls.forEach(el => observer.observe(el));

// ── Carrusel de reseñas (loop infinito sin corte) ──
function initReviewsCarousel() {
  const track = document.getElementById('reviews-track');
  if (!track) return;

  const wrap    = track.parentElement;
  const prevBtn = document.getElementById('reviews-prev');
  const nextBtn = document.getElementById('reviews-next');

  // Clonamos la primera card al final y la última al principio,
  // así al "pasar" del extremo siempre se sigue avanzando en la misma dirección.
  const originalCards = Array.from(track.querySelectorAll('.crs-review-card'));
  const total = originalCards.length;

  const firstClone = originalCards[0].cloneNode(true);
  const lastClone  = originalCards[total - 1].cloneNode(true);
  firstClone.setAttribute('aria-hidden', 'true');
  lastClone.setAttribute('aria-hidden', 'true');

  track.appendChild(firstClone);
  track.insertBefore(lastClone, originalCards[0]);

  const cards = Array.from(track.querySelectorAll('.crs-review-card'));
  // Ahora: cards[0] = clon de la última, cards[1..total] = reales, cards[total+1] = clon de la primera
  let index = 1;
  let isAnimating = false;

  function moveTo(i, withTransition = true) {
    track.style.transition = withTransition ? '' : 'none';
    if (!withTransition) track.offsetHeight; // fuerza reflow para que el "none" se aplique antes del salto
    const wrapWidth  = wrap.getBoundingClientRect().width;
    const cardWidth  = cards[i].getBoundingClientRect().width;
    const offsetLeft = cards[i].offsetLeft;
    const offset = offsetLeft - (wrapWidth - cardWidth) / 2;

    track.style.transform = `translateX(-${offset}px)`;
    cards.forEach((card, ci) => card.classList.toggle('active', ci === i));
  }

  function goNext() {
    if (isAnimating) return;
    isAnimating = true;
    index++;
    moveTo(index, true);
  }

  function goPrev() {
    if (isAnimating) return;
    isAnimating = true;
    index--;
    moveTo(index, true);
  }

  track.addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'transform') return;

    if (index === cards.length - 1) {
      // Llegamos al clon de la primera: saltamos sin animación a la primera real
      index = 1;
      moveTo(index, false);
    } else if (index === 0) {
      // Llegamos al clon de la última: saltamos sin animación a la última real
      index = total;
      moveTo(index, false);
    }
    isAnimating = false;
  });

  prevBtn.addEventListener('click', goPrev);
  nextBtn.addEventListener('click', goNext);

  window.addEventListener('resize', () => moveTo(index, false));
  window.addEventListener('load', () => moveTo(index, false));
  moveTo(index, false);
}
document.addEventListener('DOMContentLoaded', initReviewsCarousel);

// ── Stacking cards controladas por scroll ─────
// Las cards están superpuestas (position:absolute, misma coordenada) dentro
// de un viewport sticky. El scroll solo mueve transform/z-index (desplazamiento
// vertical, sin fade). En vez de calcular la posición de cada card de forma
// independiente, cada una queda "encadenada" a la posición ACTUAL de la
// anterior (no a su posición final asumida): así, mientras una card todavía
// está subiendo, la siguiente la sigue pegada por debajo en tiempo real, y
// cuando llega su propio turno ya está perfectamente alineada — sin saltos.
function initStackScroll() {
  const scrollEl = document.getElementById('stack-scroll');
  if (!scrollEl) return;

  const cards = Array.from(scrollEl.querySelectorAll('.crs-stack-card'));
  const total = cards.length;
  const ENTRANCE = 1;    // ventana de entrada = el tramo completo, sin pausa estática entre cards
  const PEEK_PX  = 110;  // cuántos px de la siguiente card se alcanzan a ver asomando

  // Alturas cacheadas: evita medir layout (getBoundingClientRect) en cada frame.
  let cardHeights = cards.map(card => card.getBoundingClientRect().height);
  function measure() {
    cardHeights = cards.map(card => card.getBoundingClientRect().height);
  }

  let lastSlot = null;

  function render() {
    const rect = scrollEl.getBoundingClientRect();
    const vh = window.innerHeight;
    const scrolled = -rect.top; // px scrolleados dentro del contenedor alto
    const slot = Math.min(Math.max(scrolled / vh, 0), total);

    // Si el scroll no se movió desde el último frame, no hay nada que tocar.
    if (slot === lastSlot) return;
    lastSlot = slot;

    // La primera card siempre está fija, completamente visible y centrada.
    cards[0].style.transform = 'translate(-50%, -50%)';
    cards[0].style.zIndex = 1;

    let prevY = 0; // posición vertical actual de la card anterior (0 = asentada)

    for (let i = 1; i < cards.length; i++) {
      const card = cards[i];
      const cardH = cardHeights[i];

      // Posición "pegada": justo debajo del borde inferior de la anterior,
      // tal como está AHORA (no asumiendo que ya esté asentada).
      const gluedY = prevY + (cardH - PEEK_PX);

      const entranceStart = i - ENTRANCE;
      const entranceEnd   = i;
      const t = Math.min(Math.max((slot - entranceStart) / ENTRANCE, 0), 1);

      // t=0 → todavía pegada a la anterior (la sigue si esta se mueve).
      // t=1 → completamente despegada y asentada en su lugar (y=0).
      const y = gluedY * (1 - t);

      card.style.transform = `translate(-50%, calc(-50% + ${y}px))`;
      card.style.zIndex = i + 1;

      prevY = y;
    }
  }

  // Loop continuo en vez de depender solo del evento "scroll": el navegador
  // dispara "scroll" en ráfagas irregulares, lo que se siente como cortes.
  // Leyendo la posición en cada frame de pintado, el movimiento queda
  // perfectamente sincronizado y fluido, sin importar cómo llegue el evento.
  function loop() {
    render();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => { measure(); lastSlot = null; render(); });
  measure();
  requestAnimationFrame(loop);
}
document.addEventListener('DOMContentLoaded', initStackScroll);

// ── Hero timeline animation ──────────────────
document.addEventListener('DOMContentLoaded', () => {

  const img1  = document.getElementById('img-1');
  const img2  = document.getElementById('img-2');
  const img3  = document.getElementById('img-3');
  const node1 = document.getElementById('node-1');
  const node2 = document.getElementById('node-2');
  const node3 = document.getElementById('node-3');
  const fill  = document.getElementById('timeline-fill');

  if (!img1) return;

  // Step 1 — imagen 1 + nodo 1
  setTimeout(() => {
    img1.classList.add('visible');
    node1.classList.add('active');
  }, 300);

  // Step 2 — línea + imagen 2 + nodo 2
  setTimeout(() => {
    fill.style.width = '50%';
    setTimeout(() => {
      img2.classList.add('visible');
      node2.classList.add('active');
    }, 400);
  }, 900);

  // Step 3 — línea + imagen 3 + nodo 3
  setTimeout(() => {
    fill.style.width = '100%';
    setTimeout(() => {
      img3.classList.add('visible');
      node3.classList.add('active');
    }, 400);
  }, 1700);

});

// ── Equipo: hover-swap entre instructores ─────
function initTeamSwap() {
  const root = document.getElementById('crs-team');
  if (!root) return;

  const nameButtons = Array.from(root.querySelectorAll('.crs-team-name'));
  const initialsEl  = document.getElementById('crs-team-initials');
  const roleEl      = document.getElementById('crs-team-role');
  const statsEl     = document.getElementById('crs-team-stats');

  const instructors = [
    {
      name: 'Tomás Ferrero',
      initials: 'TF',
      role: 'Maestro restaurador de mobiliario',
      stats: [
        { num: '+5', label: 'Años de<br>experiencia' },
        { num: 'Especialista', label: 'en estructuras y<br>uniones tradicionales', word: true },
        { num: '2019', label: 'Formando<br>restauradores' },
      ],
    },
    {
      name: 'Lucía Bianchi',
      initials: 'LB',
      role: 'Diseñadora industrial y restauradora',
      stats: [
        { num: '+8', label: 'Años de<br>experiencia' },
        { num: 'Especialista', label: 'en diseño de<br>mobiliario funcional', word: true },
        { num: '2017', label: 'Formando<br>restauradores' },
      ],
    },
    {
      name: 'Santiago Ruíz',
      initials: 'SR',
      role: 'Ebanista y especialista en maderas macizas',
      stats: [
        { num: '+10', label: 'Años de<br>experiencia' },
        { num: 'Especialista', label: 'en maderas macizas<br>y ebanistería fina', word: true },
        { num: '2016', label: 'Formando<br>restauradores' },
      ],
    },
  ];

  function renderStats(stats) {
    statsEl.innerHTML = stats.map(s => `
      <div class="crs-team-stat">
        <span class="crs-team-stat-num${s.word ? ' is-word' : ''}">${s.num}</span>
        <span class="crs-team-stat-label">${s.label}</span>
      </div>
    `).join('');
  }

  function setActive(i) {
    nameButtons.forEach((btn, bi) => btn.classList.toggle('is-active', bi === i));

    const data = instructors[i];
    // Fundido corto para que el cambio de contenido no se sienta como un corte.
    [initialsEl, roleEl, statsEl].forEach(el => el.classList.add('crs-team-swap-fade'));

    setTimeout(() => {
      initialsEl.textContent = data.initials;
      roleEl.textContent = data.role;
      renderStats(data.stats);
      [initialsEl, roleEl, statsEl].forEach(el => el.classList.remove('crs-team-swap-fade'));
    }, 150);
  }

  nameButtons.forEach((btn, i) => {
    btn.addEventListener('mouseenter', () => setActive(i));
    btn.addEventListener('focus', () => setActive(i));
  });

  // Estado inicial: primer instructor.
  renderStats(instructors[0].stats);
}
document.addEventListener('DOMContentLoaded', initTeamSwap);
