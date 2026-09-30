export interface CreateRoleRequest {
  name: string;
  description: string;
  /** One core_competency blueprint slot per entry, in the order given —
   * see roleService.createRole for how this becomes the full blueprint.
   * Each name should match a `competency` value that already exists on
   * some of this recruiter's own questions (see packages/db/src/seed.ts's
   * header comment on how blueprint slots map to Question.competency) —
   * otherwise question selection has nothing to pick for that slot when an
   * interview using this role is scheduled. */
  competencies: string[];
}
