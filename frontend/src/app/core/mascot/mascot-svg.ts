// The three companions as SVG strings. Pure functions with no imports, so the Angular component and the
// script that renders the e-mail PNGs (scripts/render-mascots.mjs) draw exactly the same artwork.
// The "3D" is shading: gradients, a rim of light, a soft contact shadow. The class names (m-body, m-arm,
// m-eye) are animation hooks for the component and mean nothing to the static PNG.

export type MascotType = 'owl' | 'rabbit' | 'cat';
export type MascotPose = 'idle' | 'happy' | 'sad' | 'thinking' | 'wave';

export const MASCOT_TYPES: readonly MascotType[] = ['owl', 'rabbit', 'cat'];
export const MASCOT_LABEL: Record<MascotType, string> = { owl: 'Ollie the owl', rabbit: 'Remy the rabbit', cat: 'Cleo the cat' };

interface Palette {
  /** Gradient id, unique per mascot so several can share a page. */
  id: string;
  body: string;
  bodyDark: string;
  belly: string;
  accent: string;
  ink: string;
}

const PALETTE: Record<MascotType, Palette> = {
  owl: { id: 'g-owl', body: '#b58a5c', bodyDark: '#7a5636', belly: '#f4e5cb', accent: '#f2a33a', ink: '#2a1f16' },
  rabbit: { id: 'g-rabbit', body: '#f6f3f0', bodyDark: '#d5cec7', belly: '#ffffff', accent: '#f5b7c4', ink: '#2d2a32' },
  cat: { id: 'g-cat', body: '#e8a062', bodyDark: '#c27a3e', belly: '#fbe8d2', accent: '#e5748a', ink: '#2c2018' }
};

function eyes(pose: MascotPose, lx: number, rx: number, y: number, r: number, ink: string, sclera: boolean): string {
  const ball = (cx: number, dx = 0, dy = 0) =>
    `${sclera ? `<circle cx="${cx}" cy="${y}" r="${r + 5}" fill="#fff" stroke="${ink}" stroke-opacity=".12"/>` : ''}` +
    `<g class="m-eye" style="transform-origin:${cx}px ${y}px"><ellipse cx="${cx + dx}" cy="${y + dy}" rx="${r * 0.62}" ry="${r * 0.78}" fill="${ink}"/>` +
    `<circle cx="${cx + dx + r * 0.2}" cy="${y + dy - r * 0.28}" r="${r * 0.22}" fill="#fff"/></g>`;
  const arc = (cx: number) =>
    `<path d="M${cx - r * 0.75} ${y + r * 0.2} Q${cx} ${y - r * 1.0} ${cx + r * 0.75} ${y + r * 0.2}" fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round"/>`;
  switch (pose) {
    case 'happy':
      return arc(lx) + arc(rx);
    case 'sad':
      return (
        ball(lx, 0, 3) + ball(rx, 0, 3) +
        `<path d="M${lx - r} ${y - r + 1} L${lx + r * 0.7} ${y - r - 7}" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>` +
        `<path d="M${rx + r} ${y - r + 1} L${rx - r * 0.7} ${y - r - 7}" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`
      );
    case 'thinking':
      return (
        ball(lx, r * 0.35, -r * 0.3) + ball(rx, r * 0.35, -r * 0.3) +
        `<path d="M${rx - r} ${y - r - 8} L${rx + r} ${y - r - 12}" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`
      );
    default:
      return ball(lx) + ball(rx);
  }
}

function mouth(pose: MascotPose, x: number, y: number, ink: string): string {
  const stroke = `fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"`;
  switch (pose) {
    case 'happy':
    case 'wave':
      return `<path d="M${x - 11} ${y} Q${x} ${y + 14} ${x + 11} ${y}" ${stroke}/>`;
    case 'sad':
      return `<path d="M${x - 9} ${y + 8} Q${x} ${y - 4} ${x + 9} ${y + 8}" ${stroke}/>`;
    case 'thinking':
      return `<path d="M${x - 6} ${y + 3} L${x + 7} ${y + 1}" ${stroke}/>`;
    default:
      return `<path d="M${x - 8} ${y} Q${x} ${y + 8} ${x + 8} ${y}" ${stroke}/>`;
  }
}

