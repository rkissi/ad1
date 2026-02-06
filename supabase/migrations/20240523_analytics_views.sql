-- Analytics Overview Function
create or replace function get_overview_metrics()
returns json
language plpgsql
security definer
as $$
declare
  total_campaigns int;
  active_campaigns int;
  total_publishers int;
  total_users int;
  total_revenue decimal;
  total_payouts decimal;
begin
  select count(*), count(*) filter (where status = 'active')
  into total_campaigns, active_campaigns
  from campaigns;

  select count(*) into total_publishers from publishers where status = 'active';
  select count(*) into total_users from profiles where role = 'user';

  select sum(spent) into total_revenue from campaigns;

  select sum(amount) into total_payouts from payouts where status = 'confirmed';

  return json_build_object(
    'totalCampaigns', coalesce(total_campaigns, 0),
    'activeCampaigns', coalesce(active_campaigns, 0),
    'totalPublishers', coalesce(total_publishers, 0),
    'totalUsers', coalesce(total_users, 0),
    'totalRevenue', coalesce(total_revenue, 0),
    'totalPayouts', coalesce(total_payouts, 0)
  );
end;
$$;
