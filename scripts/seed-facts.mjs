// One-time seeding of src/data/facts.json from docs/FACT_SHEET.md (Phase 01).
// Kept for the record. After seeding, edit facts.json directly.
//
// Row format: [id, kid, value, date, sourceTitle, sourceUrl, status, note]
import { writeFileSync } from "node:fs";

const JPL_EMS = ["JPL: Earth-Moon System", "https://www.jpl.nasa.gov/news/earth-moon-system"];
const JPL_LRRR = [
  "JPL: The Apollo Experiment That Keeps on Giving (2019)",
  "https://www.jpl.nasa.gov/news/the-apollo-experiment-that-keeps-on-giving/",
];
const NSSDCA_LRV = ["NSSDCA: The Apollo Lunar Roving Vehicle", "https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html"];
const OPP6 = [
  "NASA/JPL: Six things to know about NASA's Opportunity Mars rover (2019), reprint on Phys.org",
  "https://phys.org/news/2019-02-nasa-opportunity-mars-rover.html",
];
const APPEL = [
  "NASA APPEL: NASA's Ingenuity Rotorcraft Makes Final Landing on Mars (2024)",
  "https://appel.nasa.gov/2024/02/23/nasas-ingenuity-rotorcraft-makes-final-landing-on-mars/",
];
const JPL_ING = [
  "JPL: NASA's Ingenuity Mars Helicopter Team Says Goodbye ... for Now (April 16, 2024)",
  "https://www.jpl.nasa.gov/news/nasas-ingenuity-mars-helicopter-team-says-goodbye-for-now",
];
const EARTHSKY = [
  "EarthSky: Voyager 1 will be 1 light-day from Earth (citing NASA's June 17, 2026 statement)",
  "https://earthsky.org/space/voyager-1-1-light-day-from-earth-november-17-18-2026/",
];
const SUR3 = [
  "Space.com / collectSPACE: Apollo 12 and Surveyor 3 parts, 50 years on",
  "https://www.space.com/apollo-12-surveyor-3-parts-50-years.html",
];
const SOJ = ["NASA Science: Pathfinder Sol 8", "https://science.nasa.gov/resource/pathfinder-sol-8/"];
const NONE = ["", ""];

