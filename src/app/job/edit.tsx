import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { Heading } from '@/components/text';
import { Space } from '@/constants/theme';
import { updateJob, useJob } from '@/lib/jobs';

export default function EditJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJob(id);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [client, setClient] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (job && !loaded) {
      setName(job.name);
      setAddress(job.address);
      setClient(job.clientName ?? '');
      setLoaded(true);
    }
  }, [job, loaded]);

  const save = async () => {
    if (!id) return;
    await updateJob(id, { name: name.trim(), address: address.trim(), clientName: client.trim() || null });
    router.back();
  };

  return (
    <Screen footer={<Button title="Save" onPress={save} disabled={name.trim().length < 2} />}>
      <View style={{ gap: Space.xs }}>
        <Heading size={30} bold>Edit job</Heading>
      </View>
      <Field label="Job name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Address" value={address} onChangeText={setAddress} autoCapitalize="words" />
      <Field label="Client (optional)" value={client} onChangeText={setClient} autoCapitalize="words" />
    </Screen>
  );
}
