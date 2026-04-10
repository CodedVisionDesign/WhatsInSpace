import Image from "next/image"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faRocket, faShieldHalved, faSatellite, faFire, faTowerBroadcast } from "@fortawesome/free-solid-svg-icons"

const sections = [
  {
    id: "sls",
    icon: faRocket,
    title: "Space Launch System (SLS)",
    subtitle: "The most powerful rocket ever built",
    stats: [
      { label: "Height", value: "98 m" },
      { label: "Liftoff mass", value: "2.61M kg" },
      { label: "Thrust", value: "39.1M N" },
      { label: "Payload to Moon", value: "27,000 kg" },
    ],
    description: "The Space Launch System is NASA's super heavy-lift launch vehicle designed to send astronauts and cargo beyond low Earth orbit. Standing 98 meters tall and producing 39.1 million Newtons of thrust at liftoff, it is the most powerful rocket NASA has ever built. The core stage is powered by four RS-25 engines (the same engines that powered the Space Shuttle), flanked by two five-segment solid rocket boosters. For Artemis II, SLS launched from Pad 39B at Kennedy Space Center on April 1, 2026, carrying the Orion spacecraft and its crew of four on a trajectory to the Moon.",
    image: "/images/mission/launch.webp",
  },
  {
    id: "orion",
    icon: faSatellite,
    title: "Orion Spacecraft",
    subtitle: "Crew vehicle nicknamed 'Integrity'",
    stats: [
      { label: "Crew + service module height", value: "7.92 m" },
      { label: "Pressurized volume", value: "19.6 m\u00B3" },
      { label: "Mass to Moon", value: "~27,000 kg" },
      { label: "Propellant capacity", value: "~9,000 kg" },
    ],
    description: "Orion is NASA's spacecraft for deep space exploration, designed to carry astronauts to the Moon and beyond. The Artemis II crew nicknamed their Orion capsule 'Integrity.' It consists of a crew module (where the four astronauts live and work), a service module (provided by the European Space Agency, containing propulsion, power, and life support), and a launch abort system. Orion is designed to support a crew for up to 21 days and can sustain four astronauts in deep space with its advanced life support, thermal protection, radiation shielding, and navigation systems. The return mass at landing is approximately 10,400 kg after discarding the 6,500 kg service module and 1,000 kg adapter.",
    image: "/images/mission/orion-pad.webp",
  },
  {
    id: "heat-shield",
    icon: faShieldHalved,
    title: "AVCOAT Heat Shield",
    subtitle: "Surviving 2,760\u00B0C at Mach 32",
    stats: [
      { label: "Peak temperature", value: "2,760\u00B0C" },
      { label: "Reentry speed", value: "38,400 km/h" },
      { label: "Material", value: "AVCOAT ablator" },
      { label: "Technique", value: "Skip reentry" },
    ],
    description: "Orion's heat shield is the largest of its kind ever built, measuring 5 meters in diameter. Made from AVCOAT, an ablative thermal protection material, it protects the crew module during reentry when temperatures reach up to 2,760\u00B0C (5,000\u00B0F) and the spacecraft is travelling at approximately 38,400 km/h (Mach 32). Artemis II uses a skip reentry technique: Orion dips into the upper atmosphere, skips back out like a stone on water, then reenters for final descent. This reduces peak g-forces on the crew from approximately 8g to a more manageable 4g and enables precise splashdown targeting in the Pacific Ocean.",
    image: "/images/mission/splashdown.webp",
  },
  {
    id: "icps",
    icon: faFire,
    title: "Interim Cryogenic Propulsion Stage",
    subtitle: "The engine that sent Orion to the Moon",
    stats: [
      { label: "TLI burn duration", value: "5m 55s" },
      { label: "Delta-v delivered", value: "388 m/s" },
      { label: "Engine", value: "RL10B-2" },
      { label: "Propellant", value: "LOX/LH2" },
    ],
    description: "The Interim Cryogenic Propulsion Stage (ICPS) is the upper stage of the SLS rocket, powered by a single RL10B-2 engine burning liquid oxygen and liquid hydrogen. For Artemis II, the ICPS performed several critical burns: a perigee raise maneuver to a 2,223 x 185 km orbit, an apogee raise to 70,377 km, and the Trans-Lunar Injection (TLI) burn. The TLI burn lasted 5 minutes and 55 seconds, delivering 388 m/s of delta-v to accelerate Orion past Earth's escape velocity of 40,270 km/h. After TLI, the ICPS separated from Orion and performed a disposal burn for Pacific Ocean splashdown, while four international CubeSats were deployed.",
    image: "/images/mission/flyby-2.webp",
  },
  {
    id: "ground-systems",
    icon: faTowerBroadcast,
    title: "Ground Systems & Recovery",
    subtitle: "Launch Complex 39B and Deep Space Network",
    stats: [
      { label: "Launch pad", value: "LC-39B, KSC" },
      { label: "Tracking", value: "Deep Space Network" },
      { label: "Recovery zone", value: "Pacific, off Baja CA" },
      { label: "Recovery time", value: "~2 hours" },
    ],
    description: "The Exploration Ground Systems at Kennedy Space Center include Launch Complex 39B, the mobile launcher, and the Vehicle Assembly Building where SLS is stacked. NASA's Deep Space Network (DSN), a collection of giant radio antennas in California, Spain, and Australia, maintains communication with Orion throughout the mission, except during the brief period behind the Moon's far side. For recovery, the USS Portland and a team of NASA, Navy, and contractor personnel stationed off the coast of Baja California, Mexico recover the Orion crew module after splashdown. The crew module is winched into the well deck of the recovery ship, and the astronauts are extracted and transported to shore.",
    image: "/images/mission/crew-portrait.webp",
  },
]

export default function TechnologyPage() {
  return (
    <div className="bg-black min-h-screen">
      <Header alwaysVisible />

      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-orange-500 uppercase tracking-[0.3em] text-sm font-medium mb-4">Technology</p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6">Engineering the Return</h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            The spacecraft, rocket, and systems that made Artemis II possible.
            A deep dive into the technology sending humans back to the Moon.
          </p>
        </div>
      </section>

      {/* Technology Sections */}
      {sections.map((section, i) => (
        <section key={section.id} id={section.id} className="relative z-30 bg-black border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-24">
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
              {/* Content */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon={section.icon} className="w-5 h-5 text-orange-400" />
                  </div>
                  <p className="text-orange-500 uppercase tracking-[0.2em] text-sm font-medium">{section.subtitle}</p>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">{section.title}</h2>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {section.stats.map((stat, j) => (
                    <div key={j} className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <p className="text-white/30 text-[11px] uppercase tracking-wider mb-1">{stat.label}</p>
                      <p className="text-white font-mono text-sm">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <p className="text-white/50 leading-relaxed">{section.description}</p>
              </div>

              {/* Image */}
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                <Image src={section.image} alt={section.title} fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="relative z-30 bg-black border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Explore the Flight Path</h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto mb-8">
            See how all this technology works together in our interactive 3D trajectory viewer,
            powered by real NASA/JPL Horizons ephemeris data.
          </p>
          <a href="/#trajectory" className="inline-block px-8 py-4 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors">
            View Flight Path
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
