/**
 * Top-down chibi sheep / deer — clear fluffy discs, head toward +Y.
 */

export type SpritePose = {
  walk: number;
  fighting: boolean;
  flash: number;
  squash: number;
  /** spawn pop 0→1 */
  born?: number;
};

function fluff(
  c: CanvasRenderingContext2D,
  blobs: [number, number, number][],
  fill: string,
  stroke?: string,
) {
  // Dark silhouette first so wool pops off bright grass
  if (stroke) {
    c.fillStyle = 'rgba(18, 40, 12, 0.88)';
    for (const [x, y, r] of blobs) {
      c.beginPath();
      c.arc(x, y, r + 2.2, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.fillStyle = fill;
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 2.4;
  }
  for (const [x, y, r] of blobs) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    if (stroke) c.stroke();
  }
}

export function drawSheepTop(
  c: CanvasRenderingContext2D,
  variant: 'lamb' | 'sheep' | 'ram' | 'king',
  pose: SpritePose,
) {
  const t = pose.walk * Math.PI * 2;
  const wobble = pose.fighting ? Math.sin(t * 2.2) * 0.02 : Math.sin(t) * 0.04;
  const hop = pose.fighting ? Math.sin(t * 2.4) * 0.35 : Math.abs(Math.sin(t)) * 1.2;
  const born = pose.born ?? 1;
  const pop = 0.55 + born * 0.45;

  const wool =
    variant === 'sheep'
      ? { fill: '#3a3545', stroke: '#0e0c12', face: '#4a4558', ear: '#2e2938', muzzle: '#d4a890' }
      : variant === 'lamb'
        ? { fill: '#fffdf8', stroke: '#5a4a30', face: '#fff6ec', ear: '#f2c8b4', muzzle: '#f2c8b4' }
        : { fill: '#faf4ea', stroke: '#5a4a30', face: '#f3e9dc', ear: '#ebbaa6', muzzle: '#ebbaa6' };

  const size =
    (variant === 'king' ? 1.35 : variant === 'ram' ? 1.18 : variant === 'lamb' ? 0.9 : 1.05) * pop;

  c.save();
  c.scale(size * pose.squash, size * (2 - pose.squash));
  c.rotate(wobble);
  c.translate(0, hop);

  // ground shadow — separates unit from grass plane
  c.fillStyle = 'rgba(12, 40, 8, 0.42)';
  c.beginPath();
  c.ellipse(0, 20, 22, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.beginPath();
  c.ellipse(0, 4, 20, 13, 0, 0, Math.PI * 2);
  c.fill();

  // big fluffy body
  fluff(
    c,
    [
      [0, -2, 17],
      [-12, 0, 12],
      [12, 0, 12],
      [-10, -12, 11],
      [10, -12, 11],
      [0, -14, 12],
      [-14, -6, 10],
      [14, -6, 10],
      [0, 10, 11],
      [-8, 11, 9],
      [8, 11, 9],
      [-6, -18, 8],
      [6, -18, 8],
    ],
    wool.fill,
    wool.stroke,
  );

  c.fillStyle = variant === 'sheep' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.45)';
  c.beginPath();
  c.ellipse(-4, -4, 7, 6, -0.4, 0, Math.PI * 2);
  c.fill();

  // head forward (+Y)
  c.fillStyle = wool.face;
  c.strokeStyle = wool.stroke;
  c.lineWidth = 1.8;
  c.beginPath();
  c.ellipse(0, 16, 11, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // ears
  c.fillStyle = wool.ear;
  c.beginPath();
  c.ellipse(-10, 13, 4.2, 5.5, -0.45, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(10, 13, 4.2, 5.5, 0.45, 0, Math.PI * 2);
  c.fill();

  // horns
  if (variant === 'ram' || variant === 'king') {
    c.strokeStyle = variant === 'king' ? '#f0c84a' : '#d4a84a';
    c.lineWidth = variant === 'king' ? 3.6 : 2.8;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(-9, 8, 9, Math.PI * 0.15, Math.PI * 1.35);
    c.stroke();
    c.beginPath();
    c.arc(9, 8, 9, Math.PI * -0.35, Math.PI * 0.85);
    c.stroke();
    if (variant === 'king') {
      c.fillStyle = '#ffe066';
      c.strokeStyle = '#c9a020';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-5, 2);
      c.lineTo(-3, -5);
      c.lineTo(0, 0);
      c.lineTo(3, -5);
      c.lineTo(5, 2);
      c.closePath();
      c.fill();
      c.stroke();
    }
  }

  // eyes
  const blink = Math.sin(pose.walk * 32) > 0.97;
  c.fillStyle = '#1a1218';
  if (blink) {
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(-5, 16);
    c.lineTo(-1.5, 16);
    c.moveTo(1.5, 16);
    c.lineTo(5, 16);
    c.stroke();
  } else {
    c.beginPath();
    c.arc(-3.2, 16.5, 2.3, 0, Math.PI * 2);
    c.arc(3.2, 16.5, 2.3, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(-2.5, 15.7, 0.75, 0, Math.PI * 2);
    c.arc(3.9, 15.7, 0.75, 0, Math.PI * 2);
    c.fill();
  }

  // blush + muzzle
  c.fillStyle = 'rgba(255,140,120,0.35)';
  c.beginPath();
  c.ellipse(-6, 19, 3, 2, 0, 0, Math.PI * 2);
  c.ellipse(6, 19, 3, 2, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = wool.muzzle;
  c.beginPath();
  c.ellipse(0, 22, 5, 3.8, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#5a3830';
  c.beginPath();
  c.ellipse(-1.5, 21.2, 1.1, 0.85, 0, 0, Math.PI * 2);
  c.ellipse(1.5, 21.2, 1.1, 0.85, 0, 0, Math.PI * 2);
  c.fill();

  // grit when fighting
  c.strokeStyle = '#5a3830';
  c.lineWidth = 1.4;
  c.beginPath();
  if (pose.fighting) {
    c.moveTo(-2, 24);
    c.lineTo(2, 24);
  } else {
    c.arc(0, 23.5, 2.5, 0.2, Math.PI - 0.2);
  }
  c.stroke();

  if (pose.flash > 0.35) {
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255,255,255,${pose.flash * 0.22})`;
    c.beginPath();
    c.arc(0, 2, 24, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
}

export function drawDeerTop(
  c: CanvasRenderingContext2D,
  variant: 'fawn' | 'deer' | 'stag' | 'alpha',
  pose: SpritePose,
) {
  const t = pose.walk * Math.PI * 2;
  const wobble = pose.fighting ? Math.sin(t * 2.2) * 0.018 : Math.sin(t) * 0.035;
  const hop = pose.fighting ? Math.sin(t * 2.4) * 0.3 : Math.abs(Math.sin(t)) * 1.0;
  const born = pose.born ?? 1;
  const pop = 0.55 + born * 0.45;

  const coat =
    variant === 'fawn' ? '#f0c890' : variant === 'alpha' ? '#b07038' : variant === 'stag' ? '#d49850' : '#e4b068';
  const size =
    (variant === 'alpha' ? 1.3 : variant === 'stag' ? 1.15 : variant === 'fawn' ? 0.88 : 1.05) * pop;

  c.save();
  c.scale(size * pose.squash, size * (2 - pose.squash));
  c.rotate(wobble);
  c.translate(0, hop);

  c.fillStyle = 'rgba(12, 40, 8, 0.42)';
  c.beginPath();
  c.ellipse(0, 20, 18, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath();
  c.ellipse(0, 4, 17, 12, 0, 0, Math.PI * 2);
  c.fill();

  // dark rim against grass
  c.fillStyle = 'rgba(18, 40, 12, 0.88)';
  c.beginPath();
  c.ellipse(0, 0, 16.2, 19.2, 0, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = coat;
  c.strokeStyle = '#4a3010';
  c.lineWidth = 2.2;
  c.beginPath();
  c.ellipse(0, 0, 14, 17, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.beginPath();
  c.ellipse(-3, -3, 6, 7, 0, 0, Math.PI * 2);
  c.fill();

  if (variant === 'fawn') {
    c.fillStyle = 'rgba(255,255,255,0.55)';
    ;[
      [-5, -5],
      [5, -3],
      [-4, 5],
      [4, 6],
      [0, -8],
    ].forEach(([sx, sy]) => {
      c.beginPath();
      c.arc(sx, sy, 2.4, 0, Math.PI * 2);
      c.fill();
    });
  }

  // head
  c.fillStyle = coat;
  c.beginPath();
  c.ellipse(0, 16, 9, 8.5, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(-8, 12, 3.5, 5, -0.5, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(8, 12, 3.5, 5, 0.5, 0, Math.PI * 2);
  c.fill();

  if (variant !== 'fawn') {
    c.strokeStyle = '#6a4a20';
    c.lineWidth = variant === 'alpha' ? 2.8 : 2.2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-5, 9);
    c.lineTo(-12, -2);
    c.lineTo(-16, 2);
    c.moveTo(-12, -2);
    c.lineTo(-13, -6);
    c.moveTo(5, 9);
    c.lineTo(12, -2);
    c.lineTo(16, 2);
    c.moveTo(12, -2);
    c.lineTo(13, -6);
    if (variant === 'alpha') {
      c.moveTo(-12, 0);
      c.lineTo(-18, -3);
      c.moveTo(12, 0);
      c.lineTo(18, -3);
    }
    c.stroke();
  }

  c.fillStyle = '#1a1008';
  c.beginPath();
  c.arc(-3, 16.5, 2, 0, Math.PI * 2);
  c.arc(3, 16.5, 2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(-2.4, 15.9, 0.6, 0, Math.PI * 2);
  c.arc(3.6, 15.9, 0.6, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = '#3a2818';
  c.beginPath();
  c.ellipse(0, 21.5, 3, 2.2, 0, 0, Math.PI * 2);
  c.fill();

  if (pose.flash > 0.35) {
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255,255,255,${pose.flash * 0.2})`;
    c.beginPath();
    c.arc(0, 2, 22, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
}

export function drawTrayIcon(canvas: HTMLCanvasElement, kind: string, team: 'sheep' | 'deer', walk = 0.1) {
  const c = canvas.getContext('2d')!;
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.save();
  c.translate(canvas.width / 2, canvas.height / 2 + 2);
  c.scale(0.95, 0.95);
  c.rotate(Math.PI); // face camera-forward in tray
  const pose: SpritePose = { walk, fighting: false, flash: 0, squash: 1, born: 1 };
  if (team === 'sheep') drawSheepTop(c, kind as 'lamb' | 'sheep' | 'ram' | 'king', pose);
  else drawDeerTop(c, kind as 'fawn' | 'deer' | 'stag' | 'alpha', pose);
  c.restore();
}

/** Paint avatar circle (sheep or deer face) */
export function paintAvatar(canvas: HTMLCanvasElement, team: 'sheep' | 'deer') {
  const c = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  c.clearRect(0, 0, w, h);
  c.save();
  c.translate(w / 2, h / 2);
  c.scale(1.35, 1.35);
  c.rotate(Math.PI);
  if (team === 'sheep') {
    drawSheepTop(c, 'ram', { walk: 0.2, fighting: false, flash: 0, squash: 1, born: 1 });
  } else {
    drawDeerTop(c, 'stag', { walk: 0.2, fighting: false, flash: 0, squash: 1, born: 1 });
  }
  c.restore();
}
