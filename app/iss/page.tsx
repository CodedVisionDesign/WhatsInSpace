"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import dynamic from "next/dynamic"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faSatellite, faClock, faUsers, faFlask, faEye, faHistory, faUtensils, faDumbbell, faBed, faMicroscope } from "@fortawesome/free-solid-svg-icons"

const ISSViewer = dynamic(() => import("@/components/ISSViewer"), { ssr: false })
const StarField = dynamic(() => import("@/components/StarField"), { ssr: false })

const STATS = [
  { label: "Orbital altitude", value: "408 km", detail: "Low Earth Orbit" },
  { label: "Speed", value: "27,600 km/h", detail: "7.66 km/s" },
  { label: "Orbital period", value: "92 minutes", detail: "~15.5 orbits per day" },
  { label: "Mass", value: "420,000 kg", detail: "Largest structure in orbit" },
  { label: "Length", value: "109 m", detail: "About the size of a football field" },
  { label: "Width (truss)", value: "73 m", detail: "Solar array span" },
  { label: "Pressurized volume", value: "916 m\u00B3", detail: "Roughly a Boeing 747" },
  { label: "Crew capacity", value: "6-7", detail: "Continuous occupation since 2000" },
]

const MODULES = [
  { name: "Zarya", year: "1998", country: "Russia", description: "The first module launched. Provided initial power, propulsion, and guidance during early assembly." },
  { name: "Unity (Node 1)", year: "1998", country: "USA", description: "First US-built node, connecting Russian and American segments. Has six docking ports." },
  { name: "Zvezda", year: "2000", country: "Russia", description: "Service module providing life support, living quarters, and station control for the Russian segment." },
  { name: "Destiny", year: "2001", country: "USA", description: "Primary research laboratory for US payloads. Houses 24 equipment racks for experiments." },
  { name: "Columbus", year: "2008", country: "ESA", description: "European research laboratory. Supports experiments in fluid physics, materials science, and life sciences." },
  { name: "Kibo", year: "2008-09", country: "Japan", description: "Largest single module. Includes a pressurized lab, logistics module, exposed experiment platform, and robotic arm." },
  { name: "Cupola", year: "2010", country: "ESA", description: "Seven-window observation dome providing a 360-degree view of Earth and space. Used for robotic arm operations." },
  { name: "Tranquility (Node 3)", year: "2010", country: "USA", description: "Houses life support systems including water recycling, oxygen generation, and carbon dioxide removal." },
]

const DAILY_SCHEDULE = [
  { time: "06:00", activity: "Wake up", icon: faBed, description: "Astronauts sleep in private crew quarters in sleeping bags attached to the wall." },
  { time: "06:30", activity: "Morning routine & breakfast", icon: faUtensils, description: "Personal hygiene (no showers - wet wipes only) and rehydrated or thermostabilized meals." },
  { time: "08:00", activity: "Daily planning conference", icon: faUsers, description: "Video call with mission control centers in Houston, Moscow, and partner agencies." },
  { time: "08:30", activity: "Science experiments", icon: faFlask, description: "5-6 hours of research: microgravity experiments, medical studies, technology demos." },
  { time: "12:30", activity: "Lunch", icon: faUtensils, description: "Crew gathers to eat together when possible. Food includes tortillas (crumbs are dangerous in microgravity)." },
  { time: "13:30", activity: "More experiments & maintenance", icon: faMicroscope, description: "Station maintenance, repairs, software updates, and continuing research." },
  { time: "17:30", activity: "Exercise (2 hours mandatory)", icon: faDumbbell, description: "Treadmill, stationary bike, and resistive exercise device. Without exercise, astronauts lose 1-2% bone mass per month." },
  { time: "19:30", activity: "Dinner & free time", icon: faUtensils, description: "Evening meal, personal calls to family, photography, reading, or watching Earth from the Cupola." },
  { time: "21:30", activity: "Sleep (8.5 hours)", icon: faBed, description: "Crew quarters block light and noise. The ISS experiences 16 sunrises and sunsets per day." },
]

