import { Polly } from '@pollyjs/core';
import FetchAdapter from '@pollyjs/adapter-fetch';
import FSPersister from '@pollyjs/persister-fs';
import { join } from 'path';

// Register adapters and persisters
Polly.register(FetchAdapter);
Polly.register(FSPersister);

const RECORDINGS_DIR = join(import.meta.dir, 'recordings');

export interface PollyTestContext {
  polly: Polly;
}

export function setupPolly(recordingName: string): Polly {
  const mode = process.env.POLLY_MODE as 'record' | 'replay' | 'passthrough' | undefined;

  const polly = new Polly(recordingName, {
    adapters: ['fetch'],
    persister: 'fs',
    persisterOptions: {
      fs: {
        recordingsDir: RECORDINGS_DIR,
      },
    },
    recordIfMissing: mode !== 'replay',
    mode: mode || 'replay',
    logLevel: 'silent',
    matchRequestsBy: {
      headers: false, // Don't match by headers (auth tokens change)
      body: true,
      order: false,
    },
  });

  // Filter out sensitive headers from recordings
  polly.server.any().on('beforePersist', (req, recording) => {
    // Remove authorization header from recorded request
    if (recording.request.headers) {
      recording.request.headers = recording.request.headers.filter(
        (h: { name: string }) => h.name.toLowerCase() !== 'authorization'
      );
    }
  });

  return polly;
}

export async function stopPolly(polly: Polly): Promise<void> {
  await polly.stop();
}
