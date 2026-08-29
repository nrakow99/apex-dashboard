alter table public.user_settings
  add column if not exists onboarding_activated boolean not null default false,
  add column if not exists onboarding_goal text,
  add column if not exists onboarding_history_choice text;

alter table public.user_settings
  drop constraint if exists user_settings_onboarding_goal_check,
  add constraint user_settings_onboarding_goal_check check (
    onboarding_goal is null or onboarding_goal in (
      'protect-funded', 'reach-payout', 'manage-multiple', 'pass-eval'
    )
  ),
  drop constraint if exists user_settings_onboarding_history_choice_check,
  add constraint user_settings_onboarding_history_choice_check check (
    onboarding_history_choice is null or onboarding_history_choice in (
      'csv', 'screenshot', 'start-now'
    )
  );
