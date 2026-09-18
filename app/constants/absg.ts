// Wayform — ABSG plan content: the current week's Sabbath School Adult Bible
// Study Guide section, authored by the platform team per SDA doctrine.
//
// This is a placeholder single week (7 sections, Sabbath afternoon through
// Friday) standing in for a real ABSG content feed. Swap dailyAbsgSections
// for an ingested-per-quarter source before launch; the pair-facing shape
// (AbsgSection) should stay the same so app/constants/plan.ts keeps working.

export interface AbsgSection {
  /** Section number within the week, 1-based (Sabbath afternoon = 1). */
  day: number;
  /** Section label, e.g. "Sabbath Afternoon" or "Monday". */
  label: string;
  lessonTitle: string;
  reference: string;
  text: string;
  translation: string;
  audioUrl: string;
  identityReframe: string;
  microPractice: string;
}

const esvAudio = (osisRange: string) => `https://audio.esv.org/hw/${osisRange}.mp3`;

export const ABSG_LESSON_TITLE = "Rest for the Soul";

export const absgSections: AbsgSection[] = [
  {
    day: 1,
    label: "Sabbath Afternoon",
    lessonTitle: ABSG_LESSON_TITLE,
    reference: "Matthew 11:28-30",
    text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest. Take my yoke upon you, and learn of me; for I am meek and lowly in heart: and ye shall find rest unto your souls. For my yoke is easy, and my burden is light.",
    translation: "King James Version (Public Domain)",
    audioUrl: esvAudio("40011028-40011030"),
    identityReframe:
      "Rest is not something I earn by finishing everything — it is something Christ offers before I do.",
    microPractice:
      "Together, read this week's lesson title aloud and each name one thing you're carrying that you'd like to set down this week.",
  },
  {
    day: 2,
    label: "Sunday",
    lessonTitle: ABSG_LESSON_TITLE,
    reference: "Genesis 2:1-3",
    text: "Thus the heavens and the earth were finished, and all the host of them. And on the seventh day God ended his work which he had made; and he rested on the seventh day from all his work which he had made. And God blessed the seventh day, and sanctified it: because that in it he had rested from all his work which he had made.",
    translation: "King James Version (Public Domain)",
    audioUrl: esvAudio("01002001-01002003"),
    identityReframe:
      "Rest was built into creation before sin entered it — it is a gift, not a reward.",
    microPractice:
      "Each of you name one weekly rhythm (work, school, phone use) that crowds out rest, without judgment.",
  },
  {
    day: 3,
    label: "Monday",
    lessonTitle: ABSG_LESSON_TITLE,
    reference: "Exodus 20:8-11",
    text: "Remember the sabbath day, to keep it holy. Six days shalt thou labour, and do all thy work: but the seventh day is the sabbath of the Lord thy God: in it thou shalt not do any work, thou, nor thy son, nor thy daughter, thy manservant, nor thy maidservant, nor thy cattle, nor thy stranger that is within thy gates.",
    translation: "King James Version (Public Domain)",
    audioUrl: esvAudio("02020008-02020011"),
    identityReframe: "Keeping the Sabbath is remembering, not just resting — it points back to who made me.",
    microPractice: "Plan one concrete way you'll keep this Sabbath together this week.",
  },
  {
    day: 4,
    label: "Tuesday",
    lessonTitle: ABSG_LESSON_TITLE,
    reference: "Isaiah 58:13-14",
    text: "If thou turn away thy foot from the sabbath, from doing thy pleasure on my holy day; and call the sabbath a delight, the holy of the LORD, honourable; and shalt honour him, not doing thine own ways, nor finding thine own pleasure, nor speaking thine own words: Then shalt thou delight thyself in the LORD.",
    translation: "King James Version (Public Domain)",
    audioUrl: esvAudio("23058013-23058014"),
    identityReframe: "The Sabbath is meant to be a delight, not a restriction I merely tolerate.",
    microPractice: "Share with your partner one thing that makes rest feel like delight rather than duty for you.",
  },
  {
    day: 5,
    label: "Wednesday",
    lessonTitle: ABSG_LESSON_TITLE,
    reference: "Hebrews 4:9-11",
    text: "There remaineth therefore a rest to the people of God. For he that is entered into his rest, he also hath ceased from his own works, as God did from his. Let us labour therefore to enter into that rest, lest any man fall after the same example of unbelief.",
    translation: "King James Version (Public Domain)",
    audioUrl: esvAudio("58004009-58004011"),
    identityReframe: "There is a rest still ahead of me — Sabbath now is a weekly rehearsal of it.",
    microPractice: "Pray together for two minutes, thanking God for rest that is still to come.",
  },
  {
    day: 6,
    label: "Thursday",
    lessonTitle: ABSG_LESSON_TITLE,
    reference: "Mark 2:27-28",
    text: "And he said unto them, The sabbath was made for man, and not man for the sabbath: Therefore the Son of man is Lord also of the sabbath.",
    translation: "King James Version (Public Domain)",
    audioUrl: esvAudio("41002027-41002028"),
    identityReframe: "The Sabbath serves me — I don't serve a rule.",
    microPractice: "Talk about one Sabbath practice from childhood or church that felt burdensome, and one that felt like a gift.",
  },
  {
    day: 7,
    label: "Friday",
    lessonTitle: ABSG_LESSON_TITLE,
    reference: "Psalm 23:1-3",
    text: "The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake.",
    translation: "King James Version (Public Domain)",
    audioUrl: esvAudio("19023001-19023003"),
    identityReframe: "Rest restores my soul, not just my schedule.",
    microPractice: "Before this week's cohort session, agree on one sentence you'll both share about what you learned this week.",
  },
];

export function getAbsgSection(day: number): AbsgSection | undefined {
  return absgSections.find((s) => s.day === day);
}
