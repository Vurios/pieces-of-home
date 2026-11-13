import type { ChapterDef } from "./types";

/**
 * Bonus chapter: Ocean of Storms (Game Bible 6, P2). Dad's model of the
 * Apollo 12 site, where people landed right next to a robot that had been
 * waiting there since 1967. The idea to play with: going back to look again.
 * The astronauts found Surveyor 3 by a pattern of craters, took some of its
 * parts home, and scientists studied what the Moon had done to them.
 *
 * The bonus chapter is never needed for the Finale. It opens once Chapter 3
 * is stamped, and Milo's scoop arm sits between his solar heart and his rotor
 * (Game Bible 5.6), so it does not change his stage number.
 */
export const STORMS: ChapterDef = {
  id: "bonus-surveyor",
  world: "storms",
  spread: "surveyor",
  dome: "Ocean of Storms",
  title: "Bonus: Ocean of Storms",
  place: "Ocean of Storms",
  bonus: true,
  arrival: [
    { wait: 0.6 },
    { say: "Another Moon world! And there are two machines here.", who: "remi" },
    { fact: "a12-site" },
    { say: "One got here first and waited. The other one came to visit it.", who: "remi" },
    { note: "Model, not to scale. The real numbers are on the back of my tag." },
  ],
  tag: { title: "Ocean of Storms", lines: ["Model, not to scale.", "Real numbers on the back."] },
  letters: [
    {
      id: "sur3-letter-trenches",
      to: "trenches",
      address: "To the little trenches",
      prompt: "Give the letter to the little trenches",
      where: "Down in the crater, in front of Surveyor 3. Four little ditches in the dust.",
      letter: "A robot dug you while people steered it from home. You told everyone the ground was safe to stand on.",
      beat: [
        { say: "Little ditches! Surveyor dug them with its scoop.", who: "remi", at: "trenches" },
        { fact: "sur3-scoop" },
        { fact: "sur3-wet-sand" },
        { say: "Like wet sand at the beach. Good for landing on!", who: "remi" },
      ],
    },
    {
      id: "a12-letter-intrepid",
      to: "intrepid",
      address: "To Intrepid's bottom half",
      prompt: "Give the letter to Intrepid",
      where: "The gold lander up on the edge of the crater.",
      letter: "You landed right where you planned, next to an old friend. That takes a very steady hand.",
      beat: [
        { say: "This lander came here on purpose. To visit Surveyor!", who: "remi", at: "intrepid" },
        { fact: "a12-pinpoint" },
        { say: "They aimed right for it. Like throwing a dart at the Moon!", who: "remi" },
      ],
    },
    {
      id: "sur3-letter-surveyor",
      to: "surveyor",
      address: "To Surveyor 3",
      prompt: "Give the letter to Surveyor 3",
      where: "On the slope inside the big crater. A tall robot on three legs.",
      letter: "You waited a long time in the quiet. Then two friends walked down the hill to say hello.",
      beat: [
        { say: "Surveyor 3. It waited here all by itself.", who: "remi", at: "surveyor" },
        { fact: "sur3-visit" },
        { fact: "a12-brown" },
        { say: "Brown, not white. Dusty, like the top shelf at home.", who: "remi" },
        { fact: "a12-fresh" },
      ],
    },
  ],
  activity: "pinpoint",
  activityStart: [
    { say: "Dad made a landing table with a toy lander on it!", who: "remi" },
    { note: "First find the Snowman. Then aim for its tummy." },
  ],
  activityDone: [
    { say: "The parts are packed. Now they can go home and be studied.", who: "remi" },
    { fact: "sur3-camera-museum" },
    { say: "And Surveyor is still right here.", who: "remi" },
    { fact: "sur3-still-there" },
  ],
  milo: 0,
  miloPart: "scoop arm",
  partPrompt: "Give Milo his scoop arm",
  partFitted: [
    { say: "A scoop arm, just like Surveyor's!", who: "remi" },
    { say: "Can you pick things up, Milo? Ha! He gave me a bolt.", who: "remi" },
  ],
  memory: [
    { say: "Dad and I planted beans by the shed. He let me dig the holes.", who: "remi" },
    { say: "Every few days we dug one up a little, just to look. Was it growing?", who: "remi" },
    { note: "Sometimes the best way to learn is to go back and look again." },
  ],
  stamp: ["Left behind.", "Then visited by friends."],
  goals: {
    arrive: "Look around the Ocean of Storms",
    letters: "Deliver Dad's three letters",
    activity: "Visit Surveyor 3, like Apollo 12 did",
    home: "Go back to the workshop",
  },
};
