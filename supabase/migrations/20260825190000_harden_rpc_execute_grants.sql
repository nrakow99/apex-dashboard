-- Supabase may grant function execution to API roles through project-level
-- default privileges. Authentication checks already fail closed inside these
-- functions, but anonymous callers should not reach the function body at all.

revoke execute on function public.import_screenshot_trade_rows(
  uuid, text, text[], date, date, jsonb, jsonb
) from anon;

revoke execute on function public.reserve_screenshot_scan(integer) from anon;
revoke execute on function public.finish_screenshot_scan(uuid, text, integer) from anon;

grant execute on function public.import_screenshot_trade_rows(
  uuid, text, text[], date, date, jsonb, jsonb
) to authenticated;

grant execute on function public.reserve_screenshot_scan(integer) to authenticated;
grant execute on function public.finish_screenshot_scan(uuid, text, integer) to authenticated;