const SCIENCE_AREAS = [
  { title: "Microgravity Research", description: "Without gravity masking subtle forces, scientists can study fluid dynamics, combustion, crystal growth, and material properties impossible to observe on Earth. Results have improved manufacturing processes and medications." },
  { title: "Human Health", description: "Astronauts' bodies are studied extensively: bone density loss, muscle atrophy, vision changes, immune system changes, and psychological effects of isolation. This data is essential for planning Mars missions." },
  { title: "Earth Observation", description: "The ISS orbits at the perfect altitude for monitoring climate change, natural disasters, urban growth, and agricultural patterns. Astronauts have taken over 4 million photographs of Earth." },
  { title: "Technology Testing", description: "The ISS tests new technologies in the space environment: life support systems, water recycling, radiation shielding, robotic systems, and communication technologies for future deep-space missions." },
]

const HISTORY = [
  { year: "1998", event: "Zarya module launched (Nov 20), followed by Unity (Dec 4). Assembly begins." },
  { year: "2000", event: "Expedition 1 arrives (Nov 2). Continuous human occupation begins." },
  { year: "2001", event: "Destiny laboratory installed. Canadarm2 robotic arm attached." },
  { year: "2008", event: "Columbus (ESA) and Kibo (JAXA) laboratories added. Station at major milestone." },
  { year: "2010", event: "Cupola observation dome and Tranquility node installed." },
  { year: "2011", event: "Space Shuttle program ends. Station construction essentially complete." },
  { year: "2020", event: "SpaceX Crew Dragon begins regular crew flights. Commercial crew era starts." },
  { year: "2024", event: "25 years of continuous human occupation. Over 270 people from 21 countries have visited." },
  { year: "2030", event: "Planned deorbit. Will be deliberately brought down over the Pacific Ocean." },
]

