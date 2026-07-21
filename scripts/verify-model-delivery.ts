import { mkdir, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import type { IncomingMessage } from 'node:http';
import { dirname } from 'node:path';
import { EGREGORE_MODEL } from '../src/features/egregore/config';
import {
  isTrustedModelOrigin,
  sanitizeModelDeliveryResult,
  validateModelDeliveryChain,
  verifyModelArtifactStream,
  type ModelDeliveryFailure,
  type ModelDeliveryHop,
  type ModelDeliveryResult,
  type ModelDeliveryValidation,
} from '../src/features/egregore/runtime/modelDelivery';

type VerificationMode = ModelDeliveryResult['mode'];

interface CommandOptions {
  mode: VerificationMode;
  output: string;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function parseCommandOptions(argv: readonly string[]): CommandOptions {
  const modes: VerificationMode[] = [];
  let output: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--transport-only') {
      modes.push('transport-only');
    } else if (argument === '--hash-artifact') {
      modes.push('hash-artifact');
    } else if (argument === '--output') {
      output = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--output=')) {
      output = argument.slice('--output='.length);
    } else {
      throw new Error('INVALID_ARGUMENTS');
    }
  }

  if (modes.length !== 1 || !output) {
    throw new Error('INVALID_ARGUMENTS');
  }

  return { mode: modes[0], output };
}

function bodylessGet(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const outgoing = request(url, { method: 'GET' }, resolve);
    outgoing.once('error', reject);
    outgoing.end();
  });
}

function appendFailure(
  validation: ModelDeliveryValidation,
  failure: ModelDeliveryFailure,
): ModelDeliveryValidation {
  if (validation.failures.some(({ hopIndex, ruleCode }) => (
    hopIndex === failure.hopIndex && ruleCode === failure.ruleCode
  ))) {
    return validation;
  }

  return {
    ...validation,
    valid: false,
    failures: [...validation.failures, failure],
  };
}

function resultFor(
  mode: VerificationMode,
  validation: ModelDeliveryValidation,
  artifact?: ModelDeliveryResult['artifact'],
): ModelDeliveryResult {
  return {
    mode,
    validation,
    artifact,
    verifiedAt: new Date(),
  };
}

async function runDelivery(mode: VerificationMode): Promise<ModelDeliveryResult> {
  const chain: ModelDeliveryHop[] = [];
  const visitedUrls = new Set<string>([EGREGORE_MODEL.url]);
  let currentUrl: string = EGREGORE_MODEL.url;

  for (let hopIndex = 0; ; hopIndex += 1) {
    if (!isTrustedModelOrigin(currentUrl, EGREGORE_MODEL.trustedOrigins)) {
      const validation = appendFailure(
        validateModelDeliveryChain(chain, EGREGORE_MODEL),
        { hopIndex, ruleCode: 'ORIGIN_NOT_TRUSTED' },
      );
      return resultFor(mode, validation);
    }

    let response: IncomingMessage;
    try {
      response = await bodylessGet(currentUrl);
    } catch {
      const validation = appendFailure(
        validateModelDeliveryChain(chain, EGREGORE_MODEL),
        { hopIndex, ruleCode: 'NETWORK_ERROR' },
      );
      return resultFor(mode, validation);
    }

    const location = typeof response.headers.location === 'string'
      ? response.headers.location
      : undefined;
    const status = response.statusCode ?? 0;

    chain.push({
      request: {
        url: currentUrl,
        method: 'GET',
      },
      response: {
        status,
        location,
      },
    });

    if (REDIRECT_STATUSES.has(status)) {
      response.destroy();
      const validation = validateModelDeliveryChain(chain, EGREGORE_MODEL);

      if (!location || validation.redirectDepth > EGREGORE_MODEL.maxRedirects) {
        return resultFor(mode, validation);
      }

      let targetUrl: string;
      try {
        targetUrl = new URL(location, currentUrl).href;
      } catch {
        return resultFor(mode, validation);
      }

      if (
        !isTrustedModelOrigin(targetUrl, EGREGORE_MODEL.trustedOrigins)
        || visitedUrls.has(targetUrl)
      ) {
        return resultFor(mode, validation);
      }

      visitedUrls.add(targetUrl);
      currentUrl = targetUrl;
      continue;
    }

    const validation = validateModelDeliveryChain(chain, EGREGORE_MODEL);
    if (!validation.valid) {
      response.destroy();
      return resultFor(mode, validation);
    }

    if (mode === 'transport-only') {
      response.destroy();
      return resultFor(mode, validation);
    }

    try {
      const artifact = await verifyModelArtifactStream(response, {
        bytes: EGREGORE_MODEL.bytes,
        sha256: EGREGORE_MODEL.sha256,
        hopIndex,
      });
      return resultFor(mode, validation, artifact);
    } catch {
      response.destroy();
      return resultFor(mode, appendFailure(validation, {
        hopIndex,
        ruleCode: 'NETWORK_ERROR',
      }));
    }
  }
}

async function writeSanitizedResult(
  output: string,
  result: ModelDeliveryResult,
): Promise<void> {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    `${JSON.stringify(sanitizeModelDeliveryResult(result), null, 2)}\n`,
    'utf8',
  );
}

async function main(): Promise<void> {
  let options: CommandOptions;

  try {
    options = parseCommandOptions(process.argv.slice(2));
  } catch {
    process.stderr.write(
      'Usage: verify-model-delivery (--transport-only | --hash-artifact) --output=<path>\n',
    );
    process.exitCode = 2;
    return;
  }

  const result = await runDelivery(options.mode);
  await writeSanitizedResult(options.output, result);
  const sanitized = sanitizeModelDeliveryResult(result);

  if (sanitized.ruleCodes.length > 0) {
    const safeCodes = sanitized.ruleCodes.join(',');
    process.stderr.write(`Model delivery verification failed: ${safeCodes}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Model delivery verification passed: ${options.mode}\n`);
}

void main();
