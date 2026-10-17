import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Heading } from '@/components/text';
import { useJob } from '@/lib/jobs';

/** Replaced in Task 10. */
export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJob(id);
  return (
    <Screen footer={<Button title="Back" variant="ghost" onPress={() => router.back()} />}>
      <Heading size={30}>{job?.name ?? '…'}</Heading>
    </Screen>
  );
}
