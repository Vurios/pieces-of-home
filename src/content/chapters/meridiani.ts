import type { ChapterDef } from "./types";

/**
 * Chapter 3: Meridiani Planum, Dad's model of Opportunity's plains on Mars
 * (Game Bible 6, P0). The idea to play with: solar power, dust and lucky
 * winds, and rocks that remember water. The sad part of the story gets room
 * here (Game Bible 5.9): the rover's last calls are never answered.
 *
 * The rover's famous "last words" are left out on purpose: no NASA or JPL
 * source confirms them (DECISIONS #50). Its last data shows as gauges.
 */
export const MERIDIANI: ChapterDef = {
  id: "chapter-3",
  world: "meridiani",
  spread: "opportunity",
  dome: "Meridiani Planum",
  title: "Chapter 3: Meridiani Planum",
  place: "Meridiani Planum",
  arrival: [
    { wait: 0.6 },
    { say: "Mars! The sky is the color of butterscotch.", who: "remi" },
    { say: "And everything is dusty. Even me.", who: "remi" },
    { note: "Model, not to scale. Mind the dust devils. They're friendly." },
  ],
  tag: { title: "Meridiani Planum", lines: ["Model, not to scale.", "Real numbers on the back."] },
  letters: [
    {
      id: "opp-letter-bounce",
      to: "bounce",
      address: "To the bounce marks",
      prompt: "Give the letter to the bounce marks",
      where: "Big round dents in the dust, rolling down into the little crater.",
      letter: "You came down bouncing, and you rolled right into the best spot. Lucky, and brave.",
      beat: [
        { say: "These dents go bounce, bounce, bounce... right into the crater!", who: "remi", at: "bounce" },
        { fact: "opp-hole-in-one" },
        { fact: "opp-landing" },
        { say: "A hole-in-one on Mars. Dad would love that.", who: "remi" },
      ],
    },
    {
      id: "opp-letter-grinder",
      to: "grinder",
      address: "To the rock grinder",
      prompt: "Give the letter to the rock grinder",
      where: "On the end of the rover's arm, by the striped rocks.",
      letter: "You scratched the rocks so gently, just to read what they remembered.",
      beat: [
        { say: "The rover has a little grinder on its arm. Let's look inside a rock!", who: "remi", at: "grinder" },
        { game: "blueberries" },
        { fact: "opp-blueberries" },
        { say: "Tiny balls that grew in water. Mars was wet once!", who: "remi" },
      ],
    },
    {
      id: "opp-letter-panels",
      to: "panels",
      address: "To the solar panels",
      prompt: "Give the letter to the solar panels",
      where: "The rover's flat blue wings, covered in red dust.",
      letter: "You drank sunlight every day. Even on the dusty ones, you waited for better weather.",
      beat: [
        { say: "Its panels are covered in dust. The rover is too sleepy to move.", who: "remi", at: "panels" },
        { say: "Can I just wipe them?", who: "remi" },
      ],
    },
  ],
  activity: "wait-for-the-wind",
  activityStart: [
    { note: "No hands on Mars, kiddo. Some days are dusty. Wait for the wind." },
    { say: "Dust devils! Maybe the breeze flags can lead one here.", who: "remi" },
  ],
  activityDone: [
    { say: "It's awake! Hi, little rover!", who: "remi", at: "rover" },
    { fact: "opp-cleaning" },
    { wait: 1.2 },
    { cue: "storm" },
    { say: "Uh oh. The sky is getting dark.", who: "remi" },
    { wait: 5 },
    { say: "The dust is everywhere. The panels can't see the sun.", who: "remi" },
    { game: "telemetry" },
    { fact: "opp-last-contact" },
    { say: "We have to call it. Maybe it can still hear us.", who: "remi" },
    { game: "calls" },
    { say: "NASA called too. Again and again.", who: "remi" },
    { fact: "opp-end" },
    { cue: "silence" },
    { wait: 2.5 },
    { say: "What if I never get the answer?", who: "remi" },
    { note: "Some questions stay open. That's allowed." },
    { cue: "clear" },
    { wait: 2 },
  ],
  milo: 3,
  miloPart: "solar heart",
  partPrompt: "Give Milo his solar heart",
  partFitted: [
    { say: "A solar heart. It glows when the light is on him.", who: "remi" },
    { say: "And in the shade he naps. Just like the rover.", who: "remi" },
  ],
  memory: [
    { fact: "opp-planned" },
    { fact: "opp-years" },
    { say: "Dad joked his inventions came with a warranty like that. A short one.", who: "remi" },
    { say: "But the night-light he made me still works. Every single night.", who: "remi" },
    { note: "Some days are dusty. Wait for the wind." },
  ],
  stamp: ["Left behind.", "Still teaching."],
  goals: {
    arrive: "Look around Meridiani Planum",
    letters: "Deliver Dad's three letters",
    activity: "Wake the rover",
    home: "Go back to the workshop",
  },
};
