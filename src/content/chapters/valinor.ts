import type { ChapterDef } from "./types";

/**
 * Chapter 4: Valinor Hills (Game Bible 6, P1). Dad's model of Ingenuity's
 * corner of Jezero Crater on Mars: the little helicopter where it stays after
 * its last flight, Wright Brothers Field where it first flew, and the tracks
 * of the rover that carried its messages. The idea to play with: flying in
 * very thin air, scouting ahead, and keeping notes for whoever comes next.
 */
export const VALINOR: ChapterDef = {
  id: "chapter-4",
  world: "valinor",
  spread: "ingenuity",
  dome: "Valinor Hills",
  title: "Chapter 4: Valinor Hills",
  place: "Valinor Hills",
  arrival: [
    { wait: 0.6 },
    { say: "Mars again! But this part has wavy sand, like a beach.", who: "remi" },
    { fact: "ing-site" },
    { say: "Look, a tiny helicopter. Dad's letters are for it!", who: "remi" },
    { note: "Model, not to scale. I made the helicopter big so you can see it." },
  ],
  tag: { title: "Valinor Hills", lines: ["Model, not to scale.", "Real numbers on the back."] },
  letters: [
    {
      id: "ing-letter-field",
      to: "airfield",
      address: "To Wright Brothers Field",
      prompt: "Give the letter to Wright Brothers Field",
      where: "Dad's square of pale pebbles, with a little shadow painted in the middle.",
      letter: "You were the very first airfield on another world. Somebody has to go first. Thank you for being brave.",
      beat: [
        { say: "This is where it flew the very first time.", who: "remi", at: "airfield" },
        { fact: "ing-first-flight" },
        { fact: "ing-first-flight-length" },
        { say: "Dad painted its shadow. Ingenuity took a picture of its own shadow too!", who: "remi" },
      ],
    },
    {
      id: "ing-letter-tracks",
      to: "tracks",
      address: "To the rover's tracks",
      prompt: "Give the letter to the rover's tracks",
      where: "The long wheel tracks that run past the helicopter and over the hill.",
      letter: "Your rover is a good friend. It listened, and it carried every message home.",
      beat: [
        { say: "The rover drove on. But its tracks are still here.", who: "remi", at: "tracks" },
        { fact: "ing-relay" },
        { recording: "ingenuity-hum", name: "Ingenuity's blades, heard from the rover", caption: "(a low hum of spinning blades, far away)", fact: "rec-ingenuity-hum" },
      ],
    },
    {
      id: "ing-letter-heli",
      to: "ingenuity",
      address: "To the little helicopter",
      prompt: "Give the letter to the little helicopter",
      where: "Ingenuity stands among the sand ripples on the hill.",
      letter: "Nobody knew if you could fly. You tried anyway. Then you kept trying, again and again.",
      beat: [
        { say: "It's so small. And it really flew on Mars!", who: "remi", at: "ingenuity" },
        { fact: "ing-plan" },
        { fact: "ing-72" },
      ],
    },
  ],
  activity: "thin-air",
  activityStart: [
    { say: "Dad built a rotor bench. Can blades lift in air this thin?", who: "remi" },
    { fact: "mars-thin-air" },
    { note: "Try Earth air first. Then try Mars air." },
  ],
  activityDone: [
    { say: "Oh no. It can't fly anymore.", who: "remi" },
    { fact: "ing-final" },
    { say: "But it still wakes up and keeps notes.", who: "remi" },
    { fact: "ing-testbed" },
  ],
  milo: 4,
  miloPart: "rotor",
  partPrompt: "Give Milo his rotor",
  partFitted: [
    { say: "A rotor, like Ingenuity's! Can you hop, Milo?", who: "remi" },
    { say: "Wait. There's a scrap of paper tucked inside Milo.", who: "remi" },
    { say: "It's my first drawing. A plane! Dad kept it.", who: "remi" },
    { note: "I tucked a little piece of you in here. Every good flying machine carries one." },
  ],
  memory: [
    { say: "Dad and I made paper planes and threw them off the hill.", who: "remi" },
    { say: "Mine always crashed. Dad said, \"Fold it again. Try one more time.\"", who: "remi" },
    { note: "Most first flights are short. That is how all flying starts." },
  ],
  stamp: ["Left behind.", "Still keeping notes."],
  goals: {
    arrive: "Look around Valinor Hills",
    letters: "Deliver Dad's three letters",
    activity: "Fly in thin air",
    home: "Go back to the workshop",
  },
};
