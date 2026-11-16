import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDiscordState, saveDiscordState, getLastMessageId, setLastMessageId } from './discord-state.ts';
import { cleanDescription } from './discord-webhook-dispatcher.ts';

test('cleanDescription: strips HTML and decodes entities', () => {
  const raw = '<b>“Make me a love potion.”</b><br><br>And with that sentence... (Source: Yen Press)';
  const cleaned = cleanDescription(raw);
  assert.ok(!cleaned.includes('<b>'));
  assert.ok(!cleaned.includes('<br>'));
  assert.ok(!cleaned.includes('(Source:'));
  assert.ok(cleaned.includes('Make me a love potion'));
});

test('discord-state: saves and retrieves lastMessageId for rotation', async () => {
  await setLastMessageId('test_channel', '1234567890');
  const retrieved = await getLastMessageId('test_channel');
  assert.equal(retrieved, '1234567890');

  // Clean up
  const state = await readDiscordState();
  delete state.lastMessages['test_channel'];
  await saveDiscordState(state);
});
