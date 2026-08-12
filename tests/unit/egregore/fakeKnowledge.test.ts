import { describe, expect, it } from 'vitest';

import { EGREGORE_CONTEXT } from '../../../src/features/egregore/config';
import { createFakeKnowledgeRepository } from '../../../src/features/egregore/runtime/fakeKnowledge';
import { rankAndPackContext } from '../../../src/features/egregore/selection/rankAndPack';

describe('Egregore fake knowledge', () => {
  it('provides a stable searchable corpus with duplicate and distinct document citations', async () => {
    const repository = createFakeKnowledgeRepository();
    const knowledgeBase = await repository.load();

    const selection = rankAndPackContext({
      query: 'What does Jet write about agentic work?',
      knowledgeBase,
      budget: EGREGORE_CONTEXT,
    });

    expect(selection.sources.length).toBeGreaterThanOrEqual(3);
    expect(selection.sources[0]?.text).toContain('agentic work');
    expect(
      selection.sources.some(
        (source, index) =>
          index > 0 &&
          source.canonicalUrl === selection.sources[0]?.canonicalUrl,
      ),
    ).toBe(true);
    expect(
      selection.sources.some(
        (source) => source.canonicalUrl !== selection.sources[0]?.canonicalUrl,
      ),
    ).toBe(true);

    repository.unload();
    await expect(repository.load()).resolves.toMatchObject({
      package: { corpusVersion: knowledgeBase.package.corpusVersion },
    });
  });
});
