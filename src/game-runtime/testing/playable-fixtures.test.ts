import { expect, it } from 'vitest';
import { createGameApplication } from '../../game-application';
import { MemoryGameStore } from '../../game-infrastructure/storage/memory';
import { LEGACY_VALIDATED_CATALOG } from '../legacy-context';
import { interruptionArchive } from './playable-fixtures';
it.each(['cursor','next-round','clear','final-hit','wipe'] as const)('legacy interruption sample %s is a valid import', async kind => {
  const app = createGameApplication({ catalog: LEGACY_VALIDATED_CATALOG, store: new MemoryGameStore() });
  const result = await app.importSave({ protocolVersion: 1, saveId: 'fixture', epoch: 'epoch', clientRequestId: 'import', format: 'legacy', archive: interruptionArchive(kind) });
  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
});
