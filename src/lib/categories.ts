export const DEFAULT_CATEGORIES = [
  'Fornecedores',
  'Operacional',
  'Marketing',
  'Impostos',
  'Pessoal',
  'Retirada PF',
  'Outros',
];
 
export async function getAllCategories(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('categories')
    .select('name')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
 
  const custom = (data || []).map((c: { name: string }) => c.name);
  const merged = [
    ...DEFAULT_CATEGORIES,
    ...custom.filter((c: string) => !DEFAULT_CATEGORIES.includes(c)),
  ];
  return merged;
}
 
export async function createCategory(
  supabase: any,
  userId: string,
  name: string
): Promise<void> {
  await supabase.from('categories').insert({ user_id: userId, name: name.trim() });
}
