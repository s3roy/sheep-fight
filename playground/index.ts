import '../src/ui/styles.css';

const games = [
  {
    href: '/chicken.html',
    name: 'Chicken Road',
    blurb: 'Lane cashout · GO or CASH OUT.',
    tag: 'Popular style',
    accent: 'var(--ec-mint)',
  },
  {
    href: '/spark.html',
    name: 'Spark Trail',
    blurb: 'Lane-step cashout · original neon pads · GO or cash out.',
    tag: 'Inspired · Original',
    accent: 'var(--ec-gold)',
  },
  {
    href: '/surge.html',
    name: 'Surge',
    blurb: 'Host-authoritative crash · WebSocket rounds.',
    tag: 'Popular style',
    accent: 'var(--ec-mint)',
  },
  {
    href: '/andar.html',
    name: 'Andar Bahar',
    blurb: 'Joker match race with Pulse-3 side.',
    tag: 'Popular style',
    accent: 'var(--ec-gold)',
  },
  {
    href: '/sheep.html',
    name: 'Sheep Fight',
    blurb: '5-lane sheep vs deer battler.',
    tag: 'Original',
    accent: 'var(--ec-mint)',
  },
  {
    href: '/helix.html',
    name: 'Helix',
    blurb: 'Phase-locked dual-rail exit sectors.',
    tag: 'Original',
    accent: 'var(--ec-violet)',
  },
  {
    href: '/lattice.html',
    name: 'Lattice',
    blurb: 'Hex path · boost / collapse product.',
    tag: 'Original',
    accent: 'var(--ec-sky)',
  },
  {
    href: '/cipher.html',
    name: 'Cipher',
    blurb: 'Coupled moduli dials 11 · 13 · 17.',
    tag: 'Original',
    accent: 'var(--ec-rose)',
  },
] as const;

document.getElementById('catalog')!.innerHTML = games
  .map(
    (g) => `
    <a class="ec-card-link" href="${g.href}" style="--tab:${g.accent}">
      <span class="ec-card-link-tag">${g.tag}</span>
      <strong>${g.name}</strong>
      <span>${g.blurb}</span>
      <em>${g.href}</em>
    </a>`,
  )
  .join('');