export default function ISSPage() {
  const [zoomLevel, setZoomLevel] = useState(0)
  const heroRef = useRef<HTMLElement>(null)
  const zoomComplete = useRef(false)

  // Scroll-driven zoom: capture wheel in hero, zoom out, then release
  const handleWheel = useCallback((e: WheelEvent) => {
    if (zoomComplete.current) return // Already zoomed out, let page scroll

    const delta = e.deltaY
    if (delta > 0) {
      // Scrolling down - zoom out
      e.preventDefault()
      setZoomLevel(prev => {
        const next = Math.min(1, prev + delta * 0.002)
        if (next >= 1) zoomComplete.current = true
        return next
      })
    } else if (delta < 0 && !zoomComplete.current) {
      // Scrolling up - zoom back in (only if not yet released)
      e.preventDefault()
      setZoomLevel(prev => Math.max(0, prev + delta * 0.002))
    }
  }, [])

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    hero.addEventListener("wheel", handleWheel, { passive: false })
    return () => hero.removeEventListener("wheel", handleWheel)
  }, [handleWheel])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible")
        })
      },
      { threshold: 0.15 }
    )
    document.querySelectorAll(".timeline-item").forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="bg-black min-h-screen">
      <Header alwaysVisible />

      {/* Hero with scroll-driven zoom */}
      <section ref={heroRef} className="relative pt-24 pb-8 md:pt-32 md:pb-12 overflow-hidden">
        <StarField starCount={700} />
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-4 float-subtle">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-white/50 text-xs uppercase tracking-wider">Currently in orbit</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4">International Space Station</h1>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              Humanity&apos;s outpost in low Earth orbit. Continuously inhabited since November 2000,
              the ISS is the largest structure ever built in space.
            </p>
          </div>

          {/* 3D EVA Scene */}
          <ISSViewer zoomLevel={zoomLevel} />
          <p className="text-white/20 text-xs text-center mt-2">
            EVA spacewalk simulation. Drag to orbit, scroll to zoom. ISS model with animated astronaut.
          </p>
        </div>
      </section>

      {/* Key Stats */}
      <section className="relative z-30 bg-black border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex items-center gap-3 mb-8">
            <FontAwesomeIcon icon={faSatellite} className="w-5 h-5 text-orange-400" />
            <h2 className="text-3xl font-bold text-white">By The Numbers</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children" ref={(el) => {
            if (!el) return
            const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.classList.add("visible") }, { threshold: 0.15 })
            obs.observe(el)
          }}>
            {STATS.map((stat, i) => (
              <div key={i} className="shimmer-card border-glow-hover bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-white font-mono text-lg font-bold">{stat.value}</p>
                <p className="text-white/20 text-xs mt-1">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="relative z-30 bg-black border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-white mb-3">Modules & Structure</h2>
          <p className="text-white/40 mb-8">The ISS was assembled piece by piece over 13 years, with components launched by the Space Shuttle, Proton, and Soyuz rockets.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children" ref={(el) => {
            if (!el) return
            const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.classList.add("visible") }, { threshold: 0.1 })
            obs.observe(el)
          }}>
            {MODULES.map((mod, i) => (
              <div key={i} className="shimmer-card border-glow-hover bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:border-white/15 transition-colors">
                <div className="flex items-baseline gap-3 mb-2">
                  <h3 className="text-lg font-bold text-white">{mod.name}</h3>
                  <span className="text-orange-400 text-xs font-mono">{mod.year}</span>
                  <span className="text-white/20 text-xs">{mod.country}</span>
                </div>
                <p className="text-white/50 text-sm leading-relaxed">{mod.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Daily Life -scroll-driven interactive timeline */}
      <section className="relative z-30 bg-black border-t border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">A Day in Space</h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">Astronauts follow a structured schedule coordinated with mission control. Here&apos;s a typical day on the ISS.</p>
          </div>

          <div className="relative">
            {/* Central timeline line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent -translate-x-1/2" />

            {DAILY_SCHEDULE.map((item, i) => {
              const isLeft = i % 2 === 0
              return (
                <div
                  key={i}
                  className="timeline-item relative flex items-start mb-12 last:mb-0"
                  style={{ justifyContent: isLeft ? "flex-start" : "flex-end" }}
                >
                  {/* Center dot + time badge */}
                  <div className="absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-black shadow-[0_0_12px_rgba(249,115,22,0.5)] timeline-dot" />
                    <span className="mt-1.5 text-orange-400 font-mono text-xs tracking-wider whitespace-nowrap">{item.time}</span>
                  </div>

                  {/* Card -alternates left/right */}
                  <div
                    className={`timeline-card w-[calc(50%-2.5rem)] ${isLeft ? "mr-auto pr-4 text-right" : "ml-auto pl-4 text-left"}`}
                  >
                    <div className={`bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500 group`}>
                      <div className={`flex items-center gap-2.5 mb-2 ${isLeft ? "justify-end" : "justify-start"}`}>
                        <div className={`w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center ${isLeft ? "order-2" : ""}`}>
                          <FontAwesomeIcon icon={item.icon} className="w-3.5 h-3.5 text-orange-400" />
                        </div>
                        <h3 className="text-white font-semibold text-sm group-hover:text-orange-300 transition-colors">{item.activity}</h3>
                      </div>
                      <p className="text-white/40 text-sm leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <style jsx>{`
          .timeline-item {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.7s ease, transform 0.7s ease;
          }
          .timeline-item.visible {
            opacity: 1;
            transform: translateY(0);
          }
          .timeline-dot {
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }
          .timeline-item.visible .timeline-dot {
            animation: dotPulse 2s ease-in-out infinite;
          }
          @keyframes dotPulse {
            0%, 100% { box-shadow: 0 0 8px rgba(249,115,22,0.3); }
            50% { box-shadow: 0 0 16px rgba(249,115,22,0.6); }
          }
          @media (max-width: 640px) {
            .timeline-card {
              width: calc(100% - 2rem) !important;
              margin-left: auto !important;
              margin-right: 0 !important;
              padding-left: 1rem !important;
              padding-right: 0 !important;
              text-align: left !important;
            }
            .timeline-card .flex { justify-content: flex-start !important; }
            .timeline-card .order-2 { order: 0 !important; }
            .absolute.left-1\\/2 { left: 0.75rem !important; }
            .w-px.absolute { left: 0.75rem !important; }
          }
        `}</style>
      </section>

      {/* Science */}
      <section className="relative z-30 bg-black border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex items-center gap-3 mb-8">
            <FontAwesomeIcon icon={faFlask} className="w-5 h-5 text-orange-400" />
            <h2 className="text-3xl font-bold text-white">Science & Research</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-children" ref={(el) => {
            if (!el) return
            const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.classList.add("visible") }, { threshold: 0.15 })
            obs.observe(el)
          }}>
            {SCIENCE_AREAS.map((area, i) => (
              <div key={i} className="shimmer-card border-glow-hover bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-3">{area.title}</h3>
                <p className="text-white/50 leading-relaxed">{area.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* History Timeline */}
      <section className="relative z-30 bg-black border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <div className="flex items-center gap-3 mb-8">
            <FontAwesomeIcon icon={faHistory} className="w-5 h-5 text-orange-400" />
            <h2 className="text-3xl font-bold text-white">History</h2>
          </div>
          <div className="space-y-4">
            {HISTORY.map((item, i) => (
              <div key={i} className="flex gap-4 items-start">
                <span className="text-orange-400 font-mono text-sm font-bold w-12 shrink-0 pt-1">{item.year}</span>
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 shrink-0" />
                <p className="text-white/50 leading-relaxed">{item.event}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to Spot */}
      <section className="relative z-30 bg-black border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex items-center gap-3 mb-8">
            <FontAwesomeIcon icon={faEye} className="w-5 h-5 text-orange-400" />
            <h2 className="text-3xl font-bold text-white">How to Spot the ISS</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 stagger-children" ref={(el) => {
            if (!el) return
            const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.classList.add("visible") }, { threshold: 0.15 })
            obs.observe(el)
          }}>
            <div className="shimmer-card border-glow-hover bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-3">Visible to the naked eye</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                The ISS is the third brightest object in the night sky after the Sun and Moon.
                It appears as a bright, fast-moving point of light that doesn&apos;t blink (unlike airplanes).
              </p>
            </div>
            <div className="shimmer-card border-glow-hover bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-3">Best viewing times</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Look during dawn or dusk when the sky is dark but the ISS is still sunlit.
                It crosses the sky in 3-5 minutes, travelling from west to east.
              </p>
            </div>
            <div className="shimmer-card border-glow-hover bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-3">Track it live</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Visit <a href="https://spotthestation.nasa.gov" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">spotthestation.nasa.gov</a> to
                sign up for alerts when the ISS will pass over your location.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ISS vs Orion */}
      <section className="relative z-30 bg-black border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-white mb-8">ISS vs Orion (Artemis II)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/30 uppercase tracking-wider text-xs py-3 pr-4">Metric</th>
                  <th className="text-left text-white/30 uppercase tracking-wider text-xs py-3 pr-4">ISS</th>
                  <th className="text-left text-orange-400/70 uppercase tracking-wider text-xs py-3">Orion</th>
                </tr>
              </thead>
              <tbody className="text-white/60">
                {[
                  ["Altitude", "408 km (LEO)", "Up to 413,146 km"],
                  ["Speed", "27,600 km/h", "Up to 38,400 km/h"],
                  ["Crew", "6-7 (long duration)", "4 (10-day mission)"],
                  ["Volume", "916 m\u00B3", "19.6 m\u00B3"],
                  ["Mass", "420,000 kg", "27,000 kg"],
                  ["Purpose", "Research laboratory", "Deep space exploration"],
                  ["Destination", "Low Earth Orbit", "The Moon and beyond"],
                  ["Duration", "Continuous (since 2000)", "10-day missions"],
                ].map(([metric, iss, orion], i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-3 pr-4 font-medium text-white/40">{metric}</td>
                    <td className="py-3 pr-4">{iss}</td>
                    <td className="py-3 text-orange-400/80">{orion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
