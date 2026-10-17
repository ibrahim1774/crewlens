import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Empty } from '@/components/empty';
import { JobRow } from '@/components/job-row';
import { Heading, Mono } from '@/components/text';
import { Colors, Fonts, Radius, Space } from '@/constants/theme';
import { useCompany } from '@/lib/company';
import { distanceM } from '@/lib/geo';
import { pullJobs, rankJobs, useFix, useJobs } from '@/lib/jobs';
import type { Job } from '@/types/models';

type Section = { key: string; title: string; data: Job[] };

export default function Jobs() {
  const insets = useSafeAreaInsets();
  const company = useCompany();
  const jobs = useJobs();
  const fix = useFix();
  const params = useLocalSearchParams<{ archived?: string }>();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [showArchived, setShowArchived] = useState(params.archived === '1');

  useEffect(() => {
    pullJobs().catch(() => {});
  }, []);
  useEffect(() => {
    if (params.archived === '1') setShowArchived(true);
  }, [params.archived]);

  const sections = useMemo<Section[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? jobs.filter((j) => j.name.toLowerCase().includes(q) || j.address.toLowerCase().includes(q)) : jobs;
    const r = rankJobs(filtered, fix);
    const out: Section[] = [];
    if (r.nearby.length) out.push({ key: 'nearby', title: 'Nearby', data: r.nearby });
    if (r.recent.length) out.push({ key: 'recent', title: 'Recent', data: r.recent });
    if (r.all.length) out.push({ key: 'all', title: r.nearby.length || r.recent.length ? 'All' : 'Jobs', data: r.all });
    if (r.archived.length) out.push({ key: 'archived', title: `Archived · ${r.archived.length}`, data: showArchived ? r.archived : [] });
    return out;
  }, [jobs, fix, query, showArchived]);

  const hasAny = jobs.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: Space.md, paddingTop: Space.sm, paddingBottom: Space.sm, gap: Space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
          <Heading size={30} bold style={{ flex: 1 }} numberOfLines={1}>{company?.name ?? 'Jobs'}</Heading>
          <Pressable onPress={() => setSearching((s) => !s)} accessibilityRole="button" accessibilityLabel="Search" hitSlop={8}>
            <SymbolView name={searching ? 'xmark' : 'magnifyingglass'} size={22} tintColor={Colors.ink} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/job/new')}
            accessibilityRole="button"
            testID="new-job"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, paddingHorizontal: Space.sm, height: 36, backgroundColor: Colors.surface }}>
            <SymbolView name="plus" size={14} tintColor={Colors.ink} />
            <Heading size={15}>New job</Heading>
          </Pressable>
        </View>
        {searching ? (
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search jobs or addresses"
            placeholderTextColor={Colors.ink2}
            style={{ height: 44, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card, backgroundColor: Colors.surface, paddingHorizontal: Space.md, fontFamily: Fonts.body, fontSize: 15, color: Colors.ink }}
          />
        ) : null}
      </View>

      {!hasAny ? (
        <Empty
          title="No jobs yet."
          body="Tap the camera to start one where you stand, or add one by address."
          action={{ title: 'New job', onPress: () => router.push('/job/new') }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(j) => j.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: Space.md, paddingBottom: 120, gap: Space.sm }}
          renderSectionHeader={({ section }) =>
            section.key === 'archived' ? (
              <Pressable onPress={() => setShowArchived((s) => !s)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Space.md, paddingBottom: Space.xs }}>
                <Mono size={11} color={Colors.ink2}>{section.title.toUpperCase()}</Mono>
                <SymbolView name={showArchived ? 'chevron.up' : 'chevron.down'} size={11} tintColor={Colors.ink2} />
              </Pressable>
            ) : (
              <Mono size={11} color={Colors.ink2} style={{ paddingTop: Space.md, paddingBottom: Space.xs }}>{section.title.toUpperCase()}</Mono>
            )
          }
          renderItem={({ item, section }) => (
            <JobRow
              job={item}
              coverUri={item.coverUri}
              distanceM={section.key === 'nearby' && fix && item.lat != null && item.lng != null ? distanceM(fix, { lat: item.lat, lng: item.lng }) : null}
              onPress={() => router.push({ pathname: '/job/[id]', params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={<Empty title="No matches." />}
        />
      )}
    </View>
  );
}
