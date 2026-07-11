-- আল-ডেট কলাম হটফিক্স: "alDate" ও al_date দুইটাই থাকলে এক করে ফেলা হচ্ছে
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='manpower' and column_name='alDate')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='manpower' and column_name='al_date') then
    -- দুইটা কলামই আছে — "alDate"-এ থাকা যেকোনো ডেটা al_date-এ কপি করে, তারপর "alDate" ফেলে দেওয়া হচ্ছে
    execute 'update public.manpower set al_date = coalesce(al_date, "alDate")';
    execute 'alter table public.manpower drop column "alDate"';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='manpower' and column_name='alDate') then
    execute 'alter table public.manpower rename column "alDate" to al_date';
  end if;
end $$;

notify pgrst, 'reload schema';

-- যাচাই: এখন al_date (snake_case, unquoted) একটাই কলাম থাকা উচিত
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='manpower'
order by ordinal_position;
