select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;