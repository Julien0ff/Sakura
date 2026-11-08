'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Group } from '@/components/settings/grouped-list';
import { ChevronRight, Crown } from '@/components/ui/icons';
import { useAuth } from '@/core/auth';
import { supabase } from '@/lib/supabase';

/** Entry to /admin, shown only to admins (the server checks again on every action). */
export function AdminGroup() {
  const { user } = useAuth();
  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin', user?.id],
    enabled: !!user && !!supabase,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc('is_admin');
      if (error) throw error;
      return data;
    },
  });
  if (!isAdmin) return null;
  return (
    <Group title="Administration">
      <Link href="/admin" className="flex items-center gap-3 px-4 py-3 min-h-[56px] hover:bg-white/[0.04] transition-colors">
        <Crown className="w-5 h-5 text-[#FFD60A] shrink-0" />
        <span className="flex-1 text-[16px] text-white">Panel admin</span>
        <ChevronRight className="w-4 h-4 text-white/40" />
      </Link>
    </Group>
  );
}
