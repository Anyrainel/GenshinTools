import type { KnowledgeRecord } from "./schemas";

export type TeamMemberInvestment = Extract<
  KnowledgeRecord,
  { kind: "team" }
>["members"][number]["investment"];

export type ConcreteTeamMemberInvestment = {
  constellation: number;
  talentLevels?: {
    auto: number;
    skill: number;
    burst: number;
  };
};

export function cloneTeamMemberInvestment(
  investment: TeamMemberInvestment,
): TeamMemberInvestment {
  if (investment.status === "unspecified") return { status: "unspecified" };
  if (investment.status === "partial") {
    return {
      status: "partial",
      ...(investment.constellation == null
        ? {}
        : { constellation: investment.constellation }),
      ...(investment.minConstellation == null
        ? {}
        : { minConstellation: investment.minConstellation }),
      ...(investment.maxConstellation == null
        ? {}
        : { maxConstellation: investment.maxConstellation }),
      ...(investment.talentLevels == null
        ? {}
        : { talentLevels: [...investment.talentLevels] }),
    };
  }
  return {
    status: "specified",
    constellation: investment.constellation,
    talentLevels: [...investment.talentLevels],
  };
}

export function investmentAllowsConstellation(
  investment: TeamMemberInvestment,
  constellation: number,
): boolean {
  if (investment.status === "unspecified") return true;
  if (
    investment.constellation != null &&
    investment.constellation !== constellation
  ) {
    return false;
  }
  if (
    investment.status === "partial" &&
    investment.minConstellation != null &&
    constellation < investment.minConstellation
  ) {
    return false;
  }
  if (
    investment.status === "partial" &&
    investment.maxConstellation != null &&
    constellation > investment.maxConstellation
  ) {
    return false;
  }
  return true;
}

export function investmentMatchesConcreteAssumption(
  investment: TeamMemberInvestment,
  assumption: ConcreteTeamMemberInvestment,
): boolean {
  if (!investmentAllowsConstellation(investment, assumption.constellation)) {
    return false;
  }
  if (investment.status === "unspecified" || investment.talentLevels == null) {
    return true;
  }
  if (assumption.talentLevels == null) return false;
  const [auto, skill, burst] = investment.talentLevels;
  return (
    auto === assumption.talentLevels.auto &&
    skill === assumption.talentLevels.skill &&
    burst === assumption.talentLevels.burst
  );
}
