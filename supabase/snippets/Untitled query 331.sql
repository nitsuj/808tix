select current_database(), current_user, inet_server_addr(), inet_server_port();

select count(*) as auth_user_count from auth.users;

select id, email, created_at
from auth.users
order by created_at desc;

select count(*) as profile_count from public.profiles;

select id, email, created_at
from public.profiles
order by created_at desc;