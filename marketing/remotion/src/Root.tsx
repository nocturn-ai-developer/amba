import React from "react";
import { Composition } from "remotion";
import { DURATION, Demo } from "./Demo";
import { PROMO_DURATION, Promo } from "./Promo";
import { TOPUP_DURATION, Topup } from "./Topup";
import { SKILLS_DURATION, SkillsGuide } from "./Skills";
import { BATTLE_DURATION, BattleVote } from "./Battle";
import { PASS_DURATION, PassTeaser } from "./Pass";
import { INTRO_DURATION, StardoomIntro } from "./stardoom/Intro";
import { WEB_DEMO_DURATION, StardoomWebDemo } from "./stardoom/WebDemo";
import { APP_DEMO_DURATION, StardoomAppDemo } from "./stardoom/AppDemo";
import { PostIntroducing, PostToken, XBanner, XProfile } from "./stardoom/Stills";

export function RemotionRoot() {
  return (
    <>
      <Composition id="AestrodomDemo" component={Demo} durationInFrames={DURATION} fps={30} width={1920} height={1080} />
      <Composition id="AestrodomTopup" component={Topup} durationInFrames={TOPUP_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="AestrodomSkills" component={SkillsGuide} durationInFrames={SKILLS_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="AestrodomBattle" component={BattleVote} durationInFrames={BATTLE_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="AestrodomPass" component={PassTeaser} durationInFrames={PASS_DURATION} fps={30} width={1080} height={1080} />
      {/* Stardoom AI launch kit for X */}
      <Composition id="StardoomIntro" component={StardoomIntro} durationInFrames={INTRO_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="StardoomWebDemo" component={StardoomWebDemo} durationInFrames={WEB_DEMO_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="StardoomAppDemo" component={StardoomAppDemo} durationInFrames={APP_DEMO_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="XProfile" component={XProfile} durationInFrames={1} fps={30} width={1000} height={1000} />
      <Composition id="XBanner" component={XBanner} durationInFrames={1} fps={30} width={1500} height={500} />
      <Composition id="PostIntroducing" component={PostIntroducing} durationInFrames={1} fps={30} width={1600} height={900} />
      <Composition id="PostToken" component={PostToken} durationInFrames={1} fps={30} width={1600} height={900} />
      <Composition id="AestrodomPromo" component={Promo} durationInFrames={PROMO_DURATION} fps={30} width={1080} height={1080} />
    </>
  );
}
