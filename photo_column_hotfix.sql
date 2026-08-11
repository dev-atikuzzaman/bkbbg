-- জনবলের প্রোফাইল ছবি কলাম হটফিক্স: আগে থেকে তৈরি manpower টেবিলে "photo" কলাম না থাকলে যোগ করা হচ্ছে
-- (নতুন করে supabase_setup.sql চালালে এমনিতেই এই কলাম তৈরি হয়ে যাবে; আগের ডেটাবেসের জন্য এই ফাইলটি চালান)
alter table public.manpower add column if not exists photo text;

notify pgrst, 'reload schema';

-- যাচাই
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='manpower'
order by ordinal_position;
