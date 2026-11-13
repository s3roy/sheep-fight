/** Chicken Road sprite / atlas helpers (assets under /chicken/). */

export type AtlasFrame = {
  frame: { x: number; y: number; w: number; h: number };
};

export type Atlas = {
  frames: Record<string, AtlasFrame>;
  meta: { image: string; size: { w: number; h: number } };
};

const cache = new Map<string, HTMLImageElement>();
const atlasCache = new Map<string, Atlas>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = cache.get(src);
  if (hit?.complete) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`img ${src}`));
    img.src = src;
    cache.set(src, img);
  });
}

export async function loadAtlas(name: string): Promise<Atlas> {
  const hit = atlasCache.get(name);
  if (hit) return hit;
  const res = await fetch(`/chicken/${name}.atlas.json`);
  const atlas = (await res.json()) as Atlas;
  atlasCache.set(name, atlas);
  await loadImage(`/chicken/${atlas.meta.image}`);
  return atlas;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  atlas: Atlas,
  frameName: string,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const f = atlas.frames[frameName]?.frame;
  if (!f) return;
  ctx.drawImage(img, f.x, f.y, f.w, f.h, dx, dy, dw, dh);
}

/** Pixi-style draw: position is anchor point, size = source × scale. */
export function drawAnchored(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  atlas: Atlas,
  frameName: string,
  x: number,
  y: number,
  scale: number,
  anchorX = 0.5,
  anchorY = 0.5,
) {
  const f = atlas.frames[frameName]?.frame;
  if (!f) return;
  const dw = f.w * scale;
  const dh = f.h * scale;
  ctx.drawImage(img, f.x, f.y, f.w, f.h, x - dw * anchorX, y - dh * anchorY, dw, dh);
}

export function drawImageAnchored(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  anchorX = 0.5,
  anchorY = 0.5,
) {
  const dw = img.naturalWidth * scaleX;
  const dh = img.naturalHeight * scaleY;
  ctx.drawImage(img, x - dw * anchorX, y - dh * anchorY, dw, dh);
}

export function frameNames(atlas: Atlas, prefix: string): string[] {
  return Object.keys(atlas.frames)
    .filter((k) => k.startsWith(prefix))
    .sort((a, b) => {
      const na = Number(a.replace(/\D+/g, '')) || 0;
      const nb = Number(b.replace(/\D+/g, '')) || 0;
      return na - nb;
    });
}

export type SpritePack = {
  idleImg: HTMLImageElement;
  goImg: HTMLImageElement;
  jumpImg: HTMLImageElement;
  objectsImg: HTMLImageElement;
  wallsImg: HTMLImageElement;
  miniFireImg: HTMLImageElement;
  decorsImg: HTMLImageElement;
  lightsImg: HTMLImageElement;
  chickenImg: HTMLImageElement;
  deadImg: HTMLImageElement;
  roadColor: HTMLImageElement;
  wallColor: HTMLImageElement;
  /** Tall collision flames fire_0..21. */
  fireImgs: HTMLImageElement[];
  idle: Atlas;
  go: Atlas;
  jump: Atlas;
  objects: Atlas;
  walls: Atlas;
  miniFire: Atlas;
  decors: Atlas;
  lights: Atlas;
  idleFrames: string[];
  goFrames: string[];
  jumpFrames: string[];
  miniFireFrames: string[];
};

/** Draw atlas frame with Pixi-style multiply tint. */
export function drawTintedAnchored(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  atlas: Atlas,
  frameName: string,
  x: number,
  y: number,
  scale: number,
  tint: string,
  alpha = 1,
  anchorX = 0.5,
  anchorY = 0.5,
) {
  const f = atlas.frames[frameName]?.frame;
  if (!f) return;
  const dw = f.w * scale;
  const dh = f.h * scale;
  const dx = x - dw * anchorX;
  const dy = y - dh * anchorY;
  const tmp = document.createElement('canvas');
  tmp.width = Math.max(1, Math.ceil(dw));
  tmp.height = Math.max(1, Math.ceil(dh));
  const tctx = tmp.getContext('2d')!;
  tctx.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, dw, dh);
  tctx.globalCompositeOperation = 'multiply';
  tctx.fillStyle = tint;
  tctx.fillRect(0, 0, dw, dh);
  tctx.globalCompositeOperation = 'destination-in';
  tctx.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, dw, dh);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(tmp, dx, dy);
  ctx.restore();
}

export async function loadSpritePack(): Promise<SpritePack> {
  const [idle, go, jump, objects, walls, miniFire, decors, lights] = await Promise.all([
    loadAtlas('chicken_idle'),
    loadAtlas('chicken_go'),
    loadAtlas('chicken_jump'),
    loadAtlas('objects'),
    loadAtlas('walls'),
    loadAtlas('mini_fire'),
    loadAtlas('decors'),
    loadAtlas('lights'),
  ]);
  const fireImgs = await Promise.all(
    Array.from({ length: 22 }, (_, n) => loadImage(`/chicken/fire_${n}.png`)),
  );
  const [
    idleImg,
    goImg,
    jumpImg,
    objectsImg,
    wallsImg,
    miniFireImg,
    decorsImg,
    lightsImg,
    chickenImg,
    deadImg,
    roadColor,
    wallColor,
  ] = await Promise.all([
    loadImage('/chicken/chicken_idle.png'),
    loadImage('/chicken/chicken_go.png'),
    loadImage('/chicken/chicken_jump.png'),
    loadImage('/chicken/objects.png'),
    loadImage('/chicken/walls.png'),
    loadImage('/chicken/mini_fire.png'),
    loadImage('/chicken/decors.png'),
    loadImage('/chicken/lights.png'),
    loadImage('/chicken/chicken.png'),
    loadImage('/chicken/chicken_dead.png'),
    loadImage('/chicken/road_color.png'),
    loadImage('/chicken/decoration_wall_color.png'),
  ]);
  return {
    idleImg,
    goImg,
    jumpImg,
    objectsImg,
    wallsImg,
    miniFireImg,
    decorsImg,
    lightsImg,
    chickenImg,
    deadImg,
    roadColor,
    wallColor,
    fireImgs,
    idle,
    go,
    jump,
    objects,
    walls,
    miniFire,
    decors,
    lights,
    idleFrames: frameNames(idle, 'chicken_idle_'),
    goFrames: frameNames(go, 'chicken_go_'),
    jumpFrames: frameNames(jump, 'chicken_jump_'),
    miniFireFrames: frameNames(miniFire, 'mini_fire_'),
  };
}
