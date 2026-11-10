# PIECES OF HOME

**Game Bible v1.0** for NASA Space Apps Challenge 2026
Challenge: *Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars*

> Left behind. Still shining.

---

## 0. Read me first

This is the creative source of truth for story, design, art and audio. Numbers and dates live in `docs/FACT_SHEET.md` and, once built, in `src/data/facts.json`. In-game text must pull every number from the facts file, never from this document. Fact IDs appear like `[F:a11-lrrr-cubes]`.

If a skill's advice conflicts with this document, this document wins. You may improve anything here. Log what you changed and why in `docs/DECISIONS.md`.

Build-order tags: **P0** is built first, **P1** next, **P2** last. There is no time limit: everything in all three tiers gets built and ships.

---

## 1. Pitch

**One line:** A cozy 1 to 4 player 3D adventure where Remi steps inside their late dad's handmade dioramas of real NASA sites, delivers his letters to the machines humanity left on the Moon and Mars, and rebuilds his unfinished robot, Milo, one engineering lesson at a time.

**Project page summary:** Remi's dad built small things that kept working: a lamp that still switches itself on every evening, a half-finished robot named Milo, and a notebook of letters he never sent, each one addressed to a machine NASA left behind on another world. Alone or with up to three friends, players shrink into Dad's tiny, walkable dioramas of Tranquility Base, Hadley Rille, Meridiani Planum and Jezero Crater. They deliver each letter, play with the idea that made each machine work, and fit a new part into Milo: corner-cube eyes, mesh wheels, a solar heart, a rotor and, last of all, a voice. Every world ends with the same stamp in the notebook: *Left behind. Still answering. Still showing the way. Still teaching. Still keeping notes.* The finale points Dad's backyard dish at Voyager 1, which on November 18, 2026 becomes the first human-made object one light-day from Earth, and plays the messages Dad saved for Remi.

---

## 2. What changed from Idea 2, and why

| Idea 2 (first draft) | Pieces of Home (this version) | Why it is stronger |
|---|---|---|
| An interactive space archive with walkable reconstructions | The worlds are **Dad's handmade dioramas** of real sites, under glass domes on his workbench | The tiny-planet look gets a reason to exist, and "this is a model, not the real site" becomes part of the story instead of a disclaimer |
| Each chapter opens with a sketch and a question | **Dad wrote letters to the machines.** Players deliver them | A cozy verb kids understand in seconds, borrowed straight from Messenger's delivery loop |
| Milo regains eyes, wheels, arm, receiver, projector | **Each part is the chapter's engineering idea:** corner-cube eyes, mesh wheels, solar heart, rotor, golden-record voice | The lesson stays visible and useful for the rest of the game |
| Memories grow out of the science | **Each memory rhymes with a real mechanism:** rear steering, wind cleaning dusty panels, the Wright Flyer fabric inside Ingenuity, the Golden Record | Emotion and accuracy push in the same direction |
| One final answer, then recorded messages | A Mars chapter where a question **honestly stays open** (Opportunity never answered its last calls), before the reveal | Teaches that not every question gets answered, without being dark |
| Ending with a group photo | Same, plus a **live link to today:** Voyager 1's light-day milestone, and a workshop museum to revisit | The story ends in the real world, right now |
| 1 to 4 player co-op | **Kid-safe co-op:** no text chat, preset emotes and phrases, private room codes, and the music grows one instrument for each friend who joins | Safe for school-age players, and togetherness you can hear |
| Not specified | **Solo hints** from Nori, Lumi and Theo, **no fail states**, and a **Field Guide mode** that works without 3D and prints for classrooms | Inclusive for classrooms and older devices |
| Title: *Pieces of Home: The Pages You Left* | **Pieces of Home**, shortened, with the stamp motif *Left behind. Still ___.* | Poster-ready. Every machine, letter and Milo part is a piece of home someone left behind |

---

## 3. Audience and experience goals

- **Primary:** school-age players, ages 8 to 13. **Secondary:** teachers, parents, casual space fans, hackathon judges.
- **Length:** full story 30 to 40 minutes. Each chapter 6 to 10 minutes. First "wow" within 60 seconds of pressing Begin. First real NASA fact within 3 minutes.
- **Feel:** cozy, curious, gently bittersweet, then proud.
- **Players walk away knowing:**
  1. People and robots left real hardware on the Moon and Mars, and some of it still works or still helps science.
  2. How a corner-cube reflector sends light back, and how scientists use it to measure the Moon's distance.
  3. Why the Moon rover needed mesh wheels.
  4. How dust and wind shaped Opportunity's life, and what its rocks told us about water on Mars.
  5. Why flying on Mars is hard, and what Ingenuity proved.
  6. That Voyager 1 is still sending from beyond the planets, so far away that its signals take about a day to reach us.
  7. That NASA shares its images and data, and anyone can check a fact.

---

## 4. Design pillars

1. **Left behind, still giving.** Every machine has a story that is still going. Every chapter ends with *Left behind. Still ___.*
2. **Learn it with your hands.** The puzzle *is* the principle. Nobody reads a wall of facts.
3. **Milo is the proof.** Every lesson becomes a part of Milo you can see and use.
4. **Gentle together.** Co-op helps, never punishes. No fail states, no timers, no chat.
5. **True and traceable.** Every fact has a source a kid can open. Models are labeled as models.

