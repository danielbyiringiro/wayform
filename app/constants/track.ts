// Wayform — Track 1: Identity (14-day formation track)
//
// Content authored by the platform team, grounded in SDA doctrine and held
// within interdenominational, biblical guidelines. Scripture text is the
// King James Version (Public Domain). Scripture audio is the ESV "Hear the
// Word" reading, streamed from audio.esv.org (© Crossway).

export interface ScriptureAnchor {
  /** Human-readable passage reference, e.g. "Romans 10:8-13". */
  reference: string;
  /** Passage text (King James Version, Public Domain). */
  text: string;
  translation: string;
  /** Streamable MP3 of the passage (ESV "Hear the Word"). */
  audioUrl: string;
}

export interface DailyLoop {
  /** Day number within the track, 1-based. */
  day: number;
  /** Theme grouping for the day. */
  theme: string;
  scripture: ScriptureAnchor;
  /** A single, focused identity statement. */
  identityReframe: string;
  /** A clear, behavioral action to complete within 24 hours. */
  microPractice: string;
}

export const TRACK_ID = "identity-14";
export const TRACK_TITLE = "Track 1 — Identity";
export const TRACK_LENGTH = 14;

const esvAudio = (osisRange: string) =>
  `https://audio.esv.org/hw/${osisRange}.mp3`;

