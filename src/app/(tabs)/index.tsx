import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Empty } from '@/components/empty';
import { JobCard } from '@/components/job-card';
import { StartHereCard } from '@/components/start-here-card';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Fonts, Radius, Space } from '@/constants/theme';
import { useCompany, useMember } from '@/lib/company';
import { distanceM } from '@/lib/geo';
import { pullJobs, rankJobs, useFix, useJobs } from '@/lib/jobs';
import type { Job } from '@/types/models';

type Filter = 'nearby' | 'recent' | 'all' | 'archived';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'nearby', label: 'Nearby' },
  { key: 'recent', label: 'Recent' },
  { key: 'all', label: 'All jobs' },
  { key: 'archived', label: 'Archived' },
];

function RoundButton({ icon, label, onPress, testID }: { icon: SFSymbol; label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={6}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.hairline, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <SymbolView name={icon} size={19} tintColor={Colors.ink} />
    </Pressable>
  );
}

function Pill({ label, on, onPress, count }: { label: string; on: boolean; onPress: () => void; count: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      testID={`filter-${label.toLowerCase().replace(/\s+/g, '-')}`}
      style={({ pressed }) => ({
        height: 40,
        paddingHorizontal: 18,
        borderRadius: Radius.pill,
        justifyContent: 'center',
        backgroundColor: on ? Colors.ink : Colors.surface,
        borderWidth: 1,
        borderColor: on ? Colors.ink : Colors.hairline,
        opacity: pressed ? 0.8 : 1,
      })}>
      <Heading size={15} color={on ? Colors.surface : Colors.ink}>{label}{count ? ` · ${count}` : ''}</Heading>
    </Pressable>
  );
}

export default function Jobs() {
  const insets = useSafeAreaInsets();
  const company = useCompany();
  const member = useMember();
  const jobs = useJobs();
  const fix = useFix();
  const params = useLocalSearchParams<{ archived?: string }>();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<Filter | null>(params.archived === '1' ? 'archived' : null);

  useEffect(() => {
    pullJobs().catch(() => {});
  }, []);
  useEffect(() => {
    if (params.archived === '1') setFilter('archived');
  }, [params.archived]);

  const ranked = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? jobs.filter((j) => j.name.toLowerCase().includes(q) || j.address.toLowerCase().includes(q)) : jobs;
    return rankJobs(filtered, fix);
  }, [jobs, fix, query]);

  const lists: Record<Filter, Job[]> = {
    nearby: ranked.nearby,
    recent: ranked.recent,
    all: [...ranked.nearby, ...ranked.recent, ...ranked.all],
    archived: ranked.archived,
  };
  // Default to the most useful non-empty list: where you are, then what you touched last.
  const active: Filter = filter ?? (ranked.nearby.length ? 'nearby' : ranked.recent.length ? 'recent' : 'all');
  const data = lists[active];
  const first = (member?.displayName ?? '').trim().split(/\s+/)[0];
  const hasAny = jobs.length > 0;

  const header = (
    <View style={{ gap: Space.md, paddingBottom: Space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <Pressable onPress={() => router.push('/(tabs)/you')} accessibilityRole="button" accessibilityLabel="Your account" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.hairline, alignItems: 'center', justifyContent: 'center' }}>
          <Mono size={13} color={Colors.ink} bold>{member?.initials ?? '—'}</Mono>
        </Pressable>
        <View style={{ flex: 1 }} />
        <RoundButton icon={searching ? 'xmark' : 'magnifyingglass'} label="Search jobs" onPress={() => { setSearching((s) => !s); setQuery(''); }} testID="search-jobs" />
        <RoundButton icon="plus" label="New job" onPress={() => router.push('/job/new')} testID="new-job" />
      </View>
      {searching ? (
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Job name or address"
          placeholderTextColor={Colors.ink2}
          style={{ height: 52, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.hairline, paddingHorizontal: 20, fontFamily: Fonts.body, fontSize: 17, color: Colors.ink }}
        />
      ) : (
        <View style={{ gap: 2 }}>
          <Heading size={30} bold numberOfLines={1}>{first ? `Welcome, ${first}` : 'Welcome'}</Heading>
          <Body size={14} color={Colors.ink2} numberOfLines={1}>{company?.name ?? ''}</Body>
        </View>
      )}
      <StartHereCard />
      {hasAny ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Heading size={22}>Jobs</Heading>
            <Mono size={13}>{jobs.filter((j) => j.status === 'active').length} active</Mono>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.sm }}>
            {FILTERS.map((f) => (
              <Pill key={f.key} label={f.label} on={active === f.key} onPress={() => setFilter(f.key)} count={f.key === 'archived' ? ranked.archived.length : 0} />
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas, paddingTop: insets.top + Space.sm }}>
      <FlatList
        data={hasAny ? data : []}
        keyExtractor={(j) => j.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: Space.md, paddingBottom: 140, gap: Space.md }}
        renderItem={({ item }) => (
          <JobCard
            job={item}
            distanceM={active === 'nearby' && fix && item.lat != null && item.lng != null ? distanceM(fix, { lat: item.lat, lng: item.lng }) : null}
            onPress={() => router.push({ pathname: '/job/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          !hasAny ? (
            <Empty title="No jobs yet" body="Tap the camera to start one where you stand, or add one by address." action={{ title: 'New job', onPress: () => router.push('/job/new') }} />
          ) : query ? (
            <Empty title="No matches" body="Try part of the address or the client's name." />
          ) : active === 'nearby' ? (
            <Empty title="No jobs near you" body="Jobs within 300 m of where you stand show up here." action={{ title: 'See all jobs', onPress: () => setFilter('all') }} />
          ) : active === 'archived' ? (
            <Empty title="Nothing archived" body="Finished jobs you archive stay here, free and searchable." />
          ) : (
            <Empty title="Nothing here yet" />
          )
        }
      />
    </View>
  );
}
