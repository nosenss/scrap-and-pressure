/** Screen juice: shake, sparks, flying cash, briquette pop. */

export function shakeStation(station: HTMLElement, ms = 180): void {
  station.classList.remove('is-shake')
  // reflow to retrigger
  void station.offsetWidth
  station.classList.add('is-shake')
  window.setTimeout(() => station.classList.remove('is-shake'), ms)
}

type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string }

export function burstSparks(canvas: HTMLCanvasElement, durationMs = 300): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const parent = canvas.parentElement
  const w = parent?.clientWidth || canvas.width
  const h = parent?.clientHeight || canvas.height
  canvas.width = w
  canvas.height = h
  canvas.classList.add('active')

  const sparks: Spark[] = []
  const cx = w * 0.5
  const cy = h * 0.55
  for (let i = 0; i < 42; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = 1.5 + Math.random() * 4.5
    sparks.push({
      x: cx + (Math.random() - 0.5) * 40,
      y: cy + (Math.random() - 0.5) * 20,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1.5,
      life: 1,
      color: Math.random() > 0.35 ? '#ffd24a' : '#ff6a2a',
    })
  }

  const start = performance.now()
  function frame(now: number) {
    const t = (now - start) / durationMs
    ctx!.clearRect(0, 0, w, h)
    for (const s of sparks) {
      s.x += s.vx
      s.y += s.vy
      s.vy += 0.12
      s.life -= 0.04
      if (s.life <= 0) continue
      const size = 2 + Math.floor(Math.random() * 2)
      ctx!.fillStyle = s.color
      ctx!.globalAlpha = Math.max(0, s.life)
      ctx!.fillRect(Math.floor(s.x), Math.floor(s.y), size, size)
    }
    ctx!.globalAlpha = 1
    if (t < 1) requestAnimationFrame(frame)
    else {
      ctx!.clearRect(0, 0, w, h)
      canvas.classList.remove('active')
    }
  }
  requestAnimationFrame(frame)
}

export function flyCash(
  layer: HTMLElement,
  fromEl: HTMLElement,
  toEl: HTMLElement,
  amount: number,
): void {
  const from = fromEl.getBoundingClientRect()
  const to = toEl.getBoundingClientRect()
  const node = document.createElement('div')
  node.className = 'fly-cash'
  node.textContent = `+$${amount.toLocaleString('en-US')}`
  node.style.left = `${from.left + from.width / 2 - 40}px`
  node.style.top = `${from.top}px`
  layer.appendChild(node)

  // second smaller float toward credits
  const trail = document.createElement('div')
  trail.className = 'fly-cash'
  trail.textContent = `+$${amount.toLocaleString('en-US')}`
  trail.style.left = `${from.left + from.width / 2 - 40}px`
  trail.style.top = `${from.top + 10}px`
  trail.style.fontSize = '14px'
  trail.style.transition = 'left 0.7s ease-out, top 0.7s ease-out, opacity 0.7s'
  layer.appendChild(trail)
  requestAnimationFrame(() => {
    trail.style.left = `${to.left + to.width / 2 - 20}px`
    trail.style.top = `${to.top}px`
    trail.style.opacity = '0'
  })

  window.setTimeout(() => {
    node.remove()
    trail.remove()
  }, 900)
}

export function showBriquette(el: HTMLElement): void {
  el.classList.add('hidden')
  void el.offsetWidth
  el.classList.remove('hidden')
  window.setTimeout(() => el.classList.add('hidden'), 1600)
}

export function densityBand(density: number): { label: string; crush: boolean } {
  const pct = density * 100
  if (pct >= 98) return { label: 'CRUSH!', crush: true }
  if (pct >= 85) return { label: 'Dense', crush: false }
  if (pct >= 55) return { label: 'Packed', crush: false }
  return { label: 'Loose', crush: false }
}

/** Map density 0..1 → needle degrees (−110 .. +110). */
export function densityToNeedleDeg(density: number): number {
  return -110 + Math.min(1, Math.max(0, density)) * 220
}

export function formatMoney(n: number): string {
  return `$ ${n.toLocaleString('en-US')}`
}
