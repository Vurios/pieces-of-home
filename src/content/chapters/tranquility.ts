import type { ChapterDef } from "./types";

/**
 * Chapter 1: Tranquility Base (Game Bible 6, P0). Dad's model of the
 * Apollo 11 site. The idea to play with: three mirrors in a corner send
 * light straight back where it came from.
 */
export const TRANQUILITY: ChapterDef = {
  id: "chapter-1",
  world: "tranquility",
  spread: "lrrr",
  dome: "Tranquility Base",
  title: "Chapter 1: Tranquility Base",
  place: "Tranquility Base",
  arrival: [
    { wait: 0.6 },
    { say: "Whoa. It's so still here.", who: "remi" },
    { say: "That blue dot in the black sky is Earth. Home is up there.", who: "remi" },
    { note: "Model, not to scale. The real numbers are on the back of my tag." },
  ],
  tag: { title: "Tranquility Base", lines: ["Model, not to scale.", "Real numbers on the back."] },
  letters: [
    {
      id: "a11-letter-descent",
      to: "descent",
      address: "To Eagle's bottom half",
      prompt: "Give the letter to Eagle's bottom half",
      where: "The gold lander in the middle of the base. Only its bottom half is still here.",
      letter: "You stayed behind so the top half could fly home. That is what good friends do.",
      beat: [
        { say: "So this is where the lander's legs stayed.", who: "remi", at: "descent" },
        { say: "Dad's radio has a real recording from here!", who: "remi" },
        { recording: "eagle-landed", name: "Neil Armstrong", caption: "Tranquility Base here. The Eagle has landed.", fact: "rec-apollo11-landed" },
        { fact: "a11-descent-stage" },
        { say: "It helped them leave by staying put. Huh.", who: "remi" },
      ],
    },
    {
      id: "a11-letter-seismometer",
      to: "seismometer",
      address: "To the moonquake listener",
      prompt: "Give the letter to the moonquake listener",
      where: "South of the lander. A little box with two flat wings.",
      letter: "You listened so hard. I hope the Moon told you some good stories.",
      beat: [
        { say: "It's a listening machine. For moonquakes!", who: "remi", at: "seismometer" },
        { fact: "a11-seismometer" },
        { say: "Let's make a tiny moonquake. Jump!", who: "remi" },
      ],
    },
    {
      id: "a11-letter-mirrors",
      to: "lrrr",
      address: "To the little mirrors",
      prompt: "Give the letter to the little mirrors",
      where: "Next to the moonquake listener. A square tray of tiny mirrors, tipped up toward Earth.",
      letter: "Somebody shines a light at you, and you send it right back. Every time. I love that about you.",
      beat: [
        { say: "The little mirrors. Dad's favorite.", who: "remi", at: "lrrr" },
        { fact: "a11-lrrr-placed" },
        { fact: "a11-lrrr-cubes" },
      ],
    },
  ],
  activity: "send-a-light",
  activityStart: [
    { say: "Look! A laser from Earth. Can we send it back?", who: "remi" },
    { note: "Try the flat mirror first. Then try a corner." },
  ],
  activityDone: [
    { say: "It came back! Ping... and pong.", who: "remi" },
    { fact: "light-roundtrip" },
    { fact: "lrrr-still-used" },
    { say: "Every little mirror is shining back at home.", who: "remi" },
  ],
  milo: 1,
  miloPart: "corner-cube eyes",
  partPrompt: "Give Milo his new eyes",
  partFitted: [
    { say: "Corner-cube eyes. Just like the little mirrors.", who: "remi" },
    { say: "Hi, Milo. Can you see me?", who: "remi" },
  ],
  memory: [
    { say: "Dad and I used to flash goodnight. Two blinks from my window.", who: "remi" },
    { say: "He always flashed back. Every single night.", who: "remi" },
    { note: "Send a light, get a light back. Works on the Moon. Works on your bedroom window too." },
  ],
  stamp: ["Left behind.", "Still answering."],
  goals: {
    arrive: "Look around Tranquility Base",
    letters: "Deliver Dad's three letters",
    activity: "Send the laser back to Earth",
    home: "Go back to the workshop",
  },
};
