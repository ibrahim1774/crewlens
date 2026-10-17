import { Empty } from '@/components/empty';
import { Screen } from '@/components/screen';
import { Heading } from '@/components/text';

export default function Activity() {
  return (
    <Screen scroll={false}>
      <Heading size={28}>Activity</Heading>
      <Empty title="Coming in the next update." body="A day-by-day stream of what your crew shot, grouped by job." />
    </Screen>
  );
}
