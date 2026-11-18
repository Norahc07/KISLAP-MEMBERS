import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const STATUS_COLORS = {
  idle: 0x14b8a6,
  busy: 0x3b82f6,
  waiting: 0xf59e0b,
  failed: 0xef4444,
}

function resolveVisualStatus(desk, runningId) {
  const status = desk.latest?.status || 'done'
  if (runningId === desk.id || status === 'running' || status === 'queued') return 'busy'
  if (status === 'waiting_approval') return 'waiting'
  if (status === 'failed') return 'failed'
  return 'idle'
}

function makeBox(w, h, d, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05 }),
  )
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function makeRobot(color) {
  const group = new THREE.Group()
  const body = makeBox(0.55, 0.7, 0.4, color, 0, 0.55, 0)
  const head = makeBox(0.42, 0.42, 0.42, 0xe2e8f0, 0, 1.15, 0)
  const eyeL = makeBox(0.08, 0.08, 0.06, 0x0f766e, -0.1, 1.18, 0.2)
  const eyeR = makeBox(0.08, 0.08, 0.06, 0x0f766e, 0.1, 1.18, 0.2)
  const armL = makeBox(0.12, 0.45, 0.12, color, -0.4, 0.55, 0)
  const armR = makeBox(0.12, 0.45, 0.12, color, 0.4, 0.55, 0)
  const screen = makeBox(0.28, 0.18, 0.04, 0x99f6e4, 0, 0.62, 0.22)
  group.add(body, head, eyeL, eyeR, armL, armR, screen)
  group.userData = { armL, armR, head, body, screen }
  return group
}

function makeWorkstation(label, x) {
  const group = new THREE.Group()
  group.position.x = x

  const desk = makeBox(1.8, 0.12, 1.0, 0xcbd5e1, 0, 0.72, 0)
  const legL = makeBox(0.1, 0.72, 0.1, 0x94a3b8, -0.7, 0.36, 0.35)
  const legR = makeBox(0.1, 0.72, 0.1, 0x94a3b8, 0.7, 0.36, 0.35)
  const legLB = makeBox(0.1, 0.72, 0.1, 0x94a3b8, -0.7, 0.36, -0.35)
  const legRB = makeBox(0.1, 0.72, 0.1, 0x94a3b8, 0.7, 0.36, -0.35)
  const monitor = makeBox(0.7, 0.45, 0.06, 0x334155, 0, 1.12, -0.28)
  const monitorStand = makeBox(0.08, 0.2, 0.08, 0x64748b, 0, 0.85, -0.28)
  const panel = makeBox(0.58, 0.34, 0.02, 0x0ea5e9, 0, 1.14, -0.245)

  group.add(desk, legL, legR, legLB, legRB, monitor, monitorStand, panel)

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, 256, 64)
  ctx.fillStyle = '#ecfdf5'
  ctx.font = 'bold 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label.slice(0, 18), 128, 32)
  const texture = new THREE.CanvasTexture(canvas)
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.3),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  )
  badge.position.set(0, 1.55, 0.2)
  group.add(badge)

  return { group, panel }
}

/**
 * Low-poly AI office scene. Desks/robots update from agent status props.
 */
