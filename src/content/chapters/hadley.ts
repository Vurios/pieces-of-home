import type { ChapterDef } from "./types";

/**
 * Chapter 2: Hadley-Apennine (Game Bible 6, P1). Dad's model of the Apollo 15
 * site: the lander Falcon's bottom half, the Moon buggy parked beside it,
 * the long winding valley called Hadley Rille, and Mount Hadley behind. The
 * idea to play with: wheels made for dust, and steering from the back.
 */
export const HADLEY: ChapterDef = {
  id: "chapter-2",
  world: "hadley",
  spread: "lrv",
  dome: "Hadley-Apennine",
  title: "Chapter 2: Hadley-Apennine",
  place: "Hadley-Apennine",
  arrival: [
    { wait: 0.6 },
    { say: "Mountains! And a giant crack in the ground.", who: "remi" },
    { fact: "a15-site" },
    { say: "And Dad built a car for the Moon. A Moon buggy!", who: "remi" },
    { note: "Model, not to scale. The rille is a lot bigger in real life." },
  ],
  tag: { title: "Hadley-Apennine", lines: ["Model, not to scale.", "Real numbers on the back."] },
  letters: [
    {
      id: "a15-letter-wheels",
      to: "wheels",
      address: "To the woven wheels",
      prompt: "Give the letter to the woven wheels",
      where: "The Moon buggy is parked by the lander. Look at its wheels.",
      letter: "You were woven from wire, like a basket, and you still rolled all over the Moon. Different can be just right.",
      beat: [
        { say: "These wheels are like baskets made of wire!", who: "remi", at: "wheels" },
        { fact: "lrv-wheels" },
      ],
    },
    {
      id: "a15-letter-seats",
      to: "seats",
      address: "To the two seats",
      prompt: "Give the letter to the two seats",
      where: "The two folding seats in the middle of the Moon buggy.",
      letter: "Two friends sat in you side by side. You took them farther than they could ever walk.",
      beat: [
        { say: "Two seats. Two astronauts, side by side.", who: "remi", at: "seats" },
        { fact: "lrv-crew" },
        { fact: "a15-lrv-distance" },
      ],
    },
    {
      id: "a15-letter-tracks",
      to: "tracks",
      address: "To the tracks",
      prompt: "Give the letter to the tracks",
      where: "Follow the wheel tracks away from the buggy, toward the rille.",
      letter: "Everywhere you went, you left a line behind. People can still follow it.",
      beat: [
        { say: "The tracks go all the way to the rille.", who: "remi", at: "tracks" },
        { fact: "lrv-tracks-orbit" },
        { say: "Dad taped a photo of the real tracks to his tag!", who: "remi" },
      ],
    },
  ],
  activity: "steer-from-the-back",
  activityStart: [
    { say: "Can we drive it? Dad left a wheel test first.", who: "remi" },
    { note: "Try all three wheels. Which one grips the dust?" },
  ],
  activityDone: [
    { say: "Parked, right in the lines. Just like the crew left it.", who: "remi" },
    { say: "Steering from the back was tricky. But we did it.", who: "remi" },
  ],
  milo: 2,
  miloPart: "mesh wheels",
  partPrompt: "Give Milo his mesh wheels",
  partFitted: [
    { say: "Mesh wheels, like the Moon buggy's.", who: "remi" },
    { say: "Milo! You can roll now. Come on!", who: "remi" },
  ],
  memory: [
    { say: "When I learned to ride my bike, Dad ran behind me holding the seat.", who: "remi" },
    { say: "I didn't even know when he let go. I just kept going.", who: "remi" },
    { note: "You don't always steer from the front. Sometimes someone steadies you from behind." },
  ],
  stamp: ["Left behind.", "Still showing the way."],
  goals: {
    arrive: "Look around Hadley-Apennine",
    letters: "Deliver Dad's three letters",
    activity: "Drive the Moon buggy",
    home: "Go back to the workshop",
  },
};
