"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { crewData } from "@/lib/crew-data"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

import Sparkline from "@/components/Sparkline"
import { useStaggerReveal, useMagneticHover } from "@/hooks/useAnimations"
const TrajectoryViewer = dynamic(() => import("@/components/TrajectoryViewer"), { ssr: false })
const Particles = dynamic(() => import("@/components/Particles"), { ssr: false })
const VoyagerScroll = dynamic(() => import("@/components/VoyagerScroll"), { ssr: false })
import ImageGallery from "@/components/ImageGallery"

const MISSION_START = new Date("2026-04-01T00:00:00Z")
const MISSION_END = new Date("2026-04-12T00:00:00Z")

// Counter animation hook
function useCounter(target: number, duration: number, inView: boolean, isFloat = false) {
  const [count, setCount] = useState(0)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!inView || hasAnimated.current) return
    hasAnimated.current = true
    const start = performance.now()
    const step = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(isFloat ? parseFloat((eased * target).toFixed(1)) : Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, target, duration, isFloat])

  return count
}

// Intersection observer hook
function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}

// Social icon components
function XIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}


export default function Page() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [gyroActive, setGyroActive] = useState(false)
  const gyroRequested = useRef(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const [animationComplete, setAnimationComplete] = useState(false)
  const hasSeenAnimation = useRef(false)
  // Header/footer are now shared components
  const frameRef = useRef<number>(0)
  const lastUpdateRef = useRef<number>(0)

  // Counter animation
  const statsView = useInView(0.3)
  const distCount = useCounter(384400, 2000, statsView.inView)
  const daysCount = useCounter(10, 1500, statsView.inView)
  const crewCount = useCounter(4, 1000, statsView.inView)
  const yearsCount = useCounter(50, 1800, statsView.inView)

  // Fade-in observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible")
        })
      },
      { threshold: 0.1 }
    )
    document.querySelectorAll(".fade-section").forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  /**
   * Request gyro permission silently on the user's first natural touch.
   * iOS requires requestPermission to be called from a user gesture,
   * so we hook into the first touchstart instead of showing a button.
   */
  const requestOrientationSilently = useCallback(async () => {
    if (gyroRequested.current) return
    gyroRequested.current = true
    if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      try {
        const state = await (DeviceOrientationEvent as any).requestPermission()
        if (state === "granted") {
          setGyroActive(true)
          setShouldAnimate(true)
        }
      } catch {
        // User denied the native browser prompt - parallax just uses mouse/scroll
      }
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX - window.innerWidth / 2) / window.innerWidth
      const y = (e.clientY - window.innerHeight / 2) / window.innerHeight
      setMousePosition({ x, y })
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const now = Date.now()
      if (now - lastUpdateRef.current < 16) return
      lastUpdateRef.current = now
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(() => {
        const isLandscape = window.innerWidth > window.innerHeight
        const x = isLandscape
          ? Math.max(-1, Math.min(1, (e.beta || 0) / 45))
          : Math.max(-1, Math.min(1, (e.gamma || 0) / 45))
        setMousePosition({ x, y: 0 })
      })
    }

    const isTouchDevice =
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0

    if (isTouchDevice) {
      if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
        // iOS: request on first natural touch instead of showing a button
        window.addEventListener("touchstart", requestOrientationSilently, { once: true })
      } else {
        // Android/other: gyro available without permission
        setGyroActive(true)
        setShouldAnimate(true)
      }
    } else {
      window.addEventListener("mousemove", handleMouseMove)
      setShouldAnimate(true)
    }

    if (gyroActive) {
      window.addEventListener("deviceorientation", handleOrientation)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("touchstart", requestOrientationSilently)
      window.removeEventListener("deviceorientation", handleOrientation)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [gyroActive, requestOrientationSilently])

  // Lock scroll during hero animation, unlock when complete
  // Only play animation on first visit per session
  useEffect(() => {
    const seen = sessionStorage.getItem("heroAnimationSeen")
    if (seen) {
      // Skip animation entirely on repeat visits
      hasSeenAnimation.current = true
      setAnimationComplete(true)
      // Don't set shouldAnimate - elements render at default (final) position with no animation
      return
    }

    // First visit: play full animation
    document.body.style.overflow = "hidden"
    const animTimer = setTimeout(() => {
      setAnimationComplete(true)
      sessionStorage.setItem("heroAnimationSeen", "1")
    }, 8000)
    const unlockTimer = setTimeout(() => {
      document.body.style.overflow = ""
    }, 8500)

    // Allow header nav clicks to skip the hero animation instantly
    const skipAnimation = () => {
      clearTimeout(animTimer)
      clearTimeout(unlockTimer)
      setAnimationComplete(true)
      setShouldAnimate(true)
      sessionStorage.setItem("heroAnimationSeen", "1")
      document.body.style.overflow = ""
    }
    window.addEventListener("skip-hero-animation", skipAnimation)

    return () => {
      clearTimeout(animTimer)
      clearTimeout(unlockTimer)
      window.removeEventListener("skip-hero-animation", skipAnimation)
      document.body.style.overflow = ""
    }
  }, [])

  // Staggered reveal for crew cards
  const crewStagger = useStaggerReveal(4, { staggerMs: 80 })
  // Staggered reveal for mission cards
  const missionStagger = useStaggerReveal(3, { staggerMs: 100 })
  // Magnetic hover for CTA section
  const ctaMagnetic = useMagneticHover(6)

  const crew = crewData

  const gallery = [
    { src: "/images/mission/launch.webp", caption: "SLS lifts off from Pad 39B, April 1, 2026" },
    { src: "/images/mission/flyby-1.webp", caption: "Earthrise over the lunar far side from Orion" },
    { src: "/images/mission/crew-portrait.webp", caption: "The Artemis II crew at Kennedy Space Center" },
    { src: "/images/mission/journey-1.webp", caption: "Orion spacecraft on approach to the Moon" },
    { src: "/images/mission/earth-view.webp", caption: "Earth as seen from beyond the Moon" },
    { src: "/images/mission/farside.webp", caption: "The lunar far side, rarely seen by human eyes" },
    { src: "/images/mission/flyby-2.webp", caption: "Orion during the powered flyby maneuver" },
    { src: "/images/mission/splashdown.webp", caption: "Crew celebration aboard Orion after flyby" },
    { src: "/images/mission/training.webp", caption: "Crew training in the Orion simulator" },
    { src: "/images/mission/orion-pad.webp", caption: "Artemis II SLS and Orion on the launch pad" },
    { src: "/images/mission/flyby-3.webp", caption: "View of lunar terrain during closest approach" },
    { src: "/images/mission/flight-highlight.webp", caption: "Mission highlight from deep space operations" },
  ]

  const now = new Date()
  const isMissionLive = now >= MISSION_START && now <= MISSION_END

  return (
    <div className="bg-black">
      <Header />
      {/* Hero Section */}
      <section className="relative h-dvh w-full overflow-hidden bg-black">
        <div
          className={`absolute inset-0 ${shouldAnimate ? "zoom-layer-1" : ""}`}
          style={{
            transform: `translate3d(${mousePosition.x * 30}px, ${mousePosition.y * 30}px, 0)`,
            willChange: "transform",
            width: "130%", height: "130%", left: "-15%", top: "-15%",
          }}
        >
          <Image src="/images/moon.webp" alt="Moon from space" fill className="object-cover" priority />
        </div>

        <div
          className={`absolute z-5 ${shouldAnimate ? "zoom-layer-iss" : ""}`}
          style={{
            transform: `translate3d(${mousePosition.x * 50}px, ${mousePosition.y * 50}px, 0) scale(0.75)`,
            willChange: "transform",
            width: "min(800px, 100vw)", height: "min(800px, 100vw)", left: "20px", top: "20px",
          }}
        >
          <Image src="/images/ISS.webp" alt="International Space Station" fill className="object-contain" />
        </div>

        <div
          className={`absolute inset-0 z-10 ${shouldAnimate ? "zoom-layer-2" : ""}`}
          style={{
            transform: `translate3d(${mousePosition.x * 60}px, ${mousePosition.y * 60}px, 0)`,
            willChange: "transform",
            width: "130%", height: "130%", left: "-15%", top: "-15%",
          }}
        >
          <Image src="/images/mars-2.webp" alt="Spacecraft interior window" fill className="object-cover" />
        </div>

        <div
          className={`absolute inset-0 flex items-center justify-center z-10 px-6 ${shouldAnimate ? "zoom-layer-text" : ""}`}
          style={{
            transform: `translate3d(${mousePosition.x * 90}px, ${mousePosition.y * 90}px, 0)`,
            willChange: "transform",
            perspective: "1000px",
          }}
        >
          <div className="flex text-[80px] sm:text-[120px] md:text-[160px] lg:text-[200px]">
            {"ARTEMIS".split("").map((letter, index) => (
              <span
                key={index}
                className={`font-bold text-white ${shouldAnimate ? "letter-rotate" : ""}`}
                style={{ display: "inline-block", transformStyle: "preserve-3d" }}
              >
                {letter}
              </span>
            ))}
          </div>
        </div>

        <div
          className={`absolute inset-0 z-20 ${shouldAnimate ? "zoom-layer-3" : ""}`}
          style={{
            transform: `translate3d(${mousePosition.x * 120}px, ${mousePosition.y * 120}px, 0)`,
            willChange: "transform",
            width: "110%", height: "110%", left: "-5%", top: "calc(-5% + 150px)",
          }}
        >
          <Image src="/images/mars-3.webp" alt="Astronaut in orange spacesuit" fill className="object-cover" />
        </div>

        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-30 transition-opacity duration-1000 ${animationComplete ? "opacity-100" : "opacity-0"}`}>
          <div className="flex flex-col items-center gap-2 text-white/70">
            <span className="text-sm tracking-[0.3em] uppercase">Scroll to explore</span>
            <div className="scroll-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Live Stream Banner -only visible during mission */}
      {isMissionLive && (
        <section className="relative z-30 bg-black">
          <a
            href="https://www.youtube.com/watch?v=m3kR2KK8TEs"
            target="_blank"
            rel="noopener noreferrer"
            className="block border-y border-red-500/20 bg-gradient-to-r from-red-950/40 via-red-900/20 to-red-950/40 hover:from-red-950/60 hover:via-red-900/30 hover:to-red-950/60 transition-all duration-300 group"
          >
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-red-400 font-bold text-sm uppercase tracking-wider">Live Now</span>
              </div>
              <span className="text-white/80 text-sm md:text-base">
                Artemis II crew is currently in space &mdash; watch the NASA live stream
              </span>
              <span className="text-white/40 group-hover:text-white/60 transition-colors text-sm flex items-center gap-1">
                Watch on YouTube
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M7 17l9.2-9.2M17 17V7.8M17 7.8H7.8" />
                </svg>
              </span>
            </div>
          </a>
        </section>
      )}

      {/* Mission Section */}
      <section id="mission" className="relative z-30 bg-black scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6 py-32">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="fade-section">
              <p className="text-orange-500 uppercase tracking-[0.3em] text-sm mb-4">Artemis II</p>
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
                First Crewed<br />Lunar Flyby
              </h2>
              <p className="text-white/60 text-lg leading-relaxed mb-6">
                NASA&apos;s first crewed lunar flyby in over 50 years. Artemis II is the first crewed
                test flight of the SLS rocket and Orion spacecraft, sending four astronauts around
                the Moon on an approximately 10-day mission, a key step toward a long-term return
                to the lunar surface and future crewed missions to Mars.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="px-3 py-1.5 bg-orange-600/20 border border-orange-500/30 rounded-full text-orange-400 text-sm glow-pulse">April 1, 2026</span>
                <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-white/50 text-sm">~10 Day Mission</span>
                <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-white/50 text-sm">Launch Complex 39B</span>
              </div>
            </div>
            <div className="fade-section relative aspect-[4/3] rounded-2xl overflow-hidden">
              <Image src="/images/mission/launch.webp" alt="SLS rocket launch" fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Animated Stats */}
      <section className="relative z-30 bg-black border-t border-white/10">
        <div ref={statsView.ref} className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center flex flex-col items-center">
              <div className="text-3xl md:text-5xl font-bold text-white mb-1 font-mono tabular-nums">
                {distCount.toLocaleString()}<span className="text-orange-500 text-lg md:text-2xl ml-1">km</span>
              </div>
              <p className="text-white/40 text-sm uppercase tracking-wider mb-3">Distance to the Moon</p>
              <Sparkline data={[6,30,80,150,250,340,384,413,380,300,200,100,40,10,6]} width={120} height={28} />
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="text-3xl md:text-5xl font-bold text-white mb-1 font-mono tabular-nums">
                ~{daysCount}<span className="text-orange-500 text-lg md:text-2xl ml-1">days</span>
              </div>
              <p className="text-white/40 text-sm uppercase tracking-wider mb-3">Mission Duration</p>
              <Sparkline data={[0,1,2,3,4,5,6,7,8,9,10]} width={120} height={28} color="#22c55e" fillColor="rgba(34,197,94,0.1)" />
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="text-3xl md:text-5xl font-bold text-white mb-1 font-mono tabular-nums">
                {crewCount}<span className="text-orange-500 text-lg md:text-2xl ml-1">crew</span>
              </div>
              <p className="text-white/40 text-sm uppercase tracking-wider mb-3">Astronauts Aboard</p>
              <div className="flex gap-2 mt-1">
                {["W","G","K","H"].map((l,i) => (
                  <div key={i} className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[10px] text-orange-400 font-bold">{l}</div>
                ))}
              </div>
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="text-3xl md:text-5xl font-bold text-white mb-1 font-mono tabular-nums">
                {yearsCount}+<span className="text-orange-500 text-lg md:text-2xl ml-1">years</span>
              </div>
              <p className="text-white/40 text-sm uppercase tracking-wider mb-3">Since Last Lunar Crew</p>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-white/30 font-mono">1972</span>
                <div className="w-16 h-px bg-gradient-to-r from-white/20 to-orange-500/60 relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/30" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-orange-500" />
                </div>
                <span className="text-[10px] text-orange-400 font-mono">2026</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Artemis Program - All Phases */}
      <section className="relative z-30 bg-black border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-32">
          <div className="text-center mb-16 fade-section">
            <p className="text-orange-500 uppercase tracking-[0.3em] text-sm mb-4">The Program</p>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">Return to the Moon</h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              From proving the technology to building a permanent lunar presence,
              each Artemis mission is a stepping stone toward Mars.
            </p>
          </div>

          {/* Phase 1: Proving the System */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8 fade-section">
              <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                <span className="text-white/50 text-xs font-medium uppercase tracking-wider">Phase 1</span>
              </div>
              <h3 className="text-xl font-bold text-white">Proving the System</h3>
            </div>

            <div ref={missionStagger.containerRef} className="grid md:grid-cols-3 gap-6">
              {/* Artemis I */}
              <div style={missionStagger.getItemStyle(0)} className="shimmer-card border-glow-hover bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden group hover:border-white/15 transition-colors">
                <div className="relative h-44 overflow-hidden">
                  <Image src="/images/mission/crew-group.webp" alt="Lunar surface from Artemis I" fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                  <div className="absolute bottom-3 left-4">
                    <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-semibold rounded">Completed</span>
                  </div>
                </div>
                <div className="p-5">
                  <h4 className="text-xl font-bold text-white mb-1">Artemis I</h4>
                  <p className="text-orange-400 text-xs mb-3">November 2022 | Uncrewed</p>
                  <p className="text-white/50 text-sm leading-relaxed mb-3">
                    First full test of SLS and Orion. Travelled 2.25M km over 25.5 days, orbiting 130 km above the Moon and venturing 64,373 km beyond it into deep space. Validated heat shield, navigation, and deep-space systems.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">25.5 days</span>
                    <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">Heat shield tested</span>
                    <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">Uncrewed</span>
                  </div>
                </div>
              </div>

              {/* Artemis II */}
              <div style={missionStagger.getItemStyle(1)} className="shimmer-card bg-orange-500/[0.08] border border-orange-500/25 rounded-2xl overflow-hidden group">
                <div className="relative h-44 overflow-hidden">
                  <Image src="/images/mission/flyby-1.webp" alt="Earthrise from Artemis II" fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                  <div className="absolute bottom-3 left-4">
                    <span className="px-2 py-0.5 bg-orange-600 text-white text-xs font-semibold rounded">In Progress</span>
                  </div>
                </div>
                <div className="p-5">
                  <h4 className="text-xl font-bold text-white mb-1">Artemis II</h4>
                  <p className="text-orange-400 text-xs mb-3">April 2026 | 4 Crew</p>
                  <p className="text-white/50 text-sm leading-relaxed mb-3">
                    First crewed lunar flyby since Apollo 17 (1972). Testing life support, manual control, and radiation environment in deep space. Free-return trajectory reaching 413,146 km from Earth, surpassing Apollo 13's record.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 bg-orange-500/15 border border-orange-500/20 rounded text-orange-400">~10 days</span>
                    <span className="text-[11px] px-2 py-0.5 bg-orange-500/15 border border-orange-500/20 rounded text-orange-400">Lunar flyby</span>
                    <span className="text-[11px] px-2 py-0.5 bg-orange-500/15 border border-orange-500/20 rounded text-orange-400">Distance record</span>
                  </div>
                </div>
              </div>

              {/* Artemis III */}
              <div style={missionStagger.getItemStyle(2)} className="shimmer-card border-glow-hover bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden group hover:border-white/15 transition-colors">
                <div className="relative h-44 overflow-hidden">
                  <Image src="/images/moon.webp" alt="Lunar south pole" fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                  <div className="absolute bottom-3 left-4">
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded">~2027</span>
                  </div>
                </div>
                <div className="p-5">
                  <h4 className="text-xl font-bold text-white mb-1">Artemis III</h4>
                  <p className="text-orange-400 text-xs mb-3">~2027 | Lander Test</p>
                  <p className="text-white/50 text-sm leading-relaxed mb-3">
                    First integration of Orion with a commercial Human Landing System (SpaceX Starship or Blue Origin). Tests rendezvous, docking, and lander operations. Originally the first landing mission, now focused on validating landing architecture.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">HLS test</span>
                    <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">Orbital docking</span>
                    <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">Commercial partners</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Phase 2: Building Infrastructure */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8 fade-section">
              <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                <span className="text-white/50 text-xs font-medium uppercase tracking-wider">Phase 2</span>
              </div>
              <h3 className="text-xl font-bold text-white">Building Lunar Infrastructure</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Artemis IV */}
              <div className="fade-section shimmer-card border-glow-hover bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:border-white/15 transition-colors">
                <div className="flex items-baseline gap-3 mb-3">
                  <h4 className="text-xl font-bold text-white">Artemis IV</h4>
                  <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[11px] font-semibold rounded">~2028</span>
                </div>
                <p className="text-white/50 text-sm leading-relaxed mb-4">
                  First mission to the Lunar Gateway, a small space station orbiting the Moon. Delivers habitat modules and enables the first sustained crewed lunar landing. Some crew stay in Gateway orbit while others descend to the surface for ~30-day missions.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">Lunar Gateway</span>
                  <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">Surface landing</span>
                  <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">~30 days</span>
                </div>
              </div>

              {/* Artemis V */}
              <div className="fade-section shimmer-card border-glow-hover bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:border-white/15 transition-colors">
                <div className="flex items-baseline gap-3 mb-3">
                  <h4 className="text-xl font-bold text-white">Artemis V</h4>
                  <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[11px] font-semibold rounded">Late 2028+</span>
                </div>
                <p className="text-white/50 text-sm leading-relaxed mb-4">
                  Expands long-term operations with advanced landers, rovers, and surface systems. Longer surface stays enable deeper scientific exploration, including searches for water ice at the lunar south pole. Regular crew rotations begin.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">Rovers</span>
                  <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">Extended stays</span>
                  <span className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">Water ice search</span>
                </div>
              </div>
            </div>
          </div>

          {/* Phase 3: Permanent Presence */}
          <div>
            <div className="flex items-center gap-3 mb-8 fade-section">
              <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                <span className="text-white/50 text-xs font-medium uppercase tracking-wider">Phase 3</span>
              </div>
              <h3 className="text-xl font-bold text-white">Permanent Lunar Presence</h3>
            </div>

            <div className="fade-section shimmer-card border-glow-hover bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:border-white/15 transition-colors">
              <div className="flex items-baseline gap-3 mb-3">
                <h4 className="text-xl font-bold text-white">Artemis VI and Beyond</h4>
                <span className="px-2 py-0.5 bg-purple-600/20 text-purple-400 text-[11px] font-semibold rounded">2030s</span>
              </div>
              <p className="text-white/50 text-sm leading-relaxed mb-4">
                Regular missions to rotate crews, expand the Lunar Gateway, and build a permanent lunar base.
                Scientific research, resource extraction (water ice for fuel and life support), and testing technologies
                needed for the ultimate goal: sending humans to Mars. The Moon becomes a stepping stone to the rest of the solar system.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-white font-mono text-lg font-bold">Base</p>
                  <p className="text-white/30 text-[10px] uppercase tracking-wider">Permanent habitat</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-white font-mono text-lg font-bold">ISRU</p>
                  <p className="text-white/30 text-[10px] uppercase tracking-wider">Resource extraction</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-white font-mono text-lg font-bold">Mars</p>
                  <p className="text-white/30 text-[10px] uppercase tracking-wider">Prep for deep space</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-white font-mono text-lg font-bold">Crew</p>
                  <p className="text-white/30 text-[10px] uppercase tracking-wider">Regular rotations</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Crew Section */}
      <section id="crew" className="relative z-30 bg-black border-t border-white/10 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6 py-32">
          <div className="text-center mb-20 fade-section">
            <p className="text-orange-500 uppercase tracking-[0.3em] text-sm mb-4">The Crew</p>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">Artemis II Astronauts</h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              Four astronauts chosen to fly humanity&apos;s return to the Moon: veterans of combat,
              spacewalks, record-breaking missions, and international collaboration.
            </p>
          </div>

          <div ref={crewStagger.containerRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-5">
            {crew.map((member, i) => (
              <div key={i} style={crewStagger.getItemStyle(i)} className="group shimmer-card border-glow-hover bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-500/5 transition-all duration-300">
                {/* Image */}
                <div className="relative aspect-[3/4] overflow-hidden">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  {/* Agency logo */}
                  <div className="absolute top-3 right-3 w-10 h-10 drop-shadow-lg">
                    <Image
                      src={member.agency === "NASA" ? "/images/nasa.webp" : "/images/CSA.png"}
                      alt={member.agency}
                      width={40}
                      height={40}
                      className="object-contain"
                    />
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-lg font-bold text-white leading-tight">{member.name}</h3>
                    <p className="text-orange-400 text-sm font-medium">{member.role}</p>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col gap-3">
                  {/* Social links -stacked vertically to prevent overflow */}
                  <div className="flex flex-col gap-2">
                    <a
                      href={`https://x.com/${member.x}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 transition-all text-white/50 hover:text-white min-w-0"
                    >
                      <XIcon />
                      <span className="text-xs truncate">@{member.x}</span>
                    </a>
                    <a
                      href={`https://instagram.com/${member.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 transition-all text-white/50 hover:text-white min-w-0"
                    >
                      <InstagramIcon />
                      <span className="text-xs truncate">@{member.instagram}</span>
                    </a>
                  </div>

                  <p className="text-white/50 text-sm leading-relaxed">{member.bio}</p>

                  <div className="bg-orange-500/5 border border-orange-500/15 rounded-lg p-3">
                    <p className="text-orange-300/70 text-xs font-medium uppercase tracking-wider mb-1">Fun Fact</p>
                    <p className="text-white/50 text-xs leading-relaxed">{member.funFact}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {member.highlights.map((h, j) => (
                      <span key={j} className="text-[11px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/40">{h}</span>
                    ))}
                  </div>

                  <Link
                    href={`/crew/${member.slug}`}
                    className="mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600/10 border border-orange-500/20 rounded-lg text-orange-400 text-sm font-medium hover:bg-orange-600/20 hover:border-orange-500/40 transition-all opacity-0 group-hover:opacity-100"
                  >
                    View Profile
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3D Trajectory Viewer */}
      <section id="trajectory" className="relative z-30 bg-black border-t border-white/10 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6 py-32">
          <div className="text-center mb-12 fade-section">
            <p className="text-orange-500 uppercase tracking-[0.3em] text-sm mb-4">Interactive</p>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">Flight Path</h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              Explore the Artemis II free-return trajectory in 3D. See how lunar gravity slings Orion
              around the Moon and back to Earth with no fuel needed for the return trip.
            </p>
          </div>
          <div className="fade-section">
            <TrajectoryViewer />
          </div>
        </div>
      </section>

      {/* Photo Gallery */}
      <ImageGallery images={gallery} />

      {/* Lunar Flyby Banner */}
      <section className="relative z-30 bg-black">
        <div className="relative w-full h-[60vh] overflow-hidden">
          <Image src="/images/mission/orion-flyby.webp" alt="Orion spacecraft lunar flyby" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center fade-section">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Beyond the Far Side</h2>
              <p className="text-white/60 text-lg max-w-xl mx-auto">
                Orion travelled farther than any spacecraft built for humans has ever flown,
                passing behind the Moon before returning safely to Earth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Voyager - Scroll-linked frame animation */}
      <VoyagerScroll />

      {/* Heritage */}
      <section className="relative z-30 bg-black border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-32">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="fade-section relative aspect-video rounded-2xl overflow-hidden order-2 md:order-1">
              <Image src="/images/mission/crew-group.webp" alt="Lunar surface close-up" fill className="object-cover" />
            </div>
            <div className="fade-section order-1 md:order-2">
              <p className="text-orange-500 uppercase tracking-[0.3em] text-sm mb-4">Heritage</p>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Built on Decades of Discovery</h2>
              <p className="text-white/60 text-lg leading-relaxed mb-6">
                From the International Space Station to deep space, each mission builds on
                the knowledge of those before it. Artemis carries forward this legacy with
                next-generation technology and an unwavering commitment to exploration.
              </p>
              <div className="flex gap-4">
                <div className="px-4 py-2 border border-white/20 rounded-lg text-white/60 text-sm">20+ years of ISS operations</div>
                <div className="px-4 py-2 border border-white/20 rounded-lg text-white/60 text-sm">International collaboration</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="relative z-30 bg-black border-t border-white/10 overflow-hidden">
        <div className="absolute inset-0">
          <Particles
            particleColors={["#ffffff", "#f0f0ff", "#e8e8f0", "#fff8f0", "#f5f5ff"]}
            particleCount={200}
            particleSpread={10}
            speed={0.1}
            particleBaseSize={100}
            moveParticlesOnHover
            alphaParticles={false}
            disableRotation={false}
            pixelRatio={1}
          />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-32 text-center">
          <div className="fade-section">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">Join the Journey</h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto mb-12">
              The next era of space exploration begins now. Stay connected with the
              Artemis program and be part of something greater than ourselves.
            </p>
            <div ref={ctaMagnetic.ref} style={ctaMagnetic.style} className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/solar-system" className="group press-spring shimmer-card border-glow-hover flex items-center gap-3 px-6 py-4 bg-white/[0.04] border border-white/10 rounded-xl hover:bg-white/[0.08] hover:border-white/20 transition-all">
                <span className="text-xl">🪐</span>
                <div className="text-left">
                  <p className="text-white font-semibold text-sm">Explore the Solar System</p>
                  <p className="text-white/40 text-xs">Journey through our cosmic neighbourhood</p>
                </div>
              </a>
              <a href="/#crew" className="group press-spring shimmer-card border-glow-hover flex items-center gap-3 px-6 py-4 bg-white/[0.04] border border-white/10 rounded-xl hover:bg-white/[0.08] hover:border-white/20 transition-all">
                <span className="text-xl">👨‍🚀</span>
                <div className="text-left">
                  <p className="text-white font-semibold text-sm">Meet the Crew</p>
                  <p className="text-white/40 text-xs">The astronauts flying to the Moon</p>
                </div>
              </a>
              <a href="/technology" className="group press-spring shimmer-card border-glow-hover flex items-center gap-3 px-6 py-4 bg-white/[0.04] border border-white/10 rounded-xl hover:bg-white/[0.08] hover:border-white/20 transition-all">
                <span className="text-xl">🚀</span>
                <div className="text-left">
                  <p className="text-white font-semibold text-sm">The Technology</p>
                  <p className="text-white/40 text-xs">SLS, Orion, and the engineering</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <style jsx>{`
        .zoom-layer-1 { animation: zoomOut1 8s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .zoom-layer-iss { animation: zoomOutIss 8s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .zoom-layer-2 { animation: zoomOut2 8s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .zoom-layer-3 { animation: zoomOut3 8s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .zoom-layer-text { animation: zoomOutText 8s cubic-bezier(0.4, 0, 0.2, 1) forwards; }

        @keyframes zoomOut1 { 0% { scale: 1.3; } 100% { scale: 1; } }
        @keyframes zoomOutIss { 0% { scale: 1.5; } 100% { scale: 0.75; } }
        @keyframes zoomOut2 { 0% { scale: 2.5; filter: blur(20px); } 50% { filter: blur(10px); } 100% { scale: 1; filter: blur(0px); } }
        @keyframes zoomOut3 { 0% { scale: 8; filter: blur(40px); opacity: 0; } 30% { filter: blur(25px); opacity: 0.3; } 70% { filter: blur(10px); opacity: 0.7; } 100% { scale: 1; filter: blur(0px); opacity: 1; } }
        @keyframes zoomOutText { 0% { scale: 3.5; opacity: 0; } 40% { opacity: 0.3; } 70% { opacity: 0.7; } 100% { scale: 1; opacity: 1; } }

        .letter-rotate { animation: rotateText 8s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        @keyframes rotateText { 0% { transform: rotateY(90deg); filter: blur(30px); opacity: 0; } 40% { filter: blur(15px); opacity: 0.5; } 70% { filter: blur(5px); opacity: 0.8; } 100% { transform: rotateY(0deg); filter: blur(0px); opacity: 1; } }

        .scroll-arrow { animation: bounceDown 2s ease-in-out infinite; }
        @keyframes bounceDown { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(8px); } }

        .fade-section { opacity: 0; transform: translateY(40px); transition: opacity 0.8s ease, transform 0.8s ease; }
        .fade-section.visible { opacity: 1; transform: translateY(0); }
      `}</style>
    </div>
  )
}
