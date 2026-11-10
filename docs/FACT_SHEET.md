# FACT SHEET: Pieces of Home

Seed data for `src/data/facts.json`. Accuracy is a judging criterion and a promise to kids, so treat this file with care.

**Status meanings**

- **Checked:** confirmed during pre-production against the listed source. Still open the source once and copy the exact wording into `facts.json`.
- **Verify:** plausible but not yet confirmed from a primary source. Confirm it on a NASA, JPL, NSSDCA, Smithsonian or other agency page before any player sees it. If you cannot confirm it, rewrite the game text so it no longer depends on the claim, and log that in `docs/DECISIONS.md`.
- Prefer primary sources (nasa.gov, jpl.nasa.gov, science.nasa.gov, nssdc.gsfc.nasa.gov, lroc.asu.edu, airandspace.si.edu, the Apollo Lunar Surface Journal). Reprints that say "Provided by NASA" are acceptable fallbacks.

## 1. Facts

| ID | Kid wording (draft) | Value | Source | Status |
|---|---|---|---|---|
| a11-lrrr-placed | Neil Armstrong and Buzz Aldrin set up the mirror panel near the end of their moonwalk. | July 21, 1969 (UTC) | NASA Science, "Apollo 11 Experiment Still Running" (2004): copy at https://ieeemilestones.ethw.org/w/images/6/65/Ref8-NASA-Apollo11-2004.pdf | Checked |
| a11-lrrr-cubes | The panel holds 100 little corner cubes. | 100 cubes; panel about 46 cm square; each cube about 3.8 cm across | JPL, https://www.jpl.nasa.gov/news/earth-moon-system | Checked |
| a11-lrrr-nopower | It needs no power at all. | n/a | JPL, https://www.jpl.nasa.gov/news/earth-moon-system | Checked |
| lrrr-still-used | Scientists still bounce lasers off it today. | ongoing | JPL (2019), https://www.jpl.nasa.gov/news/the-apollo-experiment-that-keeps-on-giving/ | Checked |
| lrrr-others | Apollo 14 and Apollo 15 left mirror panels too. | Apollo 14: 100 cubes; Apollo 15: 300 cubes | JPL (2019), same link | Checked |
| moon-recede | The Moon moves about 3.8 cm farther from Earth every year. | about 3.8 cm per year (1.5 in) | JPL (2019), same link | Checked |
| moon-distance | The Moon is about 385,000 km away on average. | about 385,000 km (239,000 mi) | JPL (2019), same link | Checked |
| light-roundtrip | A laser flash takes about 2.5 seconds to reach the mirrors and come back. | 2 x 385,000 km / 299,792 km per s = about 2.57 s | Computed from moon-distance and the speed of light | Checked (computed) |
| a11-descent-stage | Eagle's bottom half stayed on the Moon and worked as the launch pad for the trip home. | n/a | Find a NASA page | Verify |
| a11-seismometer | A seismometer listened for moonquakes. | how long it worked | Find NASA or LPI page on the Passive Seismic Experiment | Verify |
| a15-lrv-distance | On Apollo 15 the rover drove 27.8 km in about 3 hours of driving. | 27.8 km in 3 h 2 min; longest trip 12.5 km; farthest 5.0 km from the lander | NSSDCA, https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html | Checked |
| lrv-wheels | Its wheels were woven from zinc-coated steel wire, with titanium chevrons for grip. | 81.8 cm across, 23 cm wide; chevrons cover 50% of the contact area | NSSDCA (same link); Smithsonian NASM wheel: https://airandspace.si.edu/collection-objects/wheel-lunar-rover/nasm_A19750830000 (the chevron pattern kept the wheels from sinking into soft soil) | Checked |
| lrv-first-drive | The rover first rolled out on the Moon on July 31, 1971. | July 31, 1971 | Secondary source only; confirm in the Apollo 15 Lunar Surface Journal | Verify |
| lrv-crew | Dave Scott and Jim Irwin drove the Apollo 15 rover. | n/a | Confirm on a NASA Apollo 15 page | Verify |
| lrv-rear-steer | On the first drive the front steering didn't work, so they steered with the rear wheels. | n/a | Secondary source only; confirm in the Apollo 15 Lunar Surface Journal | Verify |
| lrv-tracks-orbit | The rover's tracks can be seen from orbit. | n/a | Find the LROC featured image of the Apollo 15 site | Verify |
| opp-landing | Opportunity landed at Meridiani Planum on Mars. | January 25, 2004 (UTC); January 24 in US Pacific time | Confirm on a NASA/JPL mission page | Verify |
| opp-planned | It was planned to work for 90 Martian days. | 90 sols (about 92 Earth days) | NASA/JPL "Six things to know about NASA's Opportunity Mars rover" (2019), reprint: https://phys.org/news/2019-02-nasa-opportunity-mars-rover.html | Checked |
| opp-years | It kept working for more than 14 years. | more than 14 years | same | Checked |
| opp-distance | It drove 45.16 km, farther than a marathon. | 45.16 km (28.06 mi) | same | Checked |
| opp-blueberries | It found tiny hematite balls nicknamed "blueberries" that formed with water. | n/a | same | Checked |
| opp-last-contact | Its last message came during a planet-wide dust storm. | June 10, 2018 | Confirm on a NASA/JPL page | Verify |
| opp-end | NASA kept calling for months, then said goodbye. | mission declared complete February 13, 2019; more than 1,000 recovery commands | Confirm on a NASA/JPL page | Verify |
| opp-cleaning | Wind sometimes blew dust off its solar panels. | "cleaning events" | Find a NASA/JPL page | Verify |
| opp-hole-in-one | It bounced inside airbags and rolled into a small crater. | Eagle crater | Find a NASA/JPL page | Verify |
| opp-quote-myth | The famous line "My battery is low and it's getting dark" was a person's poetic version of its data, not words the rover sent. | n/a | Find a reliable source (news fact-check or NASA statement) | Verify (do not use until confirmed) |
| mars-blue-sunset | Sunsets on Mars look blue near the Sun. | n/a | Find a NASA image page (Photojournal) | Verify |
| ing-first-flight | Ingenuity made the first powered, controlled flight on another planet. | April 19, 2021 | NASA APPEL, https://appel.nasa.gov/2024/02/23/nasas-ingenuity-rotorcraft-makes-final-landing-on-mars/ | Checked |
| ing-wright | It carries a tiny piece of the 1903 Wright Flyer's wing fabric. | wrapped around a cable under its solar panel | JPL PIA24434, https://www.jpl.nasa.gov/images/pia24434-the-wright-brothers/ ; NASA APPEL (same link) | Checked |
| ing-plan | It was planned for about 5 flights in 30 days. | about 5 flights over 30 days | Secondary sources quoting NASA's January 2024 briefing; confirm on a NASA page | Verify |
| ing-72 | It flew 72 times, more than 2 hours in all, 14 times farther than planned. | 72 flights; more than 2 h; 14x planned distance | JPL (April 16, 2024), https://www.jpl.nasa.gov/news/nasas-ingenuity-mars-helicopter-team-says-goodbye-for-now ; reprint https://phys.org/news/2024-04-nasa-ingenuity-mars-helicopter-team.html | Checked |
| ing-final | Its last flight damaged its rotor blades. | final flight January 18, 2024; mission ended January 25, 2024 | JPL (April 16, 2024), same | Checked |
| ing-testbed | It stays at "Valinor Hills" and keeps saving data for future visitors. Its memory could hold about 20 years of daily data. | n/a | JPL (April 16, 2024), same | Checked |
| ing-daily | Each day it wakes up, takes a picture and records the temperature. | n/a | Secondary source; confirm on the JPL page | Verify |
| ing-mass | It weighs about as much as a bag of sugar. | about 1.8 kg (4 lb) | Confirm on a NASA page | Verify |
| ing-first-flight-length | Its first flight lasted 39 seconds at Wright Brothers Field. | 39 s; about 3 m high | Confirm on a NASA page | Verify |
| mars-thin-air | Mars air is very thin, about 1% as dense as Earth's. | about 1% | Confirm on a NASA Ingenuity page | Verify |
| ing-rotor-speed | Its blades spin very fast to make enough lift. | rpm value | Confirm on a NASA Ingenuity page | Verify |
| v1-launch | Voyager 1 launched in 1977. | September 5, 1977 | Confirm on a NASA/JPL Voyager page | Verify |
| v1-interstellar | It left the Sun's bubble and entered interstellar space. | 2012 | Confirm on a NASA/JPL Voyager page | Verify |
| v1-light-day | Voyager 1 becomes the first human-made object one light-day from Earth: its signals take a whole day to reach us. | November 18, 2026, 12:16:07 a.m. CST (06:16:07 UTC); about 25.9 billion km (16.1 billion mi), 173.14 AU | EarthSky citing NASA's June 17, 2026 statement, https://earthsky.org/space/voyager-1-1-light-day-from-earth-november-17-18-2026/ ; IFLScience (confirmed with the Voyager team), https://iflscience.com/its-official-voyager-1-will-cross-the-1-light-day-threshold-on-november-18-2026-82733 . Find the NASA/JPL primary page | Checked (secondary). Find primary |
| v2-light-day | Voyager 2 won't reach one light-day until around 2035. | November 2035 | EarthSky (same) | Checked (secondary) |
| golden-record | Each Voyager carries a Golden Record with greetings in 55 languages, pictures, music and sounds of Earth. | 12-inch gold-plated copper disk; 55 languages; 115 images; committee chaired by Carl Sagan | The Planetary Society, https://www.planetary.org/space-images/the-voyager-golden-record ; confirm on NASA's Golden Record page | Checked (secondary). Confirm on NASA |
| sur3-visit | Surveyor 3 is the only robot probe people have visited on another world. Apollo 12 landed within walking distance. | Apollo 12 landing November 19, 1969 | Space.com / collectSPACE, https://www.space.com/apollo-12-surveyor-3-parts-50-years.html | Checked (secondary). Confirm on NASA |
| sur3-parts | The astronauts brought back its camera and other parts so engineers could study how they aged on the Moon. | more than 80 researchers studied the parts | same | Checked (secondary) |
| sur3-microbe | A famous claim that germs survived on the camera was later traced to likely contamination on Earth. | n/a | same | Checked (secondary) |
| soj-mission | Sojourner, the first rover on Mars, worked 83 days on a mission planned for 7. | landed July 4, 1997; last data September 27, 1997 | NASA Science, https://science.nasa.gov/resource/pathfinder-sol-8/ | Checked |
| soj-lasers | It used laser stripes to spot hazards. | n/a | same | Checked |

