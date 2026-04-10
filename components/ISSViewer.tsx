"use client"

import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useGLTF, OrbitControls, useAnimations } from "@react-three/drei"
import { Suspense, useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import * as THREE from "three"

function ISSModel() {
  const { scene } = useGLTF("/models/iss.glb")
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.05 })
  return <primitive ref={ref} object={scene} scale={0.8} position={[0, 0, 0]} />
}

function Astronaut() {
  const { scene, animations } = useGLTF("/models/astronaut.glb")
  const ref = useRef<THREE.Group>(null)
  const { actions } = useAnimations(animations, ref)

  useEffect(() => {
    const firstAction = Object.values(actions)[0]
    if (firstAction) {
      firstAction.reset().fadeIn(0.5).play()
      firstAction.setLoop(THREE.LoopRepeat, Infinity)
    }
  }, [actions])

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = 1.5 + Math.sin(state.clock.elapsedTime * 0.5) * 0.3
      ref.current.position.x = 3 + Math.sin(state.clock.elapsedTime * 0.3) * 0.2
    }
  })

  return <primitive ref={ref} object={scene} scale={0.4} position={[3, 1.5, 1]} rotation={[0, -Math.PI * 0.3, 0]} />
}

function Earth() {
  const ref = useRef<THREE.Mesh>(null)
  const cloudRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const cloudMatRef = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.025
  })

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load("/textures/earth_day_4k.jpg", (t) => {
      t.colorSpace = THREE.SRGBColorSpace
      if (matRef.current) { matRef.current.map = t; matRef.current.needsUpdate = true }
    })
    loader.load("/textures/earth_clouds_2k.jpg", (t) => {
      t.colorSpace = THREE.SRGBColorSpace
      if (cloudMatRef.current) { cloudMatRef.current.map = t; cloudMatRef.current.needsUpdate = true }
    })
  }, [])

  return (
    <group position={[0, -18, -8]}>
      <mesh ref={ref}>
        <sphereGeometry args={[14, 128, 64]} />
        <meshStandardMaterial ref={matRef} color="#1a5276" roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh ref={cloudRef}>
        <sphereGeometry args={[14.15, 64, 32]} />
        <meshStandardMaterial ref={cloudMatRef} transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} color="#ffffff" />
      </mesh>
      <mesh>
        <sphereGeometry args={[14.6, 64, 32]} />
        <meshBasicMaterial color="#4488ff" transparent opacity={0.1} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

function Stars() {
  const positions = new Float32Array(4000 * 3)
  for (let i = 0; i < 4000; i++) {
    const r = 30 + Math.random() * 50
    const th = Math.random() * Math.PI * 2
    const ph = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(ph) * Math.cos(th)
    positions[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th)
    positions[i * 3 + 2] = r * Math.cos(ph)
  }

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={4000} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#ffffff" sizeAttenuation />
    </points>
  )
}

function TetherLine() {
  const points = [
    new THREE.Vector3(0.5, 0.2, 0.3),
    new THREE.Vector3(1.5, 0.8, 0.6),
    new THREE.Vector3(2.5, 1.2, 0.8),
    new THREE.Vector3(3, 1.5, 1),
  ]
  const curve = new THREE.CatmullRomCurve3(points)
  const curvePoints = curve.getPoints(20)

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={curvePoints.length}
          array={new Float32Array(curvePoints.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.3} />
    </line>
  )
}

// Camera controller that responds to external zoom level
function CameraZoom({ zoomLevel }: { zoomLevel: number }) {
  const { camera } = useThree()

  useFrame(() => {
    // Interpolate camera distance: close (8) at zoom 0, far (20) at zoom 1
    const targetDist = 8 + zoomLevel * 12
    const currentDist = camera.position.length()
    const newDist = currentDist + (targetDist - currentDist) * 0.05
    camera.position.normalize().multiplyScalar(newDist)
  })

  return null
}

interface ISSViewerProps {
  zoomLevel?: number
}

export default function ISSViewer({ zoomLevel = 0 }: ISSViewerProps) {
  return (
    <div className="relative z-10 w-full aspect-[16/9] max-h-[50vh] overflow-hidden">
      <Canvas camera={{ position: [0, 3, 8], fov: 50 }} gl={{ antialias: true }} style={{ background: "#000" }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[-5, 5, 5]} intensity={2.5} color="#fff5e0" />
        <directionalLight position={[5, -2, -3]} intensity={0.3} color="#4466ff" />

        <Suspense fallback={null}>
          <ISSModel />
          <Astronaut />
          <TetherLine />
          <Earth />
        </Suspense>

        <Stars />
        <CameraZoom zoomLevel={zoomLevel} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.3}
        />
      </Canvas>
    </div>
  )
}
