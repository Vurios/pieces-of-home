# Fact check, 2026-11-12 (Phase 05 step 1)

Every fact in `src/data/facts.json` was opened against a primary source (NASA, JPL, NSSDCA, LROC, NASA Science Photojournal or the Apollo Lunar Surface Journal). The exact quote for each one is in its `note` field. `npm run check:facts` passes: 56 facts, 54 checked, 2 not usable, 0 errors.

**Status note:** the checker (`scripts/lib/fact-check.ts`) only accepts `checked` and `verify`. The two facts we could not confirm keep status `verify`, with a note that starts "Unverified (2026-11-12)". If you want a literal `unverified` status, add it to the `Fact` type and the status check first.

## Verdicts: the 22 facts that were not checked before

| ID | Verdict | Source | Wording changes |
|---|---|---|---|
| a11-descent-stage | Checked | https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C | Kid: "Eagle's bottom half stayed on the Moon. It worked as the launch pad when the top half lifted off." |
| a11-seismometer | Checked | https://science.nasa.gov/resource/apollo-11-seismic-experiment/ | Kid adds "It ran on sunlight and sent data for about three weeks." Value: stopped 04:00 UT Aug 25, 1969. NSSDCA says Aug 27, so the kid text gives no end date. |
| lrv-first-drive | Checked | https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1971-063C | Kid: "The rover's first drive on the Moon was on July 31, 1971." Value adds the moonwalk times (UT). |
| lrv-crew | Checked | https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html | Kid unchanged. Value: full names and roles. |
| lrv-rear-steer | Checked | https://www.nasa.gov/image-article/this-week-nasa-history-apollo-15-astronauts-deploy-first-lunar-roving-vehicle-july-31-1971/ (also ALSJ 121:27:32, https://www.apollojournals.org/alsj/a15/a15.trv1prep.html) | Kid unchanged. |
| lrv-tracks-orbit | Checked | https://science.nasa.gov/photojournal/retracing-the-steps-of-apollo-15 (PIA13058) | Kid: "...can be seen in pictures taken from orbit." Credit: NASA/GSFC/Arizona State University. |
| opp-landing | Checked | https://www.jpl.nasa.gov/news/nasas-opportunity-rover-mission-on-mars-comes-to-end/ | Kid adds "in January 2004". Value: Jan 25, 2004, 04:54 UT (Jan 24 US Pacific). |
| opp-last-contact | Checked | same JPL page | Kid: "Its last message came on June 10, 2018, during a dust storm that covered the whole planet." |
| opp-end | Checked | same JPL page | Kid: "NASA kept calling for months. It sent more than a thousand commands. Then, in February 2019, NASA said goodbye." |
| opp-cleaning | Checked | https://www.jpl.nasa.gov/news/news.php?feature=4112 | Kid adds "That gave it more power." The phrase "cleaning events" is not on the page, so it was removed from the value. |
| opp-hole-in-one | Checked | https://www.jpl.nasa.gov/news/new-look-at-2004s-martian-hole-in-one-site/ | Kid: "It landed inside airbags. It bounced and rolled right into a small crater." Value: Eagle Crater, 22 m. |
| opp-quote-myth | **Unverified** | none from NASA/JPL (Snopes and LAist in the note) | none |
| mars-blue-sunset | Checked | https://www.jpl.nasa.gov/news/nasas-curiosity-rover-views-serene-sundown-on-mars/ | Kid: "On Mars, the sky near the setting Sun looks blue." Value: Curiosity, sol 956 (April 15, 2015). |
| ing-plan | Checked | https://www.jpl.nasa.gov/news/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends | Kid: "up to five test flights in 30 days". |
| ing-daily | Checked | https://www.jpl.nasa.gov/news/nasas-ingenuity-mars-helicopter-team-says-goodbye-for-now | Kid: "It wakes up each day to check itself. It also takes pictures and records the temperature." The source does not say the photo is taken every day. |
| ing-mass | Checked | https://www.jpl.nasa.gov/news/press_kits/ingenuity/landing/quick_facts/ | Kid: "It weighs about 1.8 kilograms (4 pounds) on Earth." The "bag of sugar" comparison is not in any source, so it was dropped. |
| ing-first-flight-length | Checked | https://www.nasa.gov/news-release/nasas-ingenuity-mars-helicopter-succeeds-in-historic-first-flight/ | Kid: "Its first flight lasted about 39 seconds. It rose about 3 meters (10 feet). The spot is now called Wright Brothers Field." Value: 39.1 s. |
| mars-thin-air | Checked | Ingenuity press kit (as above) | Kid: "The air on Mars is very thin, only about 1% as dense as the air on Earth." |
| ing-rotor-speed | Checked | Ingenuity press kit (as above) | Kid: "Its blades spin very fast, about 2,400 times a minute." This is the press kit's design number. |
| v1-launch | Checked | https://science.nasa.gov/mission/voyager/voyager-1/ | Value: Sept 5, 1977, 12:56:01 UT. |
| v1-interstellar | Checked | https://www.jpl.nasa.gov/news/nasa-spacecraft-embarks-on-historic-journey-into-interstellar-space/ | Kid adds "in 2012". Value: Aug 25, 2012. |
| ing-site | Checked | https://mars.nasa.gov/mmgis-maps/M20/Layers/json/m20_heli_waypoints.json (Flight 72); Jezero Crater confirmed in prose on https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/ | none |

