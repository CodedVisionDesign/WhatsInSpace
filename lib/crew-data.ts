export interface CrewMember {
  slug: string
  name: string
  role: string
  agency: string
  image: string
  bio: string
  fullBio: string
  funFact: string
  x: string
  instagram: string
  highlights: string[]
  birthplace: string
  education: string[]
  selectionYear: number
  missions: { name: string; year: string; description: string }[]
}

export const crewData: CrewMember[] = [
  {
    slug: "reid-wiseman",
    name: "Reid Wiseman",
    role: "Commander",
    agency: "NASA",
    image: "/images/crew/wiseman.webp",
    bio: "U.S. Navy Captain and veteran of Expedition 40/41, with 165 days in space and nearly 13 hours of spacewalk time. Former Chief of the Astronaut Office.",
    fullBio: "Reid Wiseman is a retired U.S. Navy Captain and 27-year Navy veteran from Baltimore, Maryland. Commissioned through ROTC in 1997, he became a Naval Aviator in 1999 and flew F-14 Tomcats on two Middle East deployments supporting Operations Southern Watch, Enduring Freedom, and Iraqi Freedom. He attended the U.S. Naval Test Pilot School in 2004, worked on F-35 and F-18 programs, and later commanded Strike Fighter Squadron 103 flying the FA-18F Super Hornet. Selected as a NASA astronaut in June 2009, he completed training in May 2011 and served as Chief of the Astronaut Office from 2020 through 2022. His late wife, Carroll, was a neonatal intensive care nurse. He considers his time as a single parent his greatest challenge and the most rewarding phase of his life.",
    funFact: "The Artemis II crew proposed naming a lunar crater after Reid's late wife Carroll, continuing an Apollo-era tradition of honouring loved ones on the Moon.",
    x: "astro_reid",
    instagram: "astro_reid",
    highlights: ["F-14 Tomcat pilot", "2 EVAs on ISS", "27-year Navy veteran"],
    birthplace: "Baltimore, Maryland",
    education: [
      "B.S. Computer and Systems Engineering, Rensselaer Polytechnic Institute (1997)",
      "M.S. Systems Engineering, Johns Hopkins University (2006)",
      "Certificate, Space Systems, US Naval Postgraduate School (2008)",
    ],
    selectionYear: 2009,
    missions: [
      { name: "Expedition 40/41", year: "2014", description: "165-day ISS mission completing over 300 scientific experiments and nearly 13 hours of spacewalk time across two EVAs." },
      { name: "Artemis II", year: "2026", description: "Commander of the first crewed lunar flyby in over 50 years. 10-day mission aboard Orion spacecraft." },
    ],
  },
  {
    slug: "victor-glover",
    name: "Victor Glover",
    role: "Pilot",
    agency: "NASA",
    image: "/images/crew/glover.webp",
    bio: "Naval aviator with 3,000+ flight hours across 40 aircraft and 24 combat missions. Piloted SpaceX Crew-1, spending 168 days on the ISS with four spacewalks.",
    fullBio: "Victor Glover is a NASA astronaut and U.S. Navy Captain from California. He is a Naval Aviator with extensive combat and peacetime deployment experience, having served as a test pilot for the F/A-18 Hornet, Super Hornet, and EA-18G Growler. His flight experience includes over 3,000 flight hours in more than 40 aircraft, over 400 carrier arrested landings, and 24 combat missions. Selected as a NASA astronaut in 2013, Glover piloted SpaceX Crew-1 in 2020-2021 as part of Expedition 64, spending 168 days in orbit and conducting four spacewalks. His family has been stationed at multiple U.S. and international locations throughout his military career, including Japan.",
    funFact: "Victor's daughter's dance tribute video went viral with over 21 million views during the Artemis II mission, making her the breakout star of the flight.",
    x: "AstroVicGlover",
    instagram: "astrovicglover",
    highlights: ["SpaceX Crew-1 pilot", "4 EVAs on ISS", "400+ carrier landings"],
    birthplace: "California",
    education: [
      "B.S. General Engineering",
      "M.S. Flight Test Engineering",
      "M.S. Systems Engineering",
      "M.S. Military Operational Art and Science",
    ],
    selectionYear: 2013,
    missions: [
      { name: "SpaceX Crew-1 / Expedition 64", year: "2020-2021", description: "Pilot of the first operational SpaceX Crew Dragon mission. 168 days in orbit with four spacewalks." },
      { name: "Artemis II", year: "2026", description: "Pilot of the first crewed lunar flyby since Apollo 17. Responsible for spacecraft navigation and systems." },
    ],
  },
  {
    slug: "christina-koch",
    name: "Christina Koch",
    role: "Mission Specialist",
    agency: "NASA",
    image: "/images/crew/koch.webp",
    bio: "Holds the record for the longest single spaceflight by a woman at 328 consecutive days. Completed six spacewalks including the first three all-female EVAs.",
    fullBio: "Christina Koch is a NASA astronaut and electrical engineer from Grand Rapids, Michigan, who grew up in Jacksonville, North Carolina. She holds a B.S. in Electrical Engineering and Physics and an M.S. in Electrical Engineering from North Carolina State University. Before joining NASA, she worked at NASA Goddard Space Flight Center, Johns Hopkins University Applied Physics Laboratory (contributing to the Juno and Van Allen Probes missions), and spent a full winter at the South Pole as a research associate. She also worked at remote stations in Antarctica, Greenland, Alaska, and American Samoa. Selected as an astronaut in 2013, Koch launched to the ISS in March 2019 and returned in February 2020 after 328 consecutive days, setting the record for the longest single spaceflight by a woman. She completed six spacewalks totaling over 42 hours, including the first three all-female EVAs.",
    funFact: "Before becoming an astronaut, Christina spent a full winter at the South Pole and worked at remote stations in Antarctica, Greenland, Alaska, and American Samoa.",
    x: "Astro_Christina",
    instagram: "astro_christina",
    highlights: ["328 days in space", "6 EVAs, 42+ hours", "South Pole veteran"],
    birthplace: "Grand Rapids, Michigan",
    education: [
      "B.S. Electrical Engineering and Physics, North Carolina State University",
      "M.S. Electrical Engineering, North Carolina State University",
      "Honorary PhD, North Carolina State University",
    ],
    selectionYear: 2013,
    missions: [
      { name: "Expedition 59/60/61", year: "2019-2020", description: "328 consecutive days aboard the ISS, setting the record for longest single spaceflight by a woman. Six spacewalks totaling 42+ hours." },
      { name: "Artemis II", year: "2026", description: "Mission Specialist on the first crewed lunar flyby since 1972. Responsible for spacecraft systems evaluation." },
    ],
  },
  {
    slug: "jeremy-hansen",
    name: "Jeremy Hansen",
    role: "Mission Specialist",
    agency: "CSA",
    image: "/images/crew/hansen.webp",
    bio: "Colonel in the Canadian Armed Forces and CF-18 fighter pilot. First Canadian to travel beyond low Earth orbit. Led a NASA astronaut training class, the first Canadian to do so.",
    fullBio: "Jeremy Hansen is a Canadian Space Agency astronaut and Colonel in the Canadian Armed Forces, born in London, Ontario, and raised on a farm near Ailsa Craig. He holds a B.Sc. in Space Science (First Class Honours) and an M.Sc. in Physics from the Royal Military College of Canada, focusing on Wide Field of View Satellite Tracking. He completed CF-18 Fighter Pilot Training in 2003 and served as a tactical fighter pilot and Combat Operations Officer, overseeing NORAD Operations, deployed exercises, and Arctic flying operations. Selected by the Canadian Space Agency in 2009, he completed astronaut candidate training in 2011, served as CAPCOM, and participated in ESA's CAVES program (2013) and NEEMO 19 deep-sea simulation (2014). In 2017, he became the first Canadian to lead a NASA astronaut training class. He is married with three children and enjoys sailboat cruising, rock climbing, and mountain biking.",
    funFact: "Jeremy grew up on a farm near Ailsa Craig, Ontario. He went from tending crops in rural Canada to flying CF-18s and now orbiting the Moon.",
    x: "Astro_Jeremy",
    instagram: "astrojeremy",
    highlights: ["CF-18 fighter pilot", "First Canadian to the Moon", "NEEMO 19 aquanaut"],
    birthplace: "London, Ontario, Canada",
    education: [
      "B.Sc. Space Science (First Class Honours), Royal Military College of Canada (1999)",
      "M.Sc. Physics, Royal Military College of Canada (2000)",
    ],
    selectionYear: 2009,
    missions: [
      { name: "Artemis II", year: "2026", description: "Mission Specialist and first Canadian to travel beyond low Earth orbit. Responsible for mission experiments and crew operations." },
    ],
  },
]
