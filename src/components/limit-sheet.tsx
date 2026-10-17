import { router } from 'expo-router';

import { Sheet, SheetRow } from '@/components/sheet';
import { Body } from '@/components/text';
import { TIER_LABEL } from '@/constants/limits';
import { Colors } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { paywallEnabled } from '@/lib/plan';
import type { LimitError } from '@/lib/supabase';
import type { Tier } from '@/types/models';

type Props = { error: LimitError | null; tier: Tier; onClose: () => void };

/** Shown when a plan cap is hit. Explains the cap and offers the two ways out. */
export function LimitSheet({ error, tier, onClose }: Props) {
  const what = error?.kind === 'photos_per_job' ? 'photos on this job' : 'active jobs';
  const n = error?.limit ?? '';
  return (
    <Sheet visible={!!error} onClose={onClose} title={`${TIER_LABEL[tier]} allows ${n} ${what}`}>
      <Body color={Colors.ink2}>
        {error?.kind === 'photos_per_job'
          ? 'Start a second job for this site, or upgrade for a higher cap.'
          : 'Archive a finished job to free a slot. Archived jobs keep every photo.'}
      </Body>
      {error?.kind === 'active_jobs' ? (
        <SheetRow
          title="See archived jobs"
          onPress={() => {
            onClose();
            router.push({ pathname: '/(tabs)', params: { archived: '1' } });
          }}
        />
      ) : null}
      <SheetRow
        title="Upgrade"
        subtitle={undefined}
        disabled={!paywallEnabled}
        onPress={() => {
          track('upgrade_tapped', { from: error?.kind ?? 'unknown' });
          onClose();
        }}
      />
      <SheetRow title="Not now" onPress={onClose} />
    </Sheet>
  );
}