---

## 5. Story

### 5.1 Premise (the first 90 seconds)

Dusk. Remi (11, they/them) and Mom arrive at Dad's workshop for the first time since he died last spring. Mom hands Remi the key and waits on the porch.

Inside, the desk lamp clicks on by itself. Dad built it to do that every evening, *"so you never come home to a dark workshop."* It is the first machine in the game that kept working after its maker was gone.

On the workbench: Milo, a small robot with a lamp for a head, dark and unfinished. A row of glass domes, each holding a tiny world Dad modeled. Two globes, the Moon and Mars, with pins in them. And a notebook addressed to Remi. Its first page:

> *For all the questions we haven't answered yet.*

Tucked inside are letters Dad wrote and never sent, each addressed to a machine: *"To the little mirrors on the Moon." "To the rover who drove further than anyone planned."* Remi decides to deliver them, and to finish Milo.

### 5.2 The fiction that holds it together

- **Dad's Little Worlds.** Each chapter is a diorama Dad built of a real landing site: a small round world under a glass dome. That is why the worlds are tiny planets, why distances are squeezed, and why every world has Dad's tag on a little stake: *"Model, not to scale. Real numbers on the back."* Flipping the tag opens the facts and their sources.
- **The Looking Lamp.** Dad's lamp swings over a dome and its light shrinks the players into the world. To leave, the lamp light pulls them back to the workbench.
- **Letters to the machines.** Each world holds three letters. Delivering one plays a short story beat about that object. The third opens the chapter's main activity.
- **The notebook.** Every delivery fills part of a page: a drawing, what it was for, what it discovered, a real NASA image with its credit, *Then and Now*, and Dad's note.
- **Look, learn, take pictures.** Remi keeps little things in their pockets. Dad's first note: *"The real sites are history. Look, learn, take pictures."* This motivates photo mode and teaches respect for heritage sites. Remi's arc moves from keeping objects to keeping memories.

### 5.3 Structure at a glance

| # | World (real place, years) | Machine | The idea you play with | Milo part | The memory it echoes | Stamp |
|---|---|---|---|---|---|---|
| Prologue (P0) | Home: the workshop, today | Dad's self-switching lamp | A machine can keep working after its maker leaves | Lamp head (already there, dark) | "So you never come home to a dark workshop." | LEFT ON. STILL SHINING. |
| 1 (P0) | Tranquility Base, Moon, 1969 (Apollo 11) | Laser Ranging Retroreflector, Eagle's descent stage, seismometer | Three mirrors in a corner send light straight back where it came from | Corner-cube eyes | Flashlight goodnights. Dad always flashed back. | LEFT BEHIND. STILL ANSWERING. |
| 2 (P1) | Hadley-Apennine, Moon, 1971 (Apollo 15) | Lunar Roving Vehicle | Mesh wheels grip soft dust. Steering from the back | Mesh wheels | Learning to ride a bike while Dad steadied the seat | LEFT BEHIND. STILL SHOWING THE WAY. |
| 3 (P0) | Meridiani Planum, Mars, 2004 to 2018 (Opportunity) | Opportunity rover | Solar power, dust and lucky winds. Rocks that remember water | Solar heart | "Some days are dusty. Wait for the wind." | LEFT BEHIND. STILL TEACHING. |
| 4 (P1) | Valinor Hills, Jezero Crater, Mars, 2021 to 2024 (Ingenuity) | Ingenuity helicopter, Perseverance's tracks | Flying in very thin air | Rotor | Paper planes, and a scrap of Remi's first drawing tucked inside Milo, like the Wright Flyer fabric inside Ingenuity | LEFT BEHIND. STILL KEEPING NOTES. |
| Finale (P0) | Home: the backyard dish, tonight. Voyager 1, 1977 to now | Voyager 1 and its Golden Record | A message carried far beyond home. Light that takes a day to arrive | Golden-record voice | Dad's saved messages | NOT LEFT BEHIND. STILL SENDING. |

### 5.4 Remi's arc

- **Start:** Remi wants one final answer from Dad. *"Finishing Milo will tell me what he wanted to say."*
- **Middle:** each world gives a true answer, just not the one Remi wanted. Light comes back when you send it. Someone can steady you from behind. Some days are dusty. You can leave notes for later.
- **Low point (Chapter 3):** Opportunity's last calls are never answered. Remi asks Milo, *"What if I never get the answer?"* Dad's margin note: *"Some questions stay open. That's allowed."*
- **Turn (Chapter 4):** the tiny keepsake hidden in Milo shows Dad carried Remi with him in everything he built.
- **End:** Milo plays Dad's saved messages. Remi doesn't get *the* answer. They get company, and discoveries of their own. They fill the last page and leave the light on for whoever comes next.

### 5.5 Characters

