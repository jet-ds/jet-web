/**
 * Validates that all remote images referenced in content are accessible
 * Run during build to catch broken image URLs early
 * 
 * Usage: npm run validate-images
 */

import { getCollection } from 'astro:content';

interface ValidationResult {
  url: string;
  contentType: string;
  contentId: string;
  status: 'success' | 'error';
  error?: string;
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
  
  // Validate blog images
  const blogPosts = await getCollection('blog');
  for (const post of blogPosts) {
    if (post.data.image?.url) {
      const validation = await validateImage(post.data.image.url);
      results.push({
        url: post.data.image.url,
        contentType: 'blog',
        contentId: post.id,
        status: validation.ok ? 'success' : 'error',
        error: validation.error,
      });
    }
  }
  
  // Validate works images
  const works = await getCollection('works');
  for (const work of works) {
    if (work.data.image?.url) {
      const validation = await validateImage(work.data.image.url);
      results.push({
        url: work.data.image.url,
        contentType: 'works',
        contentId: work.id,
        status: validation.ok ? 'success' : 'error',
        error: validation.error,
      });
    }
  }
  
  // Report results
  const errors = results.filter(r => r.status === 'error');
  const successes = results.filter(r => r.status === 'success');
  
  if (successes.length > 0) {
    console.log(`✅ ${successes.length} image(s) validated successfully\n`);
  }
  
  if (errors.length > 0) {
    console.error(`❌ ${errors.length} image validation error(s):\n`);
    errors.forEach(({ contentType, contentId, url, error }) => {
      console.error(`  [${contentType}/${contentId}]`);
      console.error(`  URL: ${url}`);
      console.error(`  Error: ${error}\n`);
    });
    process.exit(1);
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
  process.exit(1);
});