const rows = [
  ["a11-lrrr-placed", "Neil Armstrong and Buzz Aldrin set up the mirror panel near the end of their moonwalk.", "July 21, 1969 (UTC)", "1969-07-21", "NASA Science: Apollo 11 Experiment Still Running (2004), archived copy", "https://ieeemilestones.ethw.org/w/images/6/65/Ref8-NASA-Apollo11-2004.pdf", "checked", ""],
  ["a11-lrrr-cubes", "The panel holds 100 little corner cubes.", "100 cubes; panel about 46 cm square; each cube about 3.8 cm across", null, ...JPL_EMS, "checked", ""],
  ["a11-lrrr-nopower", "It needs no power at all.", "", null, ...JPL_EMS, "checked", ""],
  ["lrrr-still-used", "Scientists still bounce lasers off it today.", "ongoing", null, ...JPL_LRRR, "checked", ""],
  ["lrrr-others", "Apollo 14 and Apollo 15 left mirror panels too.", "Apollo 14: 100 cubes; Apollo 15: 300 cubes", null, ...JPL_LRRR, "checked", ""],
  ["moon-recede", "The Moon moves about 3.8 cm farther from Earth every year.", "about 3.8 cm per year (1.5 in)", null, ...JPL_LRRR, "checked", ""],
  ["moon-distance", "The Moon is about 385,000 km away on average.", "about 385,000 km (239,000 mi)", null, ...JPL_LRRR, "checked", ""],
  ["light-roundtrip", "A laser flash takes about 2.5 seconds to reach the mirrors and come back.", "2 x 385,000 km / 299,792 km per s = about 2.57 s", null, ...JPL_LRRR, "checked", "Computed from moon-distance and the speed of light."],
  ["a11-descent-stage", "Eagle's bottom half stayed on the Moon and worked as the launch pad for the trip home.", "", null, ...NONE, "verify", "Find a NASA page."],
  ["a11-seismometer", "A seismometer listened for moonquakes.", "how long it worked", null, ...NONE, "verify", "Find a NASA or LPI page on the Passive Seismic Experiment."],
  ["a15-lrv-distance", "On Apollo 15 the rover drove 27.8 km in about 3 hours of driving.", "27.8 km in 3 h 2 min; longest trip 12.5 km; farthest 5.0 km from the lander", null, ...NSSDCA_LRV, "checked", ""],
  ["lrv-wheels", "Its wheels were woven from zinc-coated steel wire, with titanium chevrons for grip.", "81.8 cm across, 23 cm wide; chevrons cover 50% of the contact area", null, ...NSSDCA_LRV, "checked", "Also Smithsonian NASM wheel: https://airandspace.si.edu/collection-objects/wheel-lunar-rover/nasm_A19750830000 (the chevron pattern kept the wheels from sinking into soft soil)."],
  ["lrv-first-drive", "The rover first rolled out on the Moon on July 31, 1971.", "July 31, 1971", "1971-07-31", ...NONE, "verify", "Secondary source only. Confirm in the Apollo 15 Lunar Surface Journal."],
  ["lrv-crew", "Dave Scott and Jim Irwin drove the Apollo 15 rover.", "", null, ...NONE, "verify", "Confirm on a NASA Apollo 15 page."],
  ["lrv-rear-steer", "On the first drive the front steering didn't work, so they steered with the rear wheels.", "", null, ...NONE, "verify", "Secondary source only. Confirm in the Apollo 15 Lunar Surface Journal."],
  ["lrv-tracks-orbit", "The rover's tracks can be seen from orbit.", "", null, ...NONE, "verify", "Find the LROC featured image of the Apollo 15 site."],
  ["opp-landing", "Opportunity landed at Meridiani Planum on Mars.", "January 25, 2004 (UTC); January 24 in US Pacific time", "2004-01-25", ...NONE, "verify", "Confirm on a NASA/JPL mission page."],
  ["opp-planned", "It was planned to work for 90 Martian days.", "90 sols (about 92 Earth days)", null, ...OPP6, "checked", ""],
  ["opp-years", "It kept working for more than 14 years.", "more than 14 years", null, ...OPP6, "checked", ""],
  ["opp-distance", "It drove 45.16 km, farther than a marathon.", "45.16 km (28.06 mi)", null, ...OPP6, "checked", ""],
  ["opp-blueberries", "It found tiny hematite balls nicknamed \"blueberries\" that formed with water.", "", null, ...OPP6, "checked", ""],
  ["opp-last-contact", "Its last message came during a planet-wide dust storm.", "June 10, 2018", "2018-06-10", ...NONE, "verify", "Confirm on a NASA/JPL page."],
  ["opp-end", "NASA kept calling for months, then said goodbye.", "mission declared complete February 13, 2019; more than 1,000 recovery commands", "2019-02-13", ...NONE, "verify", "Confirm on a NASA/JPL page."],
  ["opp-cleaning", "Wind sometimes blew dust off its solar panels.", "\"cleaning events\"", null, ...NONE, "verify", "Find a NASA/JPL page."],
  ["opp-hole-in-one", "It bounced inside airbags and rolled into a small crater.", "Eagle crater", null, ...NONE, "verify", "Find a NASA/JPL page."],
  ["opp-quote-myth", "The famous line \"My battery is low and it's getting dark\" was a person's poetic version of its data, not words the rover sent.", "", null, ...NONE, "verify", "Do not use until confirmed. Find a reliable source (news fact-check or NASA statement)."],
  ["mars-blue-sunset", "Sunsets on Mars look blue near the Sun.", "", null, ...NONE, "verify", "Find a NASA image page (Photojournal)."],
  ["ing-first-flight", "Ingenuity made the first powered, controlled flight on another planet.", "April 19, 2021", "2021-04-19", ...APPEL, "checked", ""],
  ["ing-wright", "It carries a tiny piece of the 1903 Wright Flyer's wing fabric.", "wrapped around a cable under its solar panel", null, "JPL PIA24434: The Wright Brothers", "https://www.jpl.nasa.gov/images/pia24434-the-wright-brothers/", "checked", "Also NASA APPEL: https://appel.nasa.gov/2024/02/23/nasas-ingenuity-rotorcraft-makes-final-landing-on-mars/"],
  ["ing-plan", "It was planned for about 5 flights in 30 days.", "about 5 flights over 30 days", null, ...NONE, "verify", "Secondary sources quoting NASA's January 2024 briefing. Confirm on a NASA page."],
  ["ing-72", "It flew 72 times, more than 2 hours in all, 14 times farther than planned.", "72 flights; more than 2 h; 14x planned distance", null, ...JPL_ING, "checked", "Reprint: https://phys.org/news/2024-04-nasa-ingenuity-mars-helicopter-team.html"],
  ["ing-final", "Its last flight damaged its rotor blades.", "final flight January 18, 2024; mission ended January 25, 2024", "2024-01-18", ...JPL_ING, "checked", ""],
  ["ing-testbed", "It stays at \"Valinor Hills\" and keeps saving data for future visitors. Its memory could hold about 20 years of daily data.", "", null, ...JPL_ING, "checked", ""],
  ["ing-daily", "Each day it wakes up, takes a picture and records the temperature.", "", null, ...NONE, "verify", "Secondary source. Confirm on the JPL page."],
  ["ing-mass", "It weighs about as much as a bag of sugar.", "about 1.8 kg (4 lb)", null, ...NONE, "verify", "Confirm on a NASA page."],
  ["ing-first-flight-length", "Its first flight lasted 39 seconds at Wright Brothers Field.", "39 s; about 3 m high", null, ...NONE, "verify", "Confirm on a NASA page."],
  ["mars-thin-air", "Mars air is very thin, about 1% as dense as Earth's.", "about 1%", null, ...NONE, "verify", "Confirm on a NASA Ingenuity page."],
  ["ing-rotor-speed", "Its blades spin very fast to make enough lift.", "rpm value", null, ...NONE, "verify", "Confirm on a NASA Ingenuity page."],
  ["v1-launch", "Voyager 1 launched in 1977.", "September 5, 1977", "1977-09-05", ...NONE, "verify", "Confirm on a NASA/JPL Voyager page."],
  ["v1-interstellar", "It left the Sun's bubble and entered interstellar space.", "2012", null, ...NONE, "verify", "Confirm on a NASA/JPL Voyager page."],
  ["v1-light-day", "Voyager 1 becomes the first human-made object one light-day from Earth: its signals take a whole day to reach us.", "November 18, 2026, 12:16:07 a.m. CST (06:16:07 UTC); about 25.9 billion km (16.1 billion mi), 173.14 AU", "2026-11-18", ...EARTHSKY, "checked", "Secondary sources. Also IFLScience (confirmed with the Voyager team): https://iflscience.com/its-official-voyager-1-will-cross-the-1-light-day-threshold-on-november-18-2026-82733 . Find the NASA/JPL primary page."],
  ["v2-light-day", "Voyager 2 won't reach one light-day until around 2035.", "November 2035", null, ...EARTHSKY, "checked", "Secondary source."],
  ["golden-record", "Each Voyager carries a Golden Record with greetings in 55 languages, pictures, music and sounds of Earth.", "12-inch gold-plated copper disk; 55 languages; 115 images; committee chaired by Carl Sagan", null, "The Planetary Society: The Voyager Golden Record", "https://www.planetary.org/space-images/the-voyager-golden-record", "checked", "Secondary source. Confirm on NASA's Golden Record page."],
  ["sur3-visit", "Surveyor 3 is the only robot probe people have visited on another world. Apollo 12 landed within walking distance.", "Apollo 12 landing November 19, 1969", "1969-11-19", ...SUR3, "checked", "Secondary source. Confirm on NASA."],
  ["sur3-parts", "The astronauts brought back its camera and other parts so engineers could study how they aged on the Moon.", "more than 80 researchers studied the parts", null, ...SUR3, "checked", "Secondary source."],
  ["sur3-microbe", "A famous claim that germs survived on the camera was later traced to likely contamination on Earth.", "", null, ...SUR3, "checked", "Secondary source."],
  ["soj-mission", "Sojourner, the first rover on Mars, worked 83 days on a mission planned for 7.", "landed July 4, 1997; last data September 27, 1997", "1997-07-04", ...SOJ, "checked", ""],
  ["soj-lasers", "It used laser stripes to spot hazards.", "", null, ...SOJ, "checked", ""],
];

const facts = rows.map(([id, kid, value, date, sourceTitle, sourceUrl, status, note]) => ({
  id,
  kid,
  // Deeper wording is written when each source is opened and re-read. Never invented.
  deeper: "",
  value,
  date,
  sourceTitle,
  sourceUrl,
  status,
  // Set to the day a person or agent last opened the source and confirmed the wording.
  checkedOn: null,
  note,
}));

writeFileSync(new URL("../src/data/facts.json", import.meta.url), `${JSON.stringify({ facts }, null, 2)}\n`);
console.log(`Seeded ${facts.length} facts.`);