## Re-opened: checked facts that had no checkedOn date

All now carry `checkedOn: 2026-11-12`.

| ID | Verdict | Source now | Changes |
|---|---|---|---|
| a11-lrrr-placed | Checked | https://www.jpl.nasa.gov/news/apollo-11-experiment-still-going-strong-after-35-years/ | The old IEEE archive PDF returns 404, so the source was replaced. |
| a11-lrrr-cubes, a11-lrrr-nopower | Checked | https://www.jpl.nasa.gov/news/earth-moon-system | none |
| lrrr-still-used | Checked | JPL 2019 (Keeps on Giving) | Newest NASA confirmation is Aug 2020 ("continue to rely on the surface reflectors"). |
| lrrr-others, moon-recede, moon-distance | Checked | https://www.jpl.nasa.gov/news/the-apollo-experiment-that-keeps-on-giving/ | lrrr-others value: Apollo 11 and 14 have 100 cubes each. |
| light-roundtrip | Checked | https://www.nasa.gov/missions/laser-beams-reflected-between-earth-and-moon-boost-science/ | NASA states "about 2.5 seconds on average", so it no longer rests only on our math. |
| a15-lrv-distance, lrv-wheels | Checked | NSSDCA LRV page | none |
| opp-planned | Checked | https://science.nasa.gov/mission/mer-opportunity/ | Value is now "90 sols (Martian days)". The "about 92 Earth days" was our own conversion and was removed. |
| opp-years, opp-distance, opp-blueberries | Checked | https://www.jpl.nasa.gov/news/six-things-to-know-about-nasas-opportunity-mars-rover/ | Moved from the Phys.org reprint to JPL. "Farther than a marathon" is backed by NASA's March 2015 marathon release. |
| ing-first-flight | Checked | JPL, Jan 25, 2024 (mission ends) | The APPEL link now redirects to nasa.gov/appel, so the source was replaced. |
| ing-wright | Checked | https://www.jpl.nasa.gov/images/pia24434-the-wright-brothers/ | none |
| ing-72 | Checked | JPL, Apr 16, 2024 | Kid: "It flew 72 times, for more than 2 hours in all. It flew more than 14 times farther than planned." |
| ing-final | Checked | JPL, Jan 25, 2024 | The April page has no Jan 18 date. The Jan 25 page does. |
| ing-testbed | Checked | JPL, Apr 16, 2024 | Kid: "...keeps collecting data for future explorers..." (the source says "future explorers", not "visitors"). |
| v1-light-day | Checked, **corrected** | https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/ | **Time is 5:16:07 a.m. EST = 10:16:07 UTC, not 06:16:07 UTC.** Distance: 16,094,799,096 mi (25,902,068,356 km). Kid: "...Light from Earth takes a whole day to reach it." |
| v2-light-day | Checked | same NASA page | Kid: "Voyager 2 is on pace to be one light-day from Earth in November 2035." |
| golden-record | Checked | https://science.nasa.gov/mission/voyager/golden-record-contents/ (plus the Overview page for the 12-inch disk) | none. NASA pages say 55 languages and 115 images. |
| sur3-visit | Checked | https://science.nasa.gov/solar-system/moon/footpads-and-footprints-humans-and-machine-meet-on-the-moon/ | NASA: "the first and only time this has ever happened. So far." Distance is about 155 to 180 m, depending on the page. |
| sur3-parts | Checked | same NASA page | Kid: "...so scientists could study how years on the Moon changed them." The "80 researchers" figure was removed because no NASA page has it. |
| sur3-microbe | **Unverified** | NASA sources disagree | none. Do not use. |
| soj-mission, soj-lasers | Checked | https://science.nasa.gov/resource/pathfinder-sol-8/ | "First rover" is backed by the NASA Mars Pathfinder page. |

