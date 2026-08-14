-- সহকারী এডমিন (assistant) রোল হটফিক্স
-- ইতিমধ্যে সুপাবেসে সেটআপ করা প্রজেক্টে এই ফাইলটি একবার SQL Editor-এ রান করুন,
-- যাতে "সহকারী এডমিন" রোলধারীরাও নিজ নিজ শাখার জনবল/মালামাল/কার্যক্রম ডেটাবেসে
-- লিখতে (যোগ/সম্পাদনা/মুছে ফেলা) পারেন। এতদিন can_write_dept() ও can_write_worker()
-- ফাংশন দুটো শুধু 'admin' রোল চিনতো, 'assistant' রোলকে না — এই হটফিক্স সেটা ঠিক করছে।

create or replace function public.can_write_dept(target_dept text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
      and (p.role = 'super' or ((p.role = 'admin' or p.role = 'assistant') and p.req_dept = target_dept))
  );
$$;

create or replace function public.can_write_worker(worker uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    join public.manpower m on m.id = worker
    where p.id = auth.uid()
      and p.status = 'approved'
      and (p.role = 'super' or ((p.role = 'admin' or p.role = 'assistant') and p.req_dept = m.dept))
  );
$$;

notify pgrst, 'reload schema';
