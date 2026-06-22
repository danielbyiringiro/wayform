"use client";
import Typewriter from "typewriter-effect";

type Props = {};

export default (props: Props) => {
  return (
    <Typewriter
      options={{
        loop: true,
      }}
      onInit={(typewriter) => {
        typewriter
          .typeString("Growing in Christ")
          .pauseFor(1000)
          .deleteAll()
          .typeString("Embodied Growth")
          .start();
      }}
    />
  );
};