/** Little extras that make the pose read at a glance: sparkles, thought dots, a tear. */
function extras(pose: MascotPose, ink: string): string {
  switch (pose) {
    case 'happy':
      return (
        `<path d="M162 40 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#f6c343"/>` +
        `<path d="M36 52 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#f6c343"/>`
      );
    case 'thinking':
      return `<circle cx="158" cy="52" r="4" fill="${ink}" opacity=".35"/><circle cx="170" cy="38" r="6" fill="${ink}" opacity=".35"/><circle cx="186" cy="20" r="9" fill="${ink}" opacity=".35"/>`;
    case 'sad':
      return `<path d="M62 118 q-5 9 0 13 q5 -4 0 -13z" fill="#7cc4f4"/>`;
    default:
      return '';
  }
}

function owl(pose: MascotPose, p: Palette): string {
  const arm = pose === 'wave'
    ? `<g class="m-arm" style="transform-origin:150px 124px"><ellipse cx="164" cy="98" rx="13" ry="30" transform="rotate(24 164 98)" fill="url(#${p.id})"/></g>`
    : `<ellipse cx="152" cy="128" rx="13" ry="30" transform="rotate(-12 152 128)" fill="url(#${p.id})"/>`;
  return (
    `<g class="m-body" style="transform-origin:100px 180px">` +
    `<path d="M52 58 L64 32 L84 56Z M148 58 L136 32 L116 56Z" fill="${p.bodyDark}"/>` +
    `<ellipse cx="100" cy="116" rx="58" ry="62" fill="url(#${p.id})"/>` +
    `<ellipse cx="100" cy="136" rx="38" ry="40" fill="${p.belly}"/>` +
    `<path d="M84 126 q6 7 12 0 M100 126 q6 7 12 0 M92 142 q6 7 12 0 M76 142 q6 7 12 0 M108 142 q6 7 12 0" fill="none" stroke="${p.bodyDark}" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="48" cy="128" rx="13" ry="30" transform="rotate(12 48 128)" fill="url(#${p.id})"/>${arm}` +
    `<path d="M92 104 L100 118 L108 104 Q100 98 92 104Z" fill="${p.accent}"/>` +
    eyes(pose, 76, 124, 90, 14, p.ink, true) +
    `<ellipse cx="86" cy="178" rx="14" ry="6" fill="${p.accent}"/><ellipse cx="114" cy="178" rx="14" ry="6" fill="${p.accent}"/>` +
    `</g>`
  );
}

function rabbit(pose: MascotPose, p: Palette): string {
  const arm = pose === 'wave'
    ? `<g class="m-arm" style="transform-origin:140px 130px"><ellipse cx="156" cy="104" rx="11" ry="26" transform="rotate(26 156 104)" fill="url(#${p.id})"/></g>`
    : `<ellipse cx="142" cy="140" rx="11" ry="24" transform="rotate(-10 142 140)" fill="url(#${p.id})"/>`;
  const earTilt = pose === 'sad' ? 14 : 0;
  return (
    `<g class="m-body" style="transform-origin:100px 180px">` +
    `<g transform="rotate(${-earTilt} 82 60)"><ellipse cx="78" cy="38" rx="15" ry="40" fill="url(#${p.id})"/><ellipse cx="78" cy="40" rx="8" ry="30" fill="${p.accent}"/></g>` +
    `<g transform="rotate(${earTilt} 122 60)"><ellipse cx="122" cy="38" rx="15" ry="40" fill="url(#${p.id})"/><ellipse cx="122" cy="40" rx="8" ry="30" fill="${p.accent}"/></g>` +
    `<ellipse cx="100" cy="140" rx="46" ry="46" fill="url(#${p.id})"/>` +
    `<ellipse cx="100" cy="148" rx="28" ry="30" fill="${p.belly}"/>` +
    `<ellipse cx="58" cy="140" rx="11" ry="24" transform="rotate(10 58 140)" fill="url(#${p.id})"/>${arm}` +
    `<ellipse cx="100" cy="98" rx="48" ry="42" fill="url(#${p.id})"/>` +
    `<ellipse cx="66" cy="112" rx="9" ry="6" fill="${p.accent}" opacity=".7"/><ellipse cx="134" cy="112" rx="9" ry="6" fill="${p.accent}" opacity=".7"/>` +
    eyes(pose, 80, 120, 98, 11, p.ink, false) +
    `<path d="M93 108 Q100 104 107 108 Q100 118 93 108Z" fill="#ef8fa4"/>` +
    mouth(pose, 100, 118, p.ink) +
    `<path d="M70 112 l-16 -3 M70 118 l-16 3 M130 112 l16 -3 M130 118 l16 3" stroke="${p.ink}" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>` +
    `<ellipse cx="82" cy="182" rx="16" ry="7" fill="${p.body}"/><ellipse cx="118" cy="182" rx="16" ry="7" fill="${p.body}"/>` +
    `</g>`
  );
}