| Character | Role | Personality | Silhouette and color | Idle flavor | Hint voice (solo) |
|---|---|---|---|---|---|
| **Remi** (they/them) | Dad's child | Curious, determined, pockets full of keepsakes | Big backpack, mustard jacket with many pockets | Turns a pebble over, checks pockets | Asks the question out loud |
| **Nori** | Friend | Adventurous, spots routes, "let's try" | Cap, orange-red windbreaker | Stretches, points at the horizon | Route hints: "What if we went around?" |
| **Lumi** | Friend | Thoughtful, loves images and patterns | Beret, lavender hoodie, small sketchbook | Sketches, tilts head | Visual hints: "Look at the shadows." |
| **Theo** | Friend | Cheerful, loves how things fit | Goggles, teal overalls, tool belt | Spins a screwdriver, hums | Mechanism hints: "Three mirrors, one corner..." |
| **Milo** | Companion, not playable | Grows from silent to expressive. Copies the group | Lamp head, small rover body | Waves back, copies celebrations, stops beside anyone taking a photo | Beeps, then Dad's recordings |
| **Dad** | Present only through handwriting, sketches and saved recordings | Warm, funny, plain-spoken | Never shown in 3D. Appears as drawings in the notebook | | Margin notes, the last hint tier |
| **Mom** | The safe adult | Calm, kind | Seen on the porch at the start and end | | |

All four kids can do every essential action. Personality changes only animation, voice pitch, optional lines and hint flavor. In solo play the player is Remi, and the friends wait in the workshop where they can be asked for hints. In co-op, each player picks a kid and hints come from Dad's margin notes.

### 5.6 Milo, stage by stage

| Stage | After | Looks | Can now | Habit learned |
|---|---|---|---|---|
| 0 | Prologue | Dark lamp head, no eyes, on a stand | Nothing. A faint hum when Remi is near | |
| 1 | Chapter 1 | Corner-cube eyes that glint back at you | Recognizes each player, reacts to discoveries, flashes back at your flashlight | Waves back |
| 2 | Chapter 2 | Wire-mesh wheels with chevrons | Follows the group, carries small items | Copies celebrations |
| 3 | Chapter 3 | Solar heart: glows in light, sleepy in shade | Lights dark corners. Naps in shadow until sun or wind wakes him | Stops beside anyone taking a photo |
| 4 | Chapter 4 | Little rotor | Short hover hops, scout camera | Hops when happy |
| 5 | Finale | Golden-record voice | Plays Dad's saved messages and the players' photos | Hums the theme |

If the Surveyor 3 bonus chapter is built, it adds a stage between 3 and 4: a little scoop arm that lets Milo pick things up and hand them to players.

### 5.7 Dad's voice

- Plain words, short sentences, a joke now and then, never a lecture.
- Talks to Remi as a capable person. Never makes Remi responsible for him.
- Never describes illness or dying. He talks about curiosity, building, trying and resting.
- His recordings are saved messages, always labeled as recordings, never a copy of him.

Sample lines (final copy can improve them):

- Prologue, the lamp: *"I made it turn on by itself. So you never come home to a dark workshop."*
- Chapter 1: *"Send a light, get a light back. Works on the Moon. Works on your bedroom window too."*
- Chapter 2: *"You don't always steer from the front. Sometimes someone steadies you from behind."*
- Chapter 3: *"Some days are dusty. Wait for the wind."*
- Chapter 3, margin: *"Some questions stay open. That's allowed."*
- Chapter 4: *"I tucked a little piece of you in here. Every good flying machine carries one."*
- Finale (kept from Idea 2): *"I couldn't know every question you would ask. I just wanted to leave you a little company while you found the answers."*
- Last page: *"Leave the light on for whoever comes next."*

### 5.8 The reveal and the ending

1. Night in the backyard. Players aim Dad's model dish antenna at Voyager 1's patch of sky and "send" Dad's last letter. The notebook does the math with them: at the speed of light, the letter would take about a day to arrive. (Date-aware text tied to the light-day milestone `[F:v1-light-day]`.)
2. The last part, a small golden disc Dad labeled *"Milo's record"*, clicks into Milo's chest. Like Voyager's Golden Record, it holds greetings and sounds of home: rain on the workshop roof, the lamp's click, Remi laughing, and Dad's saved messages.
3. Milo plays the messages. Then he projects something new: the photos the players took on their journey. Inherited memories and new ones, side by side.
4. One blank page remains: *"What will you discover next?"* Players add a group photo, a favorite-discovery sticker, and a name for their next adventure (word chips; free text only in solo and never shared).
5. Remi and friends reopen the workshop as a tiny museum. Mom on the porch. The lamp left on. Final image: the group walks toward the next dome, Milo rolling after them.
6. Credits list every NASA source. Then free roam: the museum stays open and every world can be revisited.

### 5.9 Care with grief

- Use clear words ("died"). No on-screen illness, no scary imagery, no guilt mechanics, no "save Dad" fantasy.
- The sadness gets room (Chapter 3), then warmth (Chapter 4 and the Finale).
- The About page has a short *For grown-ups* note: the story includes the death of a parent, with gentle suggestions for talking about it afterward. No therapy claims.

---

## 6. Chapters in detail

### Prologue: The Workshop (P0)

