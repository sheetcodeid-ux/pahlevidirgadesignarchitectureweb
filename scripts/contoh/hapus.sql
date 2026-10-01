-- Membuang SELURUH data contoh (ID berawalan c0de000) dan mengembalikan nilai
-- proyek yang diubah ke aslinya. Aman dijalankan berulang.
delete from public.project_payments where id::text like 'c0de000%';
delete from public.invoices where id::text like 'c0de000%';
delete from public.project_costs where id::text like 'c0de000%';
delete from public.payroll where id::text like 'c0de000%';
delete from public.project_tasks where id::text like 'c0de000%';
delete from public.inquiries where id::text like 'c0de000%';
delete from public.directory_contacts where id::text like 'c0de000%';
delete from public.team_members where id::text like 'c0de000%';
update public.projects set contract_value = null, pipeline_stage = 'proposal' where id = 'dc6375e1-94d7-4be2-9f5e-d967b6c09f14';
update public.projects set contract_value = null, pipeline_stage = 'proposal' where id = 'edb56d6a-ba39-44c1-868c-3bd543ff3daf';
update public.projects set contract_value = null, pipeline_stage = 'proposal' where id = '411d2fdb-5207-4a2b-8eb8-0e1573042781';
update public.projects set contract_value = null, pipeline_stage = 'dp_50' where id = 'bed32d7b-cd0f-44f4-8737-57d4f4d9bc17';
update public.projects set contract_value = null, pipeline_stage = 'desain_2' where id = '028ceac7-03fd-4496-817a-30d336f5f4b5';
