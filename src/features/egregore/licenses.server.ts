import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const EGREGORE_LICENSE_BUNDLE = Object.freeze({
  notices: readFileSync(resolve('THIRD_PARTY_NOTICES.md'), 'utf8'),
  apache: readFileSync(resolve('LICENSES/Apache-2.0.txt'), 'utf8'),
  minisearch: readFileSync(
    resolve('LICENSES/minisearch-7.2.0-MIT.txt'),
    'utf8',
  ),
  stemmer: readFileSync(resolve('LICENSES/stemmer-2.0.1-MIT.txt'), 'utf8'),
  reactMarkdown: readFileSync(
    resolve('LICENSES/react-markdown-10.1.0-MIT.txt'),
    'utf8',
  ),
  remarkGfm: readFileSync(resolve('LICENSES/remark-gfm-4.0.1-MIT.txt'), 'utf8'),
  markdownRendererDependencies: readFileSync(
    resolve('LICENSES/egregore-markdown-renderer-dependencies.txt'),
    'utf8',
  ),
});