export default function OfficeScene({ desks = [], runningId = '' }) {
  const mountRef = useRef(null)
  const stateRef = useRef({ desks, runningId })
  const robotsRef = useRef([])

  useEffect(() => {
    stateRef.current = { desks, runningId }
    robotsRef.current.forEach((entry) => {
      const desk = desks.find((item) => item.id === entry.id)
      if (!desk) return
      const visual = resolveVisualStatus(desk, runningId)
      const color = STATUS_COLORS[visual]
      entry.robot.userData.body.material.color.setHex(color)
      entry.robot.userData.armL.material.color.setHex(color)
      entry.robot.userData.armR.material.color.setHex(color)
      entry.panel.material.color.setHex(visual === 'busy' ? 0x60a5fa : visual === 'waiting' ? 0xfbbf24 : 0x2dd4bf)
      entry.visual = visual
    })
  }, [desks, runningId])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const width = mount.clientWidth || 640
    const height = mount.clientHeight || 320

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0fdfa)
    scene.fog = new THREE.Fog(0xf0fdfa, 12, 28)

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100)
    camera.position.set(0, 4.2, 7.2)
    camera.lookAt(0, 0.8, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x99f6e4, 1.05)
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0xffffff, 1.15)
    key.position.set(4, 8, 5)
    key.castShadow = true
    scene.add(key)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 12),
      new THREE.MeshStandardMaterial({ color: 0xd1fae5, flatShading: true, roughness: 1 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    const backWall = makeBox(18, 4, 0.2, 0xecfeff, 0, 2, -4.2)
    scene.add(backWall)
    const sideWall = makeBox(0.2, 4, 10, 0xf0fdfa, -8.5, 2, 0)
    scene.add(sideWall)

    const currentDesks = stateRef.current.desks.length
      ? stateRef.current.desks
      : [
          { id: 'membership_ops', name: 'Membership Ops' },
          { id: 'youth_insights', name: 'Youth Insights' },
        ]

    robotsRef.current = currentDesks.map((desk, index) => {
      const spacing = 3.2
      const x = (index - (currentDesks.length - 1) / 2) * spacing
      const station = makeWorkstation(desk.name || desk.id, x)
      scene.add(station.group)
      const robot = makeRobot(STATUS_COLORS.idle)
      robot.position.set(x, 0, 0.55)
      scene.add(robot)
      return { id: desk.id, robot, panel: station.panel, visual: 'idle', baseY: 0 }
    })

    let frame = 0
    let raf = 0
    const clock = new THREE.Clock()

    function onResize() {
      if (!mount) return
      const nextW = mount.clientWidth || width
      const nextH = mount.clientHeight || height
      camera.aspect = nextW / nextH
      camera.updateProjectionMatrix()
      renderer.setSize(nextW, nextH)
    }
    window.addEventListener('resize', onResize)

    function animate() {
      raf = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      frame += 1

      robotsRef.current.forEach((entry, index) => {
        const busy = entry.visual === 'busy'
        const waiting = entry.visual === 'waiting'
        entry.robot.position.y = entry.baseY + (busy ? Math.sin(t * 6 + index) * 0.04 : 0)
        entry.robot.rotation.y = Math.sin(t * (busy ? 2.2 : 0.6) + index) * (busy ? 0.18 : 0.06)
        const armSwing = busy ? Math.sin(t * 8 + index) * 0.45 : waiting ? Math.sin(t * 2) * 0.12 : 0.08
        entry.robot.userData.armR.rotation.x = -armSwing
        entry.robot.userData.armL.rotation.x = armSwing * 0.6
        entry.robot.userData.head.position.y = 1.15 + (waiting ? Math.sin(t * 3) * 0.03 : 0)
        if (frame % 20 === 0 && busy) {
          entry.panel.material.emissive = new THREE.Color(0x1d4ed8)
          entry.panel.material.emissiveIntensity = 0.35 + Math.sin(t * 10) * 0.2
        } else if (!busy) {
          entry.panel.material.emissiveIntensity = 0.05
        }
      })

      camera.position.x = Math.sin(t * 0.15) * 0.55
      camera.lookAt(0, 0.9, 0)
      renderer.render(scene, camera)
    }
    animate()

    // Apply initial colors
    stateRef.current = { desks: currentDesks, runningId: stateRef.current.runningId }
    robotsRef.current.forEach((entry) => {
      const desk = currentDesks.find((item) => item.id === entry.id)
      if (!desk) return
      const visual = resolveVisualStatus(desk, stateRef.current.runningId)
      entry.visual = visual
      const color = STATUS_COLORS[visual]
      entry.robot.userData.body.material.color.setHex(color)
      entry.robot.userData.armL.material.color.setHex(color)
      entry.robot.userData.armR.material.color.setHex(color)
    })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((mat) => mat.dispose())
          else obj.material.dispose()
        }
      })
    }
  }, [])

  return (
    <div className="office-scene-shell" aria-label="Low-poly AI office view">
      <div ref={mountRef} className="office-scene-canvas" />
      <div className="office-scene-legend" aria-hidden="true">
        <span>
          <i className="is-idle" /> Idle
        </span>
        <span>
          <i className="is-busy" /> Busy
        </span>
        <span>
          <i className="is-waiting" /> Needs approval
        </span>
        <span>
          <i className="is-failed" /> Failed
        </span>
      </div>
      <p className="muted office-scene-hint">Drag is disabled — camera gently orbits. Robot color matches live agent status.</p>
    </div>
  )
}