function cat(pose: MascotPose, p: Palette): string {
  const arm = pose === 'wave'
    ? `<g class="m-arm" style="transform-origin:140px 134px"><ellipse cx="158" cy="108" rx="11" ry="26" transform="rotate(26 158 108)" fill="url(#${p.id})"/></g>`
    : `<ellipse cx="142" cy="144" rx="11" ry="24" transform="rotate(-10 142 144)" fill="url(#${p.id})"/>`;
  return (
    `<g class="m-body" style="transform-origin:100px 180px">` +
    `<path d="M150 170 Q196 160 184 112 Q180 100 172 108 Q176 140 146 150Z" fill="${p.bodyDark}"/>` +
    `<ellipse cx="100" cy="146" rx="46" ry="42" fill="url(#${p.id})"/>` +
    `<ellipse cx="100" cy="154" rx="26" ry="28" fill="${p.belly}"/>` +
    `<ellipse cx="58" cy="146" rx="11" ry="24" transform="rotate(10 58 146)" fill="url(#${p.id})"/>${arm}` +
    `<path d="M50 74 L56 34 L88 58Z M150 74 L144 34 L112 58Z" fill="url(#${p.id})"/>` +
    `<path d="M58 62 L60 46 L74 56Z M142 62 L140 46 L126 56Z" fill="${p.accent}" opacity=".7"/>` +
    `<ellipse cx="100" cy="98" rx="52" ry="42" fill="url(#${p.id})"/>` +
    `<path d="M100 58 v12 M86 62 l3 10 M114 62 l-3 10" stroke="${p.bodyDark}" stroke-width="4" stroke-linecap="round" opacity=".6"/>` +
    `<ellipse cx="100" cy="112" rx="22" ry="16" fill="${p.belly}"/>` +
    eyes(pose, 78, 122, 98, 12, p.ink, false) +
    `<path d="M94 106 L106 106 L100 113Z" fill="${p.accent}"/>` +
    mouth(pose, 100, 116, p.ink) +
    `<path d="M70 108 l-22 -4 M70 114 l-22 4 M130 108 l22 -4 M130 114 l22 4" stroke="${p.ink}" stroke-opacity=".4" stroke-width="2" stroke-linecap="round"/>` +
    `<ellipse cx="84" cy="184" rx="16" ry="7" fill="${p.body}"/><ellipse cx="116" cy="184" rx="16" ry="7" fill="${p.body}"/>` +
    `</g>`
  );
}

/** A complete, self-contained SVG for one mascot in one pose. */
export function mascotSvg(type: MascotType, pose: MascotPose = 'idle', title = MASCOT_LABEL[type]): string {
  const p = PALETTE[type];
  const draw = type === 'owl' ? owl : type === 'rabbit' ? rabbit : cat;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${title}">` +
    `<defs><radialGradient id="${p.id}" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="${p.body}"/><stop offset="1" stop-color="${p.bodyDark}"/></radialGradient></defs>` +
    `<ellipse cx="100" cy="190" rx="52" ry="7" fill="#000" opacity=".14"/>` +
    draw(pose, p) +
    extras(pose, p.ink) +
    `</svg>`
  );
}