## New facts for real recordings (all checked)

| ID | Kid | Source | Credit line for the audio |
|---|---|---|---|
| rec-mars-wind | "This is real wind on Mars. Perseverance's microphone recorded it on February 22, 2021." (sol 4, mast raised, listen near 20 s) | https://www.jpl.nasa.gov/news/perseverance-rovers-supercam-science-instrument-delivers-first-results/ | NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero |
| rec-ingenuity-hum | "...during its fourth flight, on April 30, 2021." (80 m away; 84 Hz hum filtered and made louder) | https://www.jpl.nasa.gov/news/nasas-perseverance-captures-video-audio-of-fourth-ingenuity-flight/ | NASA/JPL-Caltech/ASU/MSSS/LANL/CNES/CNRS/ISAE-SUPAERO |
| rec-voyager-plasma | Plasma waves from 2012 and 2013, picked up by the antennas and played through a speaker (PIA17045, Sept 12, 2013) | https://science.nasa.gov/photojournal/voyager-captures-sounds-of-interstellar-space/ | NASA/JPL-Caltech/University of Iowa |
| rec-apollo11-landed | Neil Armstrong, "Houston, Tranquility Base here. The Eagle has landed." July 20, 1969 (102:45:58 MET, 4:17 p.m. EDT) | https://www.nasa.gov/history/july-20-1969-one-giant-leap-for-mankind/ | NASA (audio: NSSDCA a11landing.aiff) |

ing-wright, ing-final and ing-testbed already existed and are confirmed (see above).

## Design implications

1. **Voyager light-day time is wrong in code.** `src/content/notebook.ts` (line 160) and `scripts/vite/pages-plugin.ts` (line 54) hardcode `T06:16:07Z`. NASA says 10:16:07 UTC. Change both to `T10:16:07Z`, or read the time from the fact.
2. **lrv-rear-steer is confirmed.** Chapter 2 can say the first drive used only the rear wheels to steer. The front steering worked again by the next drive.
3. **opp-quote-myth: skip it.** Do not show the line "My battery is low and it's getting dark", and do not mention the myth. No NASA or JPL source covers it.
4. **mars-blue-sunset is allowed,** but only the sky near the Sun is blue. The rest of the sky is yellow to orange. The Mars sunset art should follow this.
5. **sur3-microbe: do not use.** NASA sources disagree about it.
6. **Recordings:** the wind clip is the sol 4 clip (Feb 22, 2021), not the muffled sol 1 clip. The Ingenuity hum was filtered and made louder, and the Voyager sound comes from plasma waves, not air. The `deeper` text says this, so captions should not call them plain "sounds" without that context. Add all four audio credits to `CREDITS.md` and `src/data/credits.json`.
7. **Kid text changed for facts already in the game:** ing-72, ing-testbed and v1-light-day are a little longer now. Check that the loader and notebook layouts still fit.
8. **Sources that moved:** NASA APPEL article links now redirect to nasa.gov/appel. The IEEE archive PDF returns 404. lroc.asu.edu now redirects to lroc.im-ldi.com. history.nasa.gov/alsj pages now point to apollojournals.org. Section 2 of FACT_SHEET.md and the credits still list lroc.asu.edu.
9. **Numbers to handle with care:** for the Golden Record, use 55 languages and 115 images (one NASA page says 116). Keep "about" before Ingenuity's 2,400 rpm. Do not show an exact end date for the seismometer.
