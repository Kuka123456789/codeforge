import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas";

const SkillSource = Schema.Literals(["project", "user"]);

export const SkillEntry = Schema.Struct({
  name: TrimmedNonEmptyString,
  source: SkillSource,
  description: Schema.String,
  content: Schema.String,
});
export type SkillEntry = typeof SkillEntry.Type;

export const SkillsListInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
});
export type SkillsListInput = typeof SkillsListInput.Type;

export const SkillsListResult = Schema.Struct({
  skills: Schema.Array(SkillEntry),
});
export type SkillsListResult = typeof SkillsListResult.Type;

export const SkillsSaveInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  source: SkillSource,
  content: Schema.String,
});
export type SkillsSaveInput = typeof SkillsSaveInput.Type;

export const SkillsSaveResult = Schema.Struct({
  name: TrimmedNonEmptyString,
});
export type SkillsSaveResult = typeof SkillsSaveResult.Type;

export const SkillsDeleteInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  source: SkillSource,
});
export type SkillsDeleteInput = typeof SkillsDeleteInput.Type;

export const SkillsDeleteResult = Schema.Struct({
  name: TrimmedNonEmptyString,
});
export type SkillsDeleteResult = typeof SkillsDeleteResult.Type;
