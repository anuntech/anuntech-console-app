/* eslint-disable @typescript-eslint/no-unused-expressions -- supplied component, kept as delivered */
/*!
 * <energy-orb> — esfera de energia azul em WebGL (Web Component, sem dependências)
 *
 * Uso:
 *   <script src="energy-orb.js"></script>
 *   <energy-orb style="width:220px;height:220px"></energy-orb>
 *
 * Atributos (todos opcionais):
 *   energy="1"        intensidade base (0.3 a 2)
 *   speed="1"         velocidade da animação (0 a 3)
 *   sparkles="on"     faíscas internas: "on" | "off"
 *   glow="on"         brilho externo: "on" | "off"
 *   interactive="on"  hover energiza, clique dá um pico, luz segue o cursor: "on" | "off"
 *
 * API JS:
 *   const orb = document.querySelector('energy-orb');
 *   orb.pulse();          // pico de energia
 *   orb.energy = 1.5;     // muda a intensidade base
 *   orb.speed = 2;        // muda a velocidade
 */
(() => {
  if (customElements.get('energy-orb')) return;

  const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform float uEnergy;
uniform vec2  uLight;
uniform float uSparkles;

// simplex noise 3D (Ashima Arts, MIT)
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
vec3 hash3(vec3 p){ return fract(sin(vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))))*43758.5453); }
mat2 rot2(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

// plasma sólido: nuvens de energia contínuas e distorcidas (sem linhas)
float plasma(vec2 p, float t, float seed){
  vec3 q = vec3(p*0.85, t*0.08 + seed);
  vec2 w = vec2(snoise(q + vec3(0.0, 0.0, 1.7)), snoise(q + vec3(5.2, 1.3, 0.0)));
  float n = snoise(vec3(p*0.95 + w*0.55 + vec2(t*0.04, -t*0.03), t*0.06 + seed*2.0));
  return n;
}
float sparks(vec2 p, float scale, float seed, float t){
  p = rot2(t*0.05 + seed) * p;
  p += vec2(sin(t*0.13 + seed), cos(t*0.11 + seed*2.0)) * 0.25;
  vec2 g = p*scale; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float h = hash(vec3(id, seed));
  vec2 o = (hash3(vec3(id, seed)).xy - 0.5) * 0.7;
  o += vec2(sin(t*(0.5+h) + h*9.0), cos(t*(0.4+h) + h*7.0)) * 0.12;
  float d = length(f - o);
  float tw = 0.5 + 0.5*sin(t*(2.0 + h*5.0) + h*50.0);
  float cloud = pow(max(0.0, snoise(vec3(p*1.8, seed + t*0.07))*0.5 + 0.5), 2.0) * 2.0;
  return smoothstep(0.12, 0.0, d) * step(0.8, h) * tw * cloud;
}

void main(){
  vec2 uv = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float r = length(uv);
  float px = 2.0 / uRes.x;
  float alpha = 1.0 - smoothstep(1.0 - px*1.5, 1.0, r);
  if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }

  float t = uTime, E = uEnergy;
  float z = sqrt(max(0.0, 1.0 - r*r));
  vec3 n = vec3(uv, z);
  vec3 V = vec3(0.0, 0.0, -1.0);
  float fres = pow(1.0 - z, 2.6);
  float edge = 1.0 - smoothstep(0.85, 1.0, r);

  // base do vidro
  vec3 deep = vec3(0.05, 0.13, 0.44);
  vec3 mid  = vec3(0.12, 0.30, 0.76);
  vec3 col = mix(deep, mid, smoothstep(0.1, 0.95, r));

  // energia sólida em duas profundidades (paralaxe)
  vec3 energy = vec3(0.0);
  for (int k = 0; k < 2; k++){
    float dk = float(k);
    vec2 luv = uv * (1.0 - 0.18*dk) * (1.0 + 0.2*(1.0 - z)) + n.xy*0.07*dk;
    float v = plasma(luv, t*(0.8 + 0.4*dk), dk*4.7);
    float body  = smoothstep(-0.5, 0.7, v);          // massa azul clara
    float hot   = pow(smoothstep(0.1, 0.9, v), 1.6);  // áreas quase brancas
    float shade = smoothstep(0.1, -0.6, v);             // bolsões escuros
    float br = 0.6 + 0.4*dk;
    energy += vec3(0.28, 0.52, 1.0) * body * 0.45 * br;
    energy += vec3(0.85, 0.94, 1.0) * hot * 0.75 * br;
    col *= 1.0 - shade * 0.4;
    if (uSparkles > 0.5)
      energy += vec3(1.0) * sparks(luv, 20.0 + 8.0*dk, dk*7.3 + 1.0, t) * (0.7 + 0.5*dk);
  }
  // brilhos que passeiam
  for (int k = 0; k < 3; k++){
    float fk = float(k);
    vec2 c = vec2(sin(t*(0.21 + fk*0.07) + fk*2.1), cos(t*(0.17 + fk*0.05) + fk*1.3)) * 0.45;
    vec2 d = uv - c;
    energy += vec3(0.62, 0.83, 1.0) * exp(-dot(d,d)*9.0) * 0.25;
  }
  col += energy * edge * (0.85 + 0.35*E);

  // reflexos grandes (alto-esquerda / baixo-direita)
  float wob = snoise(vec3(uv*2.5, t*0.2));
  col += vec3(0.75,0.88,1.0) * exp(-dot(uv-vec2(-0.42,0.38),uv-vec2(-0.42,0.38))*9.0) * (0.3 + 0.15*wob);
  col += vec3(0.7,0.88,1.0) * exp(-dot(uv-vec2(0.4,-0.52),uv-vec2(0.4,-0.52))*16.0) * (0.4 + 0.2*sin(t*0.9));

  // especular
  vec3 L = normalize(vec3(-0.55 + uLight.x*0.35, 0.62 + uLight.y*0.3, 0.6));
  vec3 R = reflect(V, n);
  col += vec3(1.0) * pow(max(dot(R, L), 0.0), 60.0) * 0.9;
  col += vec3(0.8,0.9,1.0) * pow(max(dot(R, L), 0.0), 7.0) * 0.2;

  // cáustica
  float caus = pow(max(dot(-n.xy, L.xy), 0.0), 3.0) * smoothstep(0.55, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
  col += vec3(0.55,0.8,1.0) * caus * (0.35 + 0.15*sin(t*1.3));

  // borda
  col *= 1.0 - 0.28 * smoothstep(0.74, 0.88, r) * (1.0 - smoothstep(0.88, 0.95, r));
  col += vec3(0.55, 0.8, 1.0) * fres * 0.55;
  col += vec3(0.8, 0.93, 1.0) * smoothstep(0.955, 0.995, r) * 0.55;

  // (sem o reflexo de janela: o traço branco à direita foi retirado a pedido)

  col = 1.0 - exp(-col * 1.1);
  gl_FragColor = vec4(col * alpha, alpha);
}`;

  const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }';

  class EnergyOrb extends HTMLElement {
    static get observedAttributes() { return ['energy', 'speed', 'sparkles', 'glow', 'interactive']; }

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          :host { display: inline-block; width: 220px; height: 220px; position: relative; border-radius: 50%; --e: 1; }
          .wrap { width: 100%; height: 100%; border-radius: 50%; }
          :host(:not([glow="off"])) .wrap {
            box-shadow:
              0 0 calc(14px + 10px * var(--e)) rgba(80,160,255, calc(0.45 * var(--e))),
              0 0 calc(40px + 24px * var(--e)) rgba(40,110,255, calc(0.28 * var(--e))),
              0 0 calc(90px + 40px * var(--e)) rgba(40,110,255, calc(0.12 * var(--e)));
          }
          .fallback { background: radial-gradient(circle at 40% 35%, #cfe9ff 0%, #5d9cf0 25%, #2553b5 60%, #86c2ff 100%); }
          canvas { width: 100%; height: 100%; display: block; border-radius: 50%; }
        </style>
        <div class="wrap"><canvas></canvas></div>`;
      this._wrap = root.querySelector('.wrap');
      this._canvas = root.querySelector('canvas');
      this._base = 1; this._speed = 1;
      this._energy = 1; this._energyT = 1;
      this._light = [0, 0]; this._lightT = [0, 0];
      this._T = 0; this._scale = Math.min(window.devicePixelRatio || 1, 2);
    }

    get energy() { return this._base; }
    set energy(v) { this._base = Math.max(0.1, +v || 1); this._energyT = this._base; }
    get speed() { return this._speed; }
    set speed(v) { this._speed = Math.max(0, +v); }
    pulse() { this._energy = this._base * 2; }

    attributeChangedCallback(name, _, v) {
      if (name === 'energy') this.energy = v;
      if (name === 'speed') this.speed = v ?? 1;
    }

    connectedCallback() {
      if (this.hasAttribute('energy')) this.energy = this.getAttribute('energy');
      if (this.hasAttribute('speed')) this.speed = this.getAttribute('speed');
      if (!this.hasAttribute('role')) { this.setAttribute('role', 'img'); this.setAttribute('aria-label', 'Esfera de energia'); }
      this._reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!this._initGL()) { this._wrap.classList.add('fallback'); return; }

      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this);
      this._resize();

      this._onMove = ev => {
        if (this.getAttribute('interactive') === 'off') return;
        const r = this.getBoundingClientRect();
        const dx = (ev.clientX - (r.left + r.width / 2)) / innerWidth;
        const dy = (ev.clientY - (r.top + r.height / 2)) / innerHeight;
        this._lightT = [Math.max(-1, Math.min(1, dx * 2)), Math.max(-1, Math.min(1, -dy * 2))];
      };
      this._onEnter = () => { if (this.getAttribute('interactive') !== 'off') this._energyT = this._base * 1.3; };
      this._onLeave = () => { this._energyT = this._base; };
      this._onDown  = () => { if (this.getAttribute('interactive') !== 'off') this.pulse(); };
      addEventListener('pointermove', this._onMove);
      this.addEventListener('pointerenter', this._onEnter);
      this.addEventListener('pointerleave', this._onLeave);
      this.addEventListener('pointerdown', this._onDown);

      this._last = performance.now(); this._slow = 0;
      const loop = now => { this._raf = requestAnimationFrame(loop); this._frame(now); };
      this._raf = requestAnimationFrame(loop);
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      this._ro && this._ro.disconnect();
      removeEventListener('pointermove', this._onMove);
    }

    _initGL() {
      const gl = this._canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
      if (!gl) return false;
      const sh = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
        return s;
      };
      const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = n => gl.getUniformLocation(prog, n);
      this._u = { res: U('uRes'), time: U('uTime'), energy: U('uEnergy'), light: U('uLight'), sparkles: U('uSparkles') };
      this._gl = gl;
      return true;
    }

    _resize() {
      const w = Math.max(1, Math.round(Math.min(this.clientWidth, this.clientHeight) * this._scale));
      this._canvas.width = w; this._canvas.height = w;
      this._gl.viewport(0, 0, w, w);
    }

    _frame(now) {
      const gl = this._gl, u = this._u;
      const dt = Math.min(0.05, (now - this._last) / 1000); this._last = now;
      this._slow = dt > 0.028 ? this._slow + 1 : Math.max(0, this._slow - 1);
      if (this._slow > 40 && this._scale > 0.8) { this._scale *= 0.8; this._resize(); this._slow = 0; }

      this._energy += (this._energyT - this._energy) * 0.035;
      this._light[0] += (this._lightT[0] - this._light[0]) * 0.05;
      this._light[1] += (this._lightT[1] - this._light[1]) * 0.05;
      const breath = 1 + 0.08 * Math.sin(now * 0.002);
      const e = this._energy * breath;
      this._T += dt * this._speed * (this._reduce ? 0.2 : 1) * (0.55 + 0.45 * this._energy);

      this.style.setProperty('--e', e.toFixed(3));
      gl.uniform2f(u.res, this._canvas.width, this._canvas.height);
      gl.uniform1f(u.time, this._T + 10);
      gl.uniform1f(u.energy, e);
      gl.uniform2f(u.light, this._light[0], this._light[1]);
      gl.uniform1f(u.sparkles, this.getAttribute('sparkles') === 'off' ? 0 : 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  customElements.define('energy-orb', EnergyOrb);
})();

// A module, so the Console can load it on demand (see energy-orb.tsx).
export {};