## 2. Data and media sources to use

| What | Where | Notes |
|---|---|---|
| Real photos | NASA Image and Video Library, https://images.nasa.gov (API: https://images-api.nasa.gov, no key needed); JPL Photojournal; LROC, https://www.lroc.asu.edu/ | Download at build time, keep the NASA ID and exact credit line |
| Hardware 3D models | NASA 3D Resources, https://science.nasa.gov/3d-resources/ and https://github.com/nasa/NASA-3D-Resources (GLB) | Free to use under NASA media guidelines; credit NASA; simplify heavily |
| Globe textures | NASA Scientific Visualization Studio (CGI Moon Kit), USGS Astrogeology Mars mosaics | Public domain; credit per source |
| Landing coordinates | NSSDCA Apollo pages, https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo.html ; mission pages | Store in facts.json with source |
| Inventory of hardware on the Moon | NASA History Office, "Catalogue of Manmade Material on the Moon" (2012), https://www.nasa.gov/wp-content/uploads/2024/02/final-catalogue-of-manmade-material-on-the-moon.pdf | Good for Archive cards |
| Voyager 1 distance and sky position | JPL Horizons API, https://ssd.jpl.nasa.gov/api/horizons.api | Fetch a daily table at build time into `src/data/voyager1.json` |
| Usage rules | NASA Images and Media Usage Guidelines, https://www.nasa.gov/nasa-brand-center/images-and-media/ | NASA media is generally not copyrighted in the US; the insignia, logotype and seal are not free to use; never imply endorsement |

