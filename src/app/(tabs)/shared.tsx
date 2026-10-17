import { Empty } from '@/components/empty';
import { Screen } from '@/components/screen';
import { Heading } from '@/components/text';

export default function Shared() {
  return (
    <Screen scroll={false}>
      <Heading size={28}>Shared</Heading>
      <Empty title="Coming in the next update." body="Every link you have sent, and whether the client opened it." />
    </Screen>
  );
}
