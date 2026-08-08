/**
 * Image Upload Script for Vercel Blob Storage
 *
 * Uploads images from public/images-staging/ to Vercel Blob with content hashing
 * for cache busting and immutable URLs.
 *
 * Usage:
 *   npm run upload-image blog/my-post.jpg
 *   npm run upload-image works/my-work.png
 */

import { put } from '@vercel/blob';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Validate required environment variable
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found in .env.local');
  console.error('   This token is required to upload to Vercel Blob storage.');
  process.exit(1);
}

// Supported image formats
const SUPPORTED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
];

/**
 * Parse command line arguments
 */
function parseArgs(): string {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Error: No file path provided');
    console.error('');
    console.error('Usage:');
    console.error('  npm run upload-image blog/my-post.jpg');
    console.error('  npm run upload-image works/my-work.png');
    console.error('');
    console.error('The file should exist in public/images-staging/ directory.');
    process.exit(1);
  }

  return args[0];
}

/**
 * Validate file path and extract metadata
 */
function validatePath(relativePath: string): {
  type: string;
  slug: string;
  ext: string;
} {
  const parts = relativePath.split('/');

  if (parts.length !== 2) {
    console.error('❌ Error: Invalid path format');
    console.error('   Expected: <type>/<filename>');
    console.error('   Example: blog/my-post.jpg');
    process.exit(1);
  }

  const [type, filename] = parts;

  if (!['blog', 'works', 'about'].includes(type)) {
    console.error(`❌ Error: Invalid type "${type}"`);
    console.error('   Must be either "blog", "works", or "about"');
    process.exit(1);
  }

  const ext = path.extname(filename).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    console.error(`❌ Error: Unsupported file extension "${ext}"`);
    console.error(`   Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`);
    process.exit(1);
  }

  const slug = path.basename(filename, ext);

  return { type, slug, ext };
}

/**
 * Compute SHA-256 hash of file content
 */
function computeHash(buffer: Buffer): string {
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex').substring(0, 8); // First 8 characters
}

/**
 * Main upload function
 */
async function main() {
  const relativePath = parseArgs();
  const { type, slug, ext } = validatePath(relativePath);

  // Construct file path
  const stagingPath = path.join(
    process.cwd(),
    'public',
    'images-staging',
    relativePath,
  );

  console.log('📤 Vercel Blob Image Upload');
  console.log('');
  console.log(`   Type: ${type}`);
  console.log(`   Slug: ${slug}`);
  console.log(`   File: ${stagingPath}`);
  console.log('');

  // Read file
  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(stagingPath);
  } catch (error) {
    console.error(`❌ Error: Could not read file at ${stagingPath}`);
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(
        '   File does not exist. Make sure the file is in public/images-staging/',
      );
    }
    process.exit(1);
  }

  // Compute content hash
  const hash = computeHash(fileBuffer);
  console.log(`   Hash: ${hash}`);

  // Construct blob path
  const blobPath = `images/${type}/${slug}-${hash}${ext}`;
  console.log(`   Path: ${blobPath}`);
  console.log('');

  // Upload to Vercel Blob
  console.log('⬆️  Uploading to Vercel Blob...');

  try {
    const blob = await put(blobPath, fileBuffer, {
      access: 'public',
      addRandomSuffix: false, // We're using content hash for uniqueness
      cacheControlMaxAge: 31536000, // 1 year (immutable)
      contentType: getContentType(ext),
    });

    console.log('✅ Upload successful!');
    console.log('');
    console.log('📋 Copy this to your frontmatter:');
    console.log('');
    console.log('image:');
    console.log(`  url: "${blob.url}"`);
    console.log('  alt: "Description of your image"');
    console.log('');
    console.log('🔗 Blob URL:');
    console.log(blob.url);
    console.log('');
  } catch (error) {
    console.error('❌ Upload failed:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Get MIME type for file extension
 */
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
  };

  return types[ext] || 'application/octet-stream';
}

// Run main function
main().catch((error) => {
  console.error('❌ Unexpected error:');
  console.error(error);
  process.exit(1);
});