- **Setting:** Home, a tiny round planet at dusk. House and porch, garden, a mailbox (a nod to Messenger), Dad's workshop shed with a dollhouse cutaway when you step inside, a hill with a telescope, a backyard dish antenna, and the workbench with the domes, globes, Milo and the notebook.
- **Teaches:** movement, the delivery verb, the notebook, photo mode, emotes.
- **Beats:** arrive with Mom, take the key, the lamp clicks on, find the notebook, deliver the first letter *"To the lamp"* to the lamp itself (Dad's joke: *"Thanks for waiting up"*), stamp **LEFT ON. STILL SHINING.**, the globes light up their pins, choose the first dome.
- **The globes:** real NASA public-domain Moon and Mars maps, with pins at the real landing coordinates (from NSSDCA and mission pages). Pins: Apollo 11 and Opportunity (P0), Apollo 15 and Ingenuity (P1), Archive cards (P2).

### Chapter 1: Tranquility Base, Moon, 1969 (P0)

- **Real hardware:** the Apollo 11 Laser Ranging Retroreflector `[F:a11-lrrr-placed]` `[F:a11-lrrr-cubes]`, the descent stage of the lunar module Eagle, the seismometer (verify details), footprints.
- **Learning goals:** what a retroreflector is; why three mirrors at right angles send light back to its source; how timing a laser pulse measures distance; the Moon drifts about 3.8 cm farther away each year `[F:moon-recede]`; the reflector needs no power and is still used today `[F:a11-lrrr-nopower]` `[F:lrrr-still-used]`.
- **Arrive:** black sky, Earth low on the horizon, hard shadows, little regolith puffs at each step. Dad's tag: *"Model, not to scale."*
- **Letters:**
  1. *To the descent stage:* the bottom half of Eagle stayed behind and worked as the launch pad for the trip home (verify wording).
  2. *To the seismometer:* it listened for moonquakes (verify how long it ran). Players stomp and a squiggly line appears in the notebook.
  3. *To the little mirrors:* opens the main activity.
- **Main activity: Send a Light, Get a Light**
  - A laser pulse arrives from a telescope on Earth: a dotted beam from the Earth in the sky.
  - Try a flat mirror. The beam bounces off into space. The notebook says *"Close!"*
  - Build a corner. Three mirror panels snap into an inside-corner frame, like the inside corner of a box. Now the beam returns to Earth from any angle. Rotate the frame: it still works. That is the insight.
  - Timing: fire a pulse, hear *ping*, then the return *pong* about 2.5 seconds later, the real round-trip time for light at the Moon's distance `[F:light-roundtrip]`. Players count along. The notebook turns time into distance.
  - Finish: the full array of 100 cubes lights up and glints back at Earth.
  - **Solo:** panels stay in holders where you leave them. **Together:** each player holds one panel steady while another fires the pulse from the Earth console. Any number of players works.
- **Milo upgrade:** corner-cube eyes. Milo opens his eyes and glints back at each player. In dark places, shine a flashlight and Milo's eyes flash back.
- **Memory:** flashlight goodnights from Remi's window to the workshop. Dad always flashed back.
- **Notebook page:** drawing of the array; *What it's for:* bouncing lasers back to Earth; *What we learned:* the Moon's exact distance and its slow drift; real images: an Apollo 11 photo of the reflector and an LROC orbital image of the Apollo 11 site; *Then and Now:* "Still used by scientists. Needs no power."
- **Deeper notes:** Apollo 14 and Apollo 15 left arrays too, with 100 and 300 cubes `[F:lrrr-others]`.
- **Stamp:** LEFT BEHIND. STILL ANSWERING.

### Chapter 2: Hadley-Apennine, Moon, 1971 (P1)

- **Real hardware:** the Apollo 15 Lunar Roving Vehicle, the first rover driven on the Moon, parked near the descent stage of the lunar module Falcon; Hadley Rille; Mount Hadley.
- **Learning goals:** why wire-mesh wheels `[F:lrv-wheels]`; how the rover let astronauts reach farther (27.8 km in about 3 hours of driving) `[F:a15-lrv-distance]`; steering with the rear wheels `[F:lrv-rear-steer]` (verify); its tracks seen from orbit (verify).
- **Letters:**
  1. *To the wheels:* woven zinc-coated steel wire with titanium chevrons that kept the wheels from sinking.
  2. *To the seats:* the two astronauts who rode them `[F:lrv-crew]`.
  3. *To the tracks:* opens the main activity.
- **Main activity: Steer from the Back**
  - Wheel lab: three wheels on a dusty test strip (a rubber tire, a solid metal wheel, the mesh wheel with chevrons). Push each across. The mesh wheel grips and stays on top of the dust. Word any claim about rubber tires only as the verified source allows.
  - The drive: Dad's model rover is rideable. On the real rover's first drive the front steering didn't work, so the crew steered with the rear wheels (only state this if verified in the Apollo Lunar Surface Journal; otherwise present it as a "challenge mode" with no historical claim). Players drive to the rille overlook using Dad's taped satellite photo of the real tracks as the map, then park the rover back in its spot.
  - **Solo:** Milo navigates with an arrow on the photo. **Together:** a driver and a navigator ride the two seats, like the real crew, while the others walk ahead and plant flags at rocks worth sampling.
- **Milo upgrade:** mesh wheels. Milo follows the group and carries small things.
- **Memory:** learning to ride a bike while Dad steadied the back of the seat.
- **Notebook page:** LRV drawing and a wheel cutaway; purpose; discovery (it let crews collect samples much farther from the lander); real images: the rover beside Hadley Rille, an LROC traverse image; *Then and Now:* "Still parked where the crew left it."
- **Stamp:** LEFT BEHIND. STILL SHOWING THE WAY.

### Chapter 3: Meridiani Planum, Mars, 2004 to 2018 (P0)

- **Real hardware:** Opportunity (Mars Exploration Rover B), its Rock Abrasion Tool, its solar panels.
- **Learning goals:** planned for 90 sols, worked more than 14 years, drove 45.16 km `[F:opp-planned]` `[F:opp-years]` `[F:opp-distance]`; solar power and dust, and wind gusts that sometimes cleaned the panels (verify); hematite "blueberries" showed that water once soaked the ground `[F:opp-blueberries]`; a planet-wide dust storm blocked the sunlight in 2018, last contact June 10, 2018 `[F:opp-last-contact]`; NASA sent more than 1,000 commands before declaring the mission complete in February 2019 `[F:opp-end]`.
- **Arrive:** butterscotch sky, ochre ground, soft dust, small dust devils on the horizon. Later a blue-tinted sunset near the Sun (verify a NASA source).
- **Letters:**
  1. *To the bounce marks:* Opportunity landed wrapped in airbags and rolled into a small crater (verify the "hole in one" story).
  2. *To the rock grinder:* opens a short "blueberry" activity. Grind a rock face, look through Milo's eyes (now a microscope), find the tiny spheres, and sort three clue cards into "formed in water" or "not".
  3. *To the solar panels:* opens the main activity.
- **Main activity: Wait for the Wind**
  - The model rover's panels are dusty and its power meter is low. Nobody on Mars could wipe them, so players can't either: a hand passes through with a gentle *"No hands on Mars."*
  - Dust devils wander across the plain. Players plant breeze flags that nudge a dust devil's path. Guide one across the panels: power jumps and the model rover wakes with a chirp.
  - **Solo:** plant up to 3 flags; a new dust devil arrives every 20 seconds; nothing can fail. **Together:** each player holds a flag in a different spot; the dust devil follows the combined push.
- **Story beat: The Long Storm.** Over a minute the sky darkens. The model's last data appear as numbers, not words: very low power, a very dark sky. Remi reads them. The notebook explains that Opportunity never said goodbye in words: people turned its last data into a sentence and shared it (verify `[F:opp-quote-myth]` before using). Then players help "send the calls": each tap sends one signal, and the counter climbs past 1,000. No answer. Quiet music. Dad's margin note: *"Some questions stay open. That's allowed."*
- **Milo upgrade:** solar heart. Milo's lamp head glows in light. In shade he naps until sun or wind wakes him.
- **Memory:** Dad joked that everything he built came with a "90-day warranty." The night-light he made for Remi still works.
- **Notebook page:** drawing; *What it was for:* a robot geologist looking for signs of water; *What we learned:* blueberries and ancient water; real images: an Opportunity self-portrait or tracks, the microscopic image of blueberries; *Then and Now:* "Silent since June 2018. Its discoveries are still used."
- **Stamp:** LEFT BEHIND. STILL TEACHING.

### Chapter 4: Valinor Hills, Jezero Crater, Mars, 2021 to 2024 (P1)

- **Real hardware:** Ingenuity at its final spot, Valinor Hills `[F:ing-testbed]`; its first airfield, Wright Brothers Field (verify name); Perseverance's tracks.
- **Learning goals:** first powered, controlled flight on another planet, April 19, 2021 `[F:ing-first-flight]`; thin Martian air needs big, fast rotor blades (verify the numbers); planned for about 5 flights, flew 72 `[F:ing-plan]` `[F:ing-72]`; its last flight on January 18, 2024 damaged its blades `[F:ing-final]`; it now stays put as a testbed, saving notes for future visitors `[F:ing-testbed]`; it carries a tiny swatch of the 1903 Wright Flyer's wing fabric `[F:ing-wright]`.
- **Letters:**
  1. *To Wright Brothers Field:* the first-flight beat.
  2. *To Perseverance's tracks:* Ingenuity sent its messages through the rover, its base station.
  3. *To Ingenuity:* opens the main activity.
- **Main activity: Thin Air**
  - Rotor bench: sliders for blade length and spin speed, and an *Earth air / Mars air* switch. In Mars air the same rotor barely lifts. Make it bigger and faster until the model hops. Simple, honest physics (more air and faster blades make more lift); numbers rounded and labeled "model".
  - Scout flight: Milo gets his rotor. One player looks through Milo's scout camera from above and marks a safe path; the others drive the model rover along it. (P1 may simplify to solo scouting.)
  - Leave a note for later: like Ingenuity saving data for whoever visits next, players add a note to the model's log with word chips. It reappears in the museum ending.
- **Twist:** inspecting the model, players find the Wright Flyer fabric detail. Then Remi finds that Dad tucked a scrap of Remi's first drawing inside Milo's chassis. *"Every good flying machine carries a little piece of where it came from."*
- **Milo upgrade:** rotor (hover hops, scout camera).
- **Memory:** paper planes from the hill.
- **Notebook page:** drawing; purpose; discovery (flight on another world works, and scouting helps rovers); real images: Ingenuity's shadow from its first flight, Perseverance's image of Ingenuity at Valinor Hills; *Then and Now:* "Can't fly anymore. Still saving notes for future visitors."
- **Stamp:** LEFT BEHIND. STILL KEEPING NOTES.

### Finale: The Long Light (P0)

- **Real hardware:** Voyager 1 and its Golden Record.
- **Learning goals:** launched in 1977 `[F:v1-launch]`; now in interstellar space, beyond the planets `[F:v1-interstellar]`; on November 18, 2026 it becomes the first human-made object one light-day from Earth `[F:v1-light-day]`; it carries a Golden Record with greetings in 55 languages, 115 images, sounds and music, chosen by a committee led by Carl Sagan `[F:golden-record]`.
- **Beats:** see 5.8. The dish points at Voyager 1's real direction in the sky (RA and Dec from JPL Horizons) on a simple star map. The "about a day to arrive" line comes from a distance table fetched at build time.
- **Date-aware text:** before the milestone, "becomes ... on November 18, 2026." After it, "became ... on November 18, 2026. Today its signals take about X hours Y minutes to reach us."
- **Stamp:** NOT LEFT BEHIND. STILL SENDING.

### Archive cards (P2)

Small museum cards in the workshop, each with a globe pin, a real image, three facts and source links: Surveyor 3 and the Apollo 12 visit, Sojourner, Viking 1, Spirit, InSight, the Apollo 14 and 15 reflectors. They also appear in the Field Guide. Add a card only when every fact on it is verified.

### Bonus chapter idea (P2): Ocean of Storms

Surveyor 3 is the only robotic probe that people have visited on another world `[F:sur3-visit]`. Players guide a pinpoint landing near it, then help the astronauts snip its camera so engineers on Earth could study what years on the Moon did to it. A *Science checks itself* note: a famous microbe claim was later traced to likely contamination back on Earth `[F:sur3-microbe]`. Milo gets an arm.

---

## 7. Core loop and systems

**Loop:** open the notebook, choose a dome, explore the little world, deliver three letters, play the main activity, fit Milo's new part, hear a memory, watch the stamp land on the page, return to a workshop that has changed a little.

- **Movement on small spheres:** walk, run, jump, interact, carry. Camera tuned against the "sphere wobble" some Messenger players found disorienting: stable horizon, gentle lead, auto-recentering, and a paper arrow pointing to the next letter.
- **Letters:** carried as a visible envelope. Delivery prompt. A short story beat with speech bubbles and gibberish voices, Messenger style.
- **Notebook:** spreads that fill in as you discover; real images with credits; *Then and Now*; *Deeper notes* for older readers; source links.
- **Photo mode:** polaroid frame, saved on the device (about 24 max). Feeds the ending.
- **Emotes:** wave, heart, star, look here, question, yay, plus six preset phrases: "Over here!", "Look!", "Nice!", "Help?", "Let's go!", "Thank you!"
- **Hints:** three tiers (nudge, direction, show me). Solo: ask a friend in the workshop or tap the hint stamp. Co-op: Dad's margin notes.
- **No fail states, no timers, no score.** Optional *Noticing* stickers reward curiosity.
- **Save:** automatic after each delivery and stamp. Continue from the title. Chapter select unlocks after the prologue. An *Explore freely* setting unlocks everything for teachers and judges.
- **The workshop changes** after each chapter: a new photo on the wall, Milo's new part, a glowing dome, a fuller museum shelf.

---

## 8. Co-op and kid safety

- 1 to 4 players online, in private rooms. Create a room to get a friendly code (three kid-safe words and a number) and a share link. Join by code or link.
- Character select: each player picks a different kid. The story stays Remi's no matter who plays Remi.
- **Shared:** one notebook, one Milo, the letters and puzzles. **Personal:** your photos stay on your device.
- **Join any time.** Mid-chapter joiners appear near the group and progress syncs. Nobody loses the ending by missing a session; missed memories replay from the notebook.
- Puzzles accept any number of players: solo uses holders, groups can split roles.
- The music adds one instrument for each friend present.
- **Safety:** no text chat, no voice chat, no usernames, no profiles. Only preset emotes and phrases. Rooms are private and expire after inactivity. No analytics, no tracking, nothing stored about players beyond room progress.
- If the co-op server is busy or offline, the game keeps working solo and says so kindly.

---

## 9. Art direction

**Concept:** Dad's handmade dioramas under a warm lamp. Messenger's tiny-planet charm, moved to dusk and lamplight, with the texture of paper, paint and ink.

- **Rendering:** soft toon shading (2 to 3 light bands) with a warm rim light; ink outlines in a dark warm grey (never pure black) from depth and normal edges; per-world color grading; gentle paper grain; vignette; a subtle tilt-shift blur at the screen edges that sells "miniature".
- **Worlds:** small spheres, with Home a bit larger for comfort. Props sit on the surface like model-kit pieces. Dad's tags stand on little stakes.
- **Palettes (starting points, tune freely):**
  - Home at dusk: paper `#F4ECDD`, lamp amber `#F2A541`, dusk indigo `#2E2A4F`, roof clay `#C0573E`, garden sage `#7FA37A`, ink `#2B2622`
  - Moon: regolith `#B9B4AA`, shadow blue-grey `#59607A`, space `#0E1020`, Earth blue `#4A90C8`, highlight `#F5F1E8`, foil gold `#D9A441`
  - Mars: sky butterscotch `#D8A67A`, ground ochre `#B5643A`, rock rust `#8E3F2A`, shadow plum `#5B3A4A`, sunset blue `#7FA6C9`, hematite `#4C5A7A`
  - Finale: night navy `#0B1030`, starlight `#FFF6E0`, record gold `#E0B34A`
- **Characters:** chunky chibi proportions (head about 40 percent of height), simple drawn faces, readable silhouettes (backpack, cap, beret, goggles) so nobody relies on color alone.
- **NASA hardware:** faithful silhouettes and key details (gold foil, mesh wheels, rotor blades, solar decks), simplified to the toy-model look. Check every model against NASA photos.
- **Motion:** drawn elements "boil" with a 2 to 3 frame line wobble (the technique behind Messenger's loader). Paper elements spring with a small overshoot. Nothing uses a generic fade-in.
- **Never:** purple-blue tech gradients, glassmorphism, generic sci-fi HUDs, stock space wallpapers, the NASA insignia.

---

## 10. Loading screen and title sequence

The first impression for every judge. Make it unforgettable and fast.

1. **Instant paper (0 ms).** `index.html` paints a notebook page before any JavaScript runs: warm paper, faint engineering grid, a coffee-ring stain. Inline SVG and CSS only.
2. **The lamp draws itself.** An ink sketch of Dad's desk lamp traces stroke by stroke as real assets load; actual progress drives the stroke. The lines boil gently so it never looks frozen.
3. **"Things that kept working."** In Dad's handwriting, a list fills down the margin, one line per loading milestone, each a real fact from the facts file: *"100 little mirrors at Tranquility Base." "Voyager 1, still sending." "Ingenuity, saving notes." "This lamp."*
4. **Ready.** The bulb flicks on. Warm light blooms across the page with a soft hum. The first line writes itself: *"For all the questions we haven't answered yet."* Prompt: **Turn on the light** (click, tap or any key). This gesture also unlocks audio.
5. **Into the world.** Lamp click. The page curls away. The camera pulls back from the lamp's glow, out through the workshop window, up to the whole Home planet at dusk.
6. **Title.** "PIECES / OF / HOME" assembles from chunky 3D block letters that drop onto the planet one by one, each playing one note of the game's six-note motif. The O in HOME is a glass bulb that glows. Below hangs a pull-chain switch labeled BEGIN. Pull it: the bulb brightens, the planet's windows light up, the music starts.
7. **Menu as notebook tabs:** Continue, New story, Play together, Field Guide, Settings, Credits.

Also: a reduced-motion version (no boil, no curl, a quick cross-dissolve); progress announced to screen readers; no WebGL means a kind paper message and a link to the Field Guide; after 8 seconds of slow loading, *"Still loading. The lamp is warming up."* with a percentage.

---

## 11. UI language: Dad's notebook

- Everything 2D lives on paper: notebook spreads, taped polaroids of real NASA images with museum-label credits, paper clips as page counters, washi tape, pencil underlines and circles in a hand-drawn style, ink stamps as buttons.
- The HUD stays out of the way: small stamp buttons at the edge (Notebook, Photo, Emote, Settings), a paper arrow toward the next letter, a hand-drawn key cap or tap icon for prompts.
- **Type:** a warm handwriting face for Dad, a highly legible sans for reading text (Atkinson Hyperlegible Next or similar), a stencil or slab face for museum tags and stamps. All self-hosted with open licenses. Title letters are custom 3D geometry.
- **Reading level:** about grade 3 to 5 for main text. *Deeper notes* can go higher.
- **Copy rules:** short sentences, active voice, no em dashes, no jargon without a picture, every number from the facts file.

---

## 12. Audio direction

All music and sound effects are made in JavaScript with the Web Audio API at runtime. No copyrighted audio.

The architecture follows Messenger's: a central audio controller with named cues; ambience loops that all play at once and crossfade by zone; footsteps as a synced loop whose volume follows movement; positional sounds; small random pitch changes; a lighter mix on low-memory devices. Then it goes further:

- **Music:** cozy music box and felt-piano tones, warm pads, soft vinyl crackle, built on a six-note motif first heard in the title. Each world re-voices it: Home (warm, major sevenths), Moon (sparse glassy bells, lots of air), Mars (low warm pads, dusty filtered noise, pentatonic), Finale (the full theme). Adaptive layers: exploring, focused (puzzles), discovery sting, and one extra instrument per co-op friend.
- **Ambience:** workshop (clock tick, lamp hum, crickets), Moon (a quiet room tone and the lamp's faint hum; a Deeper note explains that the real Moon is silent because there is no air to carry sound), Mars (thin wind, dust hiss), Finale (night insects, dish servo).
- **SFX:** footsteps by surface, jump and land, page flips, pencil scribbles, stamps, tape, the lamp click, Milo's beeps and moods, parts clicking into place, the laser ping and its real 2.5-second return, mesh-wheel crunch, rover motor whine, rock grinder, dust devil whoosh, rotor whir, dish servo, radio hiss, record crackle, camera shutter, emote pops.
- **Voices:** Messenger-style gibberish babble, different pitch and timbre per character. Subtitles on by default. Dad's recordings can use real lines recorded by a team member (optional) or a warm hummed babble with handwritten captions.
- **Mix:** voice ducks music; opening the notebook gently muffles the world; a limiter protects small speakers; volume sliders per bus.

---

## 13. Accessibility and inclusion

- **Controls:** keyboard (WASD or arrows), mouse, touch joystick, gamepad. One interact button. Remappable keys.
- Subtitles on by default with speaker names; text size options; a dyslexia-friendly reading mode; high-contrast UI; reduced motion; no flashing; no timing pressure anywhere.
- Puzzles never depend on color alone; shapes and patterns carry meaning too.
- Read-aloud option for notebook pages (browser speech).
- **Field Guide mode:** the whole story and every fact as a simple, screen-reader-friendly, printable web page. It works on any device and doubles as a classroom handout.
- **Low-end devices:** automatic quality tiers. Targets school laptops and mid-range phones, portrait and landscape.
- **Language:** English first, strings ready for translation, Filipino UI in P1 and Filipino story text in P2.

---

## 14. Accuracy and honesty

- One facts file is the only source of numbers. Each fact has kid wording, deeper wording, value, date, source title, source URL and a "checked on" date. A build check fails if a fact has no source or text references a missing fact.
- Models are labeled as models. Real images carry their exact credit line (for example, *NASA/JPL-Caltech* or *NASA/GSFC/Arizona State University*).
- Myths handled on purpose: Opportunity's famous "last words" (verify before using); Surveyor 3's microbe story (P2).
- Live facts are date-aware (Voyager).
- No NASA insignia, logotype or seal, and nothing that implies NASA endorsement. NASA is credited as a source, never as a sponsor.

---

## 15. Tech and hosting (summary)

- A web game: Three.js for 3D, a light UI layer (Svelte 5 by default), TypeScript, Vite.
- Real-time co-op on Cloudflare Durable Objects (via PartyServer). Hosted on Cloudflare Workers with static assets. One URL for the game and its multiplayer.
- **Why Cloudflare over Vercel:** static asset requests are free and unlimited on Cloudflare, while Vercel Hobby includes 100 GB of transfer per month (a 3D game ships many megabytes per visitor). Durable Objects give every co-op room its own stateful WebSocket server on the free plan; Vercel's WebSockets close when a function hits its time limit and need an external store for shared room state.
- **Messenger reference:** study its techniques (tiny planets, toon and outline post-processing, the audio controller, the boiling-line loader) and write our own code and assets. Nothing from Abeto's game is copied.

---

## 16. Build order and budgets

There is no deadline. Everything below gets built, in this order, each tier finished and polished before the next starts.

- **P0 (first):** loading and title sequence; Home and Prologue; Chapter 1 (Moon); Chapter 3 (Mars); Finale; notebook; photo mode; audio; solo play; Field Guide; basic co-op (join, see each other, emotes, shared progress); live deploy.
- **P1:** Chapter 2 (LRV); Chapter 4 (Ingenuity); co-op puzzle roles; museum free roam; Filipino UI strings.
- **P2:** Archive cards; the Surveyor 3 bonus chapter (Milo's scoop arm); real voice lines if a teammate records them; Filipino translation of all story text; a final polish pass on every world.
- Never trade quality for speed. A tier is done only when it meets the quality bar in `CLAUDE.md`.
- **Budgets:** first playable download under 8 MB; each world loads on its own, under 4 MB; 60 fps on a mid-range laptop, steady 30 fps on a mid-range phone; title interactive within 5 seconds on a typical connection.

---

## 17. Judging alignment and the 30-second video

Space Apps judges on Impact, Creativity, Validity, Relevance and Presentation (2025 guide; confirm for 2026).

- **Impact:** free, in the browser, no install, kid-safe co-op, Field Guide for classrooms, works on modest devices.
- **Creativity:** dioramas, letters to machines, Milo as the proof, *Left behind. Still ___.*
- **Validity:** every fact sourced, models labeled, myths corrected, live Voyager data.
- **Relevance:** Moon, Mars and deep-space hardware; real NASA images, models, coordinates and ephemeris.
- **Presentation:** the loading-to-title sequence and a tight 30-second video.

**30-second video storyboard:**

| Time | Shot |
|---|---|
| 0 to 3 s | The lamp draws itself on the notebook page. The bulb flicks on. |
| 3 to 7 s | Title letters drop onto the Home planet. A hand pulls the chain. |
| 7 to 13 s | Moon diorama. The laser returns from the corner cube: *ping... pong.* |
| 13 to 19 s | Mars. Friends herd a dust devil across the solar panels. Milo's heart lights. |
| 19 to 24 s | Ingenuity hop, emotes, a photo flash. Milo complete. |
| 24 to 30 s | Backyard dish at night. "Voyager 1: one light-day from Earth. Still sending." Title card and URL. |

---

## 18. Risks and mitigations

| Risk | Mitigation |
|---|---|
| A big scope drifts or stalls | Build order tiers, data-driven chapters, deploy after every phase, PROGRESS.md so any session can resume, parallel sessions |
| The 3D looks generic | Strict art direction, screenshot review after every visual change, outlines and grading early |
| NASA models are heavy | Simplify and compress, or rebuild low-poly from photos |
| Walking on spheres feels disorienting | Camera rules, a larger hub, the objective arrow, playtests |
| Facts drift | One facts file, a build check, an independent fact audit |
| Co-op is complex | Basic co-op in P0, roles in P1, solo always works |
| Free-tier limits | Send updates only while moving, batch messages, fall back to solo gracefully |
| The grief theme | Writing guide, a *For grown-ups* note, a warm ending |

---

## 19. Title

**Pieces of Home** (chosen by the team). Tagline: *Left behind. Still shining.*

Why it fits: Remi finishes Milo from pieces Dad left; every machine in the game is a piece of home that humanity left on another world; and the workshop lamp, the letters and the photos are the pieces Remi keeps.
