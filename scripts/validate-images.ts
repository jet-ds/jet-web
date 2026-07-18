/**
 * Validates that all remote images referenced in content are accessible.
 *
 * Usage: npm run validate-images
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { blogSchema, worksSchema } from '../src/schemas/content';

type CollectionName = 'blog' | 'works';

interface ImageReference {
  url: string;
  contentType: CollectionName;
  contentId: string;
  field: 'image.url' | 'image.darkUrl';
}

interface ValidationResult extends ImageReference {
  status: 'success' | 'error';
  error?: string;
}

const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../..');
const collections = [
  { name: 'blog' as const, directory: 'src/data/blog' },
  { name: 'works' as const, directory: 'src/data/works' },
];

function readContentImages(): ImageReference[] {
  const references: ImageReference[] = [];

  for (const collection of collections) {
    const collectionRoot = resolve(repositoryRoot, collection.directory);

    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          visit(path);
          continue;
        }
        if (!entry.isFile() || !['.md', '.mdx'].includes(extname(entry.name))) {
          continue;
        }

        const source = matter(readFileSync(path, 'utf8')).data;
        const parsed = collection.name === 'blog'
          ? blogSchema.parse(source)
          : worksSchema.parse(source);
        if (!parsed.image) continue;

        const contentId = relative(collectionRoot, path)
          .slice(0, -extname(path).length)
          .split(sep)
          .join('/');
        references.push({
          url: parsed.image.url,
          contentType: collection.name,
          contentId,
          field: 'image.url',
        });

        if (collection.name === 'works' && 'darkUrl' in parsed.image && parsed.image.darkUrl) {
          references.push({
            url: parsed.image.darkUrl,
            contentType: collection.name,
            contentId,
            field: 'image.darkUrl',
          });
        }
      }
    };

    visit(collectionRoot);
  }

  return references;
}

async function validateImage(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(url, { method: 'HEAD' });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      return { ok: false, error: `Invalid content-type: ${contentType}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  console.log('🔍 Validating remote images...\n');

  const results: ValidationResult[] = [];
  for (const reference of readContentImages()) {
    const validation = await validateImage(reference.url);
    results.push({
      ...reference,
      status: validation.ok ? 'success' : 'error',
      error: validation.error,
    });
  }

  const errors = results.filter((result) => result.status === 'error');
  const successes = results.filter((result) => result.status === 'success');

  if (successes.length > 0) {
    console.log(`✅ ${successes.length} image(s) validated successfully\n`);
  }

  if (errors.length > 0) {
    console.error(`❌ ${errors.length} image validation error(s):\n`);
    for (const { contentType, contentId, field, url, error } of errors) {
      console.error(`  [${contentType}/${contentId} ${field}]`);
      console.error(`  URL: ${url}`);
      console.error(`  Error: ${error}\n`);
    }
    process.exitCode = 1;
    return;
  }

  if (results.length === 0) {
    console.log('ℹ️  No images found to validate');
  } else {
    console.log('✨ All images validated successfully!');
  }
}

main().catch((error) => {
  console.error('❌ Validation script failed:');
  console.error(error);
  process.exitCode = 1;
});
