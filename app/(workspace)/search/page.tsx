import { SearchResults } from '@/components/search-results';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string | string[] }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const tagsParam = sp.tag;
  const tags: string[] = Array.isArray(tagsParam) ? tagsParam : tagsParam ? [tagsParam] : [];
  return <SearchResults initialQuery={q} initialTags={tags} />;
}