## 3. Credit line formats

- `NASA`
- `NASA/JPL-Caltech`
- `NASA/JPL-Caltech/Cornell/USGS` (Opportunity microscopic images)
- `NASA/GSFC/Arizona State University` (LROC)
- `NASA/JPL-Caltech/ASU/MSSS` (Perseverance Mastcam-Z)
- `NASA/JPL-Caltech/University of Arizona` (HiRISE)

Always copy the exact credit from the image's own page.

## 4. Hosting and event facts (for DECISIONS.md and the README)

| Fact | Source |
|---|---|
| Cloudflare: requests to static assets are free and unlimited; 25 MiB per file; 20,000 files per Worker version on the Free plan; 100,000 Worker requests per day on Free | https://developers.cloudflare.com/workers/platform/limits ; https://developers.cloudflare.com/workers/static-assets/ |
| Cloudflare Durable Objects are available on the Workers Free plan (SQLite-backed only), with daily free limits; when exceeded, further operations fail with an error | https://developers.cloudflare.com/durable-objects/platform/pricing ; https://developers.cloudflare.com/durable-objects/platform/limits |
| PartyServer: rooms on Durable Objects, with PartySocket (auto-reconnecting client) | https://github.com/cloudflare/partykit |
| Vercel Hobby: 100 GB Fast Data Transfer per month, personal non-commercial use | https://vercel.com/docs/plans/hobby |
| Vercel Functions WebSockets close when the function reaches its maximum duration | https://vercel.com/docs/functions/websockets |
| Space Apps 2026: November 14 to 15, 2026 | https://www.spaceappschallenge.org/2026/ |
| Space Apps demo format: video up to 30 seconds or up to 7 slides; judged on Impact, Creativity, Validity, Relevance, Presentation (2025 guide; confirm for 2026) | https://www.spaceappschallenge.org/resources/project-submission-guide/ |
| Space Apps participants must have rights to everything they submit | https://www.spaceappschallenge.org/legal/ |
