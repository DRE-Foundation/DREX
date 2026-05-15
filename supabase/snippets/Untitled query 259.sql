SELECT 
  SUM(amount) AS total_operacional
FROM public.transactions
WHERE user_id = '357bd83b-0e13-4d85-9463-eb24e8bc9157'
  AND category = 'Operacional'
  AND type = 'expense';