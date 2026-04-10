"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect, useRef } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { solarSystemData } from "@/lib/planet-data"
import dynamic from "next/dynamic"
const StarField = dynamic(() => import("@/components/StarField"), { ssr: false })

const PLANET_TEXTURES: Record<string, string> = {
  sun: "/textures/2k_sun.jpg",
  mercury: "/textures/2k_mercury.jpg",
  venus: "/textures/2k_venus_surface.jpg",
  earth: "/textures/earth_day_4k.jpg",
  mars: "/textures/2k_mars.jpg",
  jupiter: "/textures/2k_jupiter.jpg",
  saturn: "/textures/2k_saturn.jpg",
  uranus: "/textures/2k_uranus.jpg",
  neptune: "/textures/2k_neptune.jpg",
  pluto: "/textures/2k_pluto.jpg",
}

const ORBIT_RADII = [0, 45, 65, 85, 110, 155, 195, 235, 270, 305]
const ORBIT_SPEEDS = [0, 4.15, 1.63, 1, 0.53, 0.084, 0.034, 0.012, 0.006, 0.004]

export default function SolarSystemPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [time, setTime] = useState(0)

  useEffect(() => {
    let raf: number
    const animate = () => {
      setTime((t) => t + 0.002)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  const allBodies = solarSystemData

  return (
    <div className="bg-black min-h-screen">
      <Header alwaysVisible />

      {/* Hero */}
      <section className="relative pt-28 pb-8 md:pt-36 md:pb-12 overflow-hidden">
        <StarField starCount={600} />
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
          <p className="text-orange-500 uppercase tracking-[0.3em] text-sm font-medium mb-4">Explore</p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6">The Solar System</h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Journey through our cosmic neighbourhood. Click any planet to explore its secrets,
            calculate your weight, discover how long you&apos;d survive, and more.
          </p>
        </div>
      </section>

      {/* Interactive Orbital Diagram */}
      <section className="relative z-30 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative aspect-square max-w-[700px] mx-auto">
            {/* Orbit rings */}
            {ORBIT_RADII.slice(1).map((r, i) => (
              <div
                key={i}
                className="absolute rounded-full border border-white/[0.06]"
                style={{
                  width: `${r * 2}px`,
                  height: `${r * 2}px`,
                  top: `50%`,
                  left: `50%`,
                  transform: `translate(-50%, -50%)`,
                }}
              />
            ))}

            {/* Sun at center */}
            <Link
              href="/solar-system/sun"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 group"
              onMouseEnter={() => setHovered("sun")}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="w-16 h-16 rounded-full overflow-hidden shadow-[0_0_40px_rgba(253,184,19,0.6)] group-hover:shadow-[0_0_60px_rgba(253,184,19,0.8)] transition-shadow">
                <Image src="/textures/2k_sun.jpg" alt="Sun" width={64} height={64} className="w-full h-full object-cover rounded-full" />
              </div>
              <span className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium transition-opacity whitespace-nowrap ${hovered === "sun" ? "text-yellow-400 opacity-100" : "text-white/40 opacity-70"}`}>
                Sun
              </span>
            </Link>

            {/* Planets orbiting */}
            {allBodies.filter(b => b.slug !== "sun").map((body, i) => {
              const radius = ORBIT_RADII[i + 1] || 300
              const speed = ORBIT_SPEEDS[i + 1] || 0.01
              const angle = time * speed * 2 + (i * Math.PI * 0.7)
              const x = Math.cos(angle) * radius
              const y = Math.sin(angle) * radius
              const planetSize = body.type === "dwarf-planet" ? 10 : Math.min(28, Math.max(12, body.radiusKm / 3500))

              return (
                <Link
                  key={body.slug}
                  href={`/solar-system/${body.slug}`}
                  className="absolute z-10 group"
                  style={{
                    top: `calc(50% + ${y}px)`,
                    left: `calc(50% + ${x}px)`,
                    transform: "translate(-50%, -50%)",
                  }}
                  onMouseEnter={() => setHovered(body.slug)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="rounded-full overflow-hidden transition-all duration-300 group-hover:scale-150"
                    style={{
                      width: `${planetSize}px`,
                      height: `${planetSize}px`,
                      boxShadow: hovered === body.slug
                        ? `0 0 24px ${body.color}90, 0 0 48px ${body.color}40, 0 0 8px ${body.color}`
                        : `0 0 8px ${body.color}40`,
                      transition: "box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                  >
                    {PLANET_TEXTURES[body.slug] ? (
                      <Image src={PLANET_TEXTURES[body.slug]} alt={body.name} width={planetSize} height={planetSize} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className="w-full h-full rounded-full" style={{ backgroundColor: body.color }} />
                    )}
                  </div>
                  <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium transition-all whitespace-nowrap ${
                    hovered === body.slug ? "opacity-100 text-white" : "opacity-0"
                  }`}>
                    {body.name}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Planet Cards Grid */}
      <section className="relative z-30 bg-black border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-white mb-8">All Bodies</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 stagger-children" ref={(el) => {
            if (!el) return
            const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.classList.add("visible") }, { threshold: 0.1 })
            obs.observe(el)
          }}>
            {allBodies.map((body) => (
              <Link
                key={body.slug}
                href={`/solar-system/${body.slug}`}
                className="group shimmer-card border-glow-hover bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 hover:border-white/20 hover:-translate-y-1 transition-all text-center flex flex-col items-center"
              >
                <div
                  className="w-14 h-14 rounded-full mb-3 transition-shadow group-hover:shadow-lg mx-auto overflow-hidden"
                  style={{ boxShadow: `0 0 12px ${body.color}40` }}
                >
                  {PLANET_TEXTURES[body.slug] ? (
                    <Image src={PLANET_TEXTURES[body.slug]} alt={body.name} width={56} height={56} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" style={{ backgroundColor: body.color }} />
                  )}
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">{body.name}</h3>
                <p className="text-white/30 text-xs">{body.tagline}</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-white/30">{body.type}</span>
                  {body.moons > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-white/30">{body.moons} moons</span>
                  )}
                </div>
              </Link>
            ))}
            {/* Black hole card */}
            <Link
              href="/solar-system/black-hole"
              className="group shimmer-card bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 hover:border-purple-500/30 hover:-translate-y-1 transition-all text-center flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-full mb-3 bg-black border-2 border-purple-500/50 shadow-[0_0_15px_rgba(139,92,246,0.3)] mx-auto" />
              <h3 className="text-white font-semibold text-sm mb-1">Black Hole</h3>
              <p className="text-white/30 text-xs">Beyond the event horizon</p>
              <div className="mt-3">
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-purple-400">Interactive 3D</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