export const dailyLoops: DailyLoop[] = [
  {
    day: 1,
    theme: "Allegiance",
    scripture: {
      reference: "Romans 10:8-13",
      text: "But what saith it? The word is nigh thee, even in thy mouth, and in thy heart: that is, the word of faith, which we preach; that if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved. For with the heart man believeth unto righteousness; and with the mouth confession is made unto salvation. For the scripture saith, Whosoever believeth on him shall not be ashamed. For there is no difference between the Jew and the Greek: for the same Lord over all is rich unto all that call upon him. For whosoever shall call upon the name of the Lord shall be saved.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("45010008-45010013"),
    },
    identityReframe:
      "Because Jesus is Lord, my life is no longer mine to prove — it is His to direct.",
    microPractice:
      "Alone today, say aloud once: “Jesus, you are Lord of my life.” Then name one decision you will hand to Him this week.",
  },
  {
    day: 2,
    theme: "Allegiance",
    scripture: {
      reference: "Matthew 6:31-34",
      text: "Therefore take no thought, saying, What shall we eat? or, What shall we drink? or, Wherewithal shall we be clothed? (For after all these things do the Gentiles seek:) for your heavenly Father knoweth that ye have need of all these things. But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you. Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself. Sufficient unto the day is the evil thereof.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("40006031-40006034"),
    },
    identityReframe:
      "The kingdom reframes my anxiety: my Father already knows what I need.",
    microPractice:
      "Before your first task today, pray out loud for 2 minutes — name one worry, then ask to seek God's kingdom first.",
  },
  {
    day: 3,
    theme: "Sonship",
    scripture: {
      reference: "John 1:10-13",
      text: "He was in the world, and the world was made by him, and the world knew him not. He came unto his own, and his own received him not. But as many as received him, to them gave he power to become the sons of God, even to them that believe on his name: which were born, not of blood, nor of the will of the flesh, nor of the will of man, but of God.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("43001010-43001013"),
    },
    identityReframe:
      "I am not defined by being overlooked — I am received by God and given the right to be His child.",
    microPractice:
      "Write one sentence finishing: “Because God receives me, I can stop earning ___.”",
  },
  {
    day: 4,
    theme: "Sonship",
    scripture: {
      reference: "Romans 8:14-17",
      text: "For as many as are led by the Spirit of God, they are the sons of God. For ye have not received the spirit of bondage again to fear; but ye have received the Spirit of adoption, whereby we cry, Abba, Father. The Spirit itself beareth witness with our spirit, that we are the children of God: and if children, then heirs; heirs of God, and joint-heirs with Christ; if so be that we suffer with him, that we may be also glorified together.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("45008014-45008017"),
    },
    identityReframe:
      "I have not received a spirit of fear, but the Spirit of adoption — I can call God “Father.”",
    microPractice:
      "When fear surfaces today, pause and say once: “Abba, Father.” Note afterward when it happened.",
  },
  {
    day: 5,
    theme: "Sonship",
    scripture: {
      reference: "Galatians 4:4-7",
      text: "But when the fulness of the time was come, God sent forth his Son, made of a woman, made under the law, to redeem them that were under the law, that we might receive the adoption of sons. And because ye are sons, God hath sent forth the Spirit of his Son into your hearts, crying, Abba, Father. Wherefore thou art no more a servant, but a son; and if a son, then an heir of God through Christ.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("48004004-48004007"),
    },
    identityReframe:
      "I am no longer a servant working for approval, but a son and an heir.",
    microPractice:
      "Identify one task you do to earn approval. Do it today as a gift, not a payment.",
  },
  {
    day: 6,
    theme: "Belonging",
    scripture: {
      reference: "Ephesians 1:3-8",
      text: "Blessed be the God and Father of our Lord Jesus Christ, who hath blessed us with all spiritual blessings in heavenly places in Christ: according as he hath chosen us in him before the foundation of the world, that we should be holy and without blame before him in love: having predestinated us unto the adoption of children by Jesus Christ to himself, according to the good pleasure of his will, to the praise of the glory of his grace, wherein he hath made us accepted in the beloved. In whom we have redemption through his blood, the forgiveness of sins, according to the riches of his grace; wherein he hath abounded toward us in all wisdom and prudence;",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("49001003-49001008"),
    },
    identityReframe:
      "I was chosen in Christ before the foundation of the world — my belonging predates my performance.",
    microPractice:
      "Tell one trusted person one thing you are grateful God has given you, not earned.",
  },
  {
    day: 7,
    theme: "Belonging",
    scripture: {
      reference: "2 Corinthians 5:16-19",
      text: "Wherefore henceforth know we no man after the flesh: yea, though we have known Christ after the flesh, yet now henceforth know we him no more. Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new. And all things are of God, who hath reconciled us to himself by Jesus Christ, and hath given to us the ministry of reconciliation; to wit, that God was in Christ, reconciling the world unto himself, not imputing their trespasses unto them; and hath committed unto us the word of reconciliation.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("47005016-47005019"),
    },
    identityReframe:
      "In Christ I am a new creation; the old definitions of me have passed away.",
    microPractice:
      "Name one old label you have carried. Write the truer thing Christ says, and read it aloud.",
  },
  {
    day: 8,
    theme: "Holiness",
    scripture: {
      reference: "1 Peter 2:9-10",
      text: "But ye are a chosen generation, a royal priesthood, an holy nation, a peculiar people; that ye should shew forth the praises of him who hath called you out of darkness into his marvellous light: which in time past were not a people, but are now the people of God: which had not obtained mercy, but now have obtained mercy.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("60002009-60002010"),
    },
    identityReframe:
      "I am part of a chosen people called out of darkness into light — my identity is both given and commissioned.",
    microPractice:
      "Send a voice note or message of encouragement to one person, pointing them to something good.",
  },
  {
    day: 9,
    theme: "Holiness",
    scripture: {
      reference: "Colossians 3:1-4",
      text: "If ye then be risen with Christ, seek those things which are above, where Christ sitteth on the right hand of God. Set your affection on things above, not on things on the earth. For ye are dead, and your life is hid with Christ in God. When Christ, who is our life, shall appear, then shall ye also appear with him in glory.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("51003001-51003004"),
    },
    identityReframe:
      "My truest life is hidden with Christ in God — not on display for approval.",
    microPractice:
      "Take 5 minutes today, offline and unseen, to pray or read Scripture. Tell no one.",
  },
  {
    day: 10,
    theme: "Holiness",
    scripture: {
      reference: "Romans 12:1-2",
      text: "I beseech you therefore, brethren, by the mercies of God, that ye present your bodies a living sacrifice, holy, acceptable unto God, which is your reasonable service. And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("45012001-45012002"),
    },
    identityReframe:
      "I am not conformed to this world's script; my mind is being renewed.",
    microPractice:
      "Name one cultural “should” you have absorbed. Write whether it reflects God's will or the world's pattern.",
  },
  {
    day: 11,
    theme: "Belonging",
    scripture: {
      reference: "1 Corinthians 12:12-14",
      text: "For as the body is one, and hath many members, and all the members of that one body, being many, are one body: so also is Christ. For by one Spirit are we all baptized into one body, whether we be Jews or Gentiles, whether we be bond or free; and have been all made to drink into one Spirit. For the body is not one member, but many.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("46012012-46012014"),
    },
    identityReframe:
      "I belong to one body — I am not meant to follow Jesus alone.",
    microPractice:
      "Reach out to one person in your faith community today and ask how they are really doing.",
  },
  {
    day: 12,
    theme: "Belonging",
    scripture: {
      reference: "1 John 3:1-3",
      text: "Behold, what manner of love the Father hath bestowed upon us, that we should be called the sons of God: therefore the world knoweth us not, because it knew him not. Beloved, now are we the sons of God, and it doth not yet appear what we shall be: but we know that, when he shall appear, we shall be like him; for we shall see him as he is. And every man that hath this hope in him purifieth himself, even as he is pure.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("62003001-62003003"),
    },
    identityReframe:
      "See what love the Father has given: I am called His child, now.",
    microPractice:
      "Sit for 2 minutes and let this be true: “I am beloved, now.” Note what resistance surfaces.",
  },
  {
    day: 13,
    theme: "Allegiance",
    scripture: {
      reference: "Philippians 3:7-11",
      text: "But what things were gain to me, those I counted loss for Christ. Yea doubtless, and I count all things but loss for the excellency of the knowledge of Christ Jesus my Lord: for whom I have suffered the loss of all things, and do count them but dung, that I may win Christ, and be found in him, not having mine own righteousness, which is of the law, but that which is through the faith of Christ, the righteousness which is of God by faith: that I may know him, and the power of his resurrection, and the fellowship of his sufferings, being made conformable unto his death; if by any means I might attain unto the resurrection of the dead.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("50003007-50003011"),
    },
    identityReframe:
      "The kingdom reframes ambition: knowing Christ is worth more than any gain I could chase.",
    microPractice:
      "Name one ambition you hold. Pray over it, asking God to reorder it beneath knowing Christ.",
  },
  {
    day: 14,
    theme: "Allegiance",
    scripture: {
      reference: "Matthew 28:18-20",
      text: "And Jesus came and spake unto them, saying, All power is given unto me in heaven and in earth. Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost: teaching them to observe all things whatsoever I have commanded you: and, lo, I am with you alway, even unto the end of the world. Amen.",
      translation: "King James Version (Public Domain)",
      audioUrl: esvAudio("40028018-40028020"),
    },
    identityReframe:
      "Because Jesus has all authority, I am sent — my belonging has a purpose beyond myself.",
    microPractice:
      "Initiate one spiritual conversation today, or invite one person into something you are learning.",
  },
];

export function getDailyLoop(day: number): DailyLoop | undefined {
  return dailyLoops.find((loop) => loop.day === day);
}
