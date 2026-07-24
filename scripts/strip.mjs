#!/usr/bin/env node
// Render one card as an animated filmstrip PNG. Usage: node scripts/strip.mjs <card> [step] [frames]
import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { compile } from "@matrix-panel/compiler";

const card = process.argv[2];
const step = Number(process.argv[3] ?? 420);
const frames = Number(process.argv[4] ?? 4);
const src = readFileSync(`cards/${card}.card`, "utf8");
const r = compile(src);
const errs = r.diagnostics.filter((d) => d.severity === "error");
if (errs.length) { console.error(errs.map((e) => e.message)); process.exit(1); }
writeFileSync(`tmp/${card}.mxr`, Buffer.from(r.bytecode));

// reuse SAMPLE from preview by importing? simplest: duplicate minimal resolver via preview slots file if present
const SAMPLE = JSON.parse(readFileSync("scripts/sample.json", "utf8"));
function resolve(p) {
  if (SAMPLE[p]) return SAMPLE[p];
  if (p.includes("{{")) { return ["str", p.replace(/^template:/, "").replace(/\{\{([^}]+)\}\}/g, (_, e) => { const v = resolve(e.trim()); return v ? String(v[1]) : ""; })]; }
  if (p.endsWith("$stale")) return ["int", 0];
  if (/!=\s*null/.test(p)) return ["bool", 1];
  if (/==\s*null/.test(p)) return ["bool", 0];
  const b = p.split(/\s*[|=<>!]/)[0].trim();
  return SAMPLE[b] ?? null;
}
const lines = ["# i k u v"];
for (const e of r.slotMap) { const v = resolve(e.path); lines.push(v ? `${e.index} ${v[0]} 0 ${v[1]}` : `${e.index} null 0`); }
writeFileSync(`tmp/${card}.slots.txt`, lines.join("\n") + "\n");

function readPpm(p){const b=readFileSync(p);let i=0;const t=()=>{while(b[i]===32||b[i]===10||b[i]===9)i++;let s=i;while(i<b.length&&b[i]!==32&&b[i]!==10&&b[i]!==9)i++;return b.toString("ascii",s,i)};t();const w=+t(),h=+t();t();i++;return{w,h,d:b.subarray(i)};}
function crc(b){let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xedb88320&-(c&1));}return ~c>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td),0);return Buffer.concat([l,td,c]);}
function png(rgb,w,h){const st=w*3;const raw=Buffer.alloc((st+1)*h);for(let y=0;y<h;y++){raw[y*(st+1)]=0;rgb.copy(raw,y*(st+1)+1,y*st,y*st+st);}const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ih),chunk("IDAT",deflateSync(raw)),chunk("IEND",Buffer.alloc(0))]);}
const S=8,GAP=1,pad=8,tw=64*S,th=32*S;
const tiles=[];
for(let f=0;f<frames;f++){const pp=`tmp/${card}.${f}.ppm`;spawnSync("libmxr/render_ppm",[`tmp/${card}.mxr`,pp,"--slots",`tmp/${card}.slots.txt`,"--t-ms",String(f*step)]);tiles.push(readPpm(pp));}
const W=frames*tw+(frames-1)*pad;const out=Buffer.alloc(W*th*3);
tiles.forEach((pp,fi)=>{for(let y=0;y<32;y++)for(let x=0;x<64;x++){const si=(y*64+x)*3;const r=pp.d[si],g=pp.d[si+1],b=pp.d[si+2];for(let dy=0;dy<S;dy++)for(let dx=0;dx<S;dx++){const on=dx<S-GAP&&dy<S-GAP;const px=fi*(tw+pad)+x*S+dx,py=y*S+dy;const oi=(py*W+px)*3;out[oi]=on?r:(r*0.12)|0;out[oi+1]=on?g:(g*0.12)|0;out[oi+2]=on?b:(b*0.12)|0;}}});
writeFileSync(`tmp/${card}_strip.png`,png(out,W,th));
console.log(`tmp/${card}_strip.png`);
