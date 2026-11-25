import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Enums } from '@healthoraa/types';
import { PROGRAM_CATEGORY_VALUES } from '@healthoraa/validation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';

export type ProgramCategory = Enums<'program_category'>;

export const HOME_CATEGORIES: readonly { value: ProgramCategory; label: string; blurb: string }[] = [
  { value: 'weight_management', label: 'Weight Management', blurb: 'Explore available programmes and review each plan before enrolling.' },
  { value: 'pcod_pcos', label: 'PCOD / PCOS Management', blurb: 'Review programme details and practitioner support before enrolling.' },
  { value: 'dermato_nutrition', label: 'Dermato-Nutrition', blurb: 'Explore available programmes and their included support.' },
  { value: 'custom', label: 'Personalized Nutrition', blurb: 'Review example programme outlines before deciding.' },
];

// The category list above must cover every category the database defines.
const coveredCategories = new Set(HOME_CATEGORIES.map((category) => category.value));
if (PROGRAM_CATEGORY_VALUES.some((value) => !coveredCategories.has(value))) {
  throw new Error('HOME_CATEGORIES does not cover every program category');
}

export const useBanners = () =>
  useQuery({
    queryKey: ['banners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_banners')
        .select('id, title, image_url, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const useActiveEnrolment = () => {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`active-enrolment:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'program_enrolments',
        filter: `patient_id=eq.${userId}`,
      }, () => {
        void queryClient.invalidateQueries({ queryKey: ['enrolment', userId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
  return useQuery({
    queryKey: ['enrolment', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('program_enrolments')
        .select('id, started_at, expires_at, programs(title, duration_days)')
        .eq('patient_id', userId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('started_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
};

export const useProgramCounts = () =>
  useQuery({
    queryKey: ['programs', 'counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('programs').select('category').eq('is_active', true);
      if (error) throw new Error(error.message);
      const counts: Partial<Record<ProgramCategory, number>> = {};
      for (const row of data) counts[row.category] = (counts[row.category] ?? 0) + 1;
      return counts;
    },
  });

export const useCategoryPrograms = (category: ProgramCategory | null) =>
  useQuery({
    queryKey: ['programs', category],
    enabled: category !== null,
    queryFn: async () => {
      if (!category) throw new Error('No category selected');
      const { data, error } = await supabase
        .from('programs')
        .select('id, title, description, duration_days')
        .eq('is_active', true)
        .eq('category', category)
        .order('title', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    },
  });
