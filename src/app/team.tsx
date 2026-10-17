import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as SMS from 'expo-sms';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Heading, Mono } from '@/components/text';
import { Colors, Radius, Space } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { createInvite, deleteInvite, listInvites, listMembers, removeMember, useCompany, useMember, type Invite } from '@/lib/company';
import { APP_STORE_URL } from '@/app/(auth)/crew';
import type { Member } from '@/types/models';

/** Members, open invite codes, and the seat count. Owners invite and remove; members see the list. */
export default function Team() {
  const company = useCompany();
  const me = useMember();
  const owner = me?.role === 'owner';
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([listMembers().catch(() => []), owner ? listInvites().catch(() => []) : Promise.resolve([])]);
    setMembers(m);
    setInvites(i);
  }, [owner]);

  useEffect(() => {
    track('team_opened');
    void load();
  }, [load]);

  const seats = company?.seats ?? 1;
  const full = members.length >= seats;

  const invite = async () => {
    setBusy(true);
    try {
      const inv = await createInvite();
      track('invite_created');
      await load();
      const message = `Join ${company?.name ?? 'our crew'} on Crew Lens. Install it, sign in, then enter code ${inv.code}: ${APP_STORE_URL}`;
      if (await SMS.isAvailableAsync()) await SMS.sendSMSAsync([], message);
      else await Share.share({ message });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'limit:seats') Alert.alert('All seats are taken', `Your plan includes ${seats} ${seats === 1 ? 'seat' : 'seats'}. Crew adds three, and more at $9.99 each.`, [{ text: 'Not now', style: 'cancel' }, { text: 'See plans', onPress: () => router.push({ pathname: '/(auth)/paywall', params: { upgrade: '1' } }) }]);
      else if (msg !== 'not_owner') Alert.alert('Could not create an invite', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Code copied', `${code} works once and expires in 7 days.`);
  };

  const remove = (m: Member) =>
    Alert.alert(`Remove ${m.displayName}?`, 'Their photos stay with the jobs. They lose access right away.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMember(m.userId).then(load).then(() => track('member_removed')).catch(() => Alert.alert('Could not remove', 'Check your connection.')) },
    ]);

  return (
    <Screen
      footer={
        owner ? (
          <Button title={full ? 'Add seats' : 'Invite by text'} onPress={full ? () => router.push({ pathname: '/(auth)/paywall', params: { upgrade: '1' } }) : invite} loading={busy} testID="team-invite" />
        ) : undefined
      }>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <SymbolView name="chevron.left" size={22} tintColor={Colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Heading size={30} bold>Team</Heading>
          <Mono size={11} color={Colors.ink2}>{members.length} OF {seats} {seats === 1 ? 'SEAT' : 'SEATS'} · {(company?.name ?? '').toUpperCase()}</Mono>
        </View>
      </View>
      <Body color={Colors.ink2}>Everyone here shoots into the same jobs with their own initials on the stamp. Photos stay with the company if someone leaves.</Body>

      <View style={{ gap: Space.sm }}>
        <Mono size={11} color={Colors.ink2}>MEMBERS</Mono>
        {members.map((m) => (
          <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, padding: Space.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: m.role === 'owner' ? Colors.ink : Colors.slate, alignItems: 'center', justifyContent: 'center' }}>
              <Mono size={11} color={Colors.onCamera} bold>{m.initials}</Mono>
            </View>
            <View style={{ flex: 1 }}>
              <Heading size={17}>{m.displayName}{m.userId === me?.userId ? ' (you)' : ''}</Heading>
              <Mono size={10} color={Colors.ink2}>{m.role.toUpperCase()}</Mono>
            </View>
            {owner && m.userId !== me?.userId ? (
              <Pressable onPress={() => remove(m)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${m.displayName}`}>
                <Mono size={11} color={Colors.flag} bold>REMOVE</Mono>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      {owner && invites.length ? (
        <View style={{ gap: Space.sm }}>
          <Mono size={11} color={Colors.ink2}>OPEN INVITE CODES</Mono>
          {invites.map((i) => (
            <View key={i.code} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, padding: Space.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.hairline, borderRadius: Radius.card }}>
              <Mono size={16} bold style={{ flex: 1, letterSpacing: 2 }}>{i.code}</Mono>
              <Pressable onPress={() => copy(i.code)} hitSlop={8} accessibilityRole="button"><Mono size={11} color={Colors.slate} bold>COPY</Mono></Pressable>
              <Pressable onPress={() => deleteInvite(i.code).then(load)} hitSlop={8} accessibilityRole="button"><Mono size={11} color={Colors.flag} bold>CANCEL</Mono></Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {owner && !invites.length ? (
        <Body size={13} color={Colors.ink2}>An invite is a six-character code sent by text. The person installs Crew Lens, signs in, and enters it on the "Your company" step.</Body>
      ) : null}
    </Screen>
  );
}
