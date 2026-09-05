create or replace function public.cycle_reference_date_v1(
  p_investment_day_at timestamptz,
  p_timezone text
)
returns date
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_timezone text;
  v_date date;
begin
  if p_investment_day_at is null then
    return null;
  end if;

  v_timezone := case
    when p_timezone is null or pg_catalog.btrim(p_timezone) = '' then 'Europe/Oslo'
    else pg_catalog.btrim(p_timezone)
  end;

  begin
    v_date := (p_investment_day_at at time zone v_timezone)::date;
  exception
    when others then
      v_date := (p_investment_day_at at time zone 'Europe/Oslo')::date;
  end;

  return v_date;
end;
$function$;
