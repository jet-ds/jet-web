> **Superseded workflow.** Archived on 2026-07-13. Follow the canonical [image workflow in AGENTS.md](../../../../AGENTS.md#image-workflow).

# Image Workflow Guide

This guide covers how to add featured images to blog posts and works using Vercel Blob storage.

## Overview

Featured images are stored in Vercel Blob (cloud storage) and displayed on:
- Homepage cards (between heading and description)
- Collection index pages (blog/works lists)
- Detail pages (individual blog posts and works)

Images are automatically optimized by Astro during build for optimal performance.

## Quick Start

```bash
# 1. Place image in staging
cp my-image.jpg public/images-staging/blog/

# 2. Upload to Vercel Blob
npm run upload-image blog/my-image.jpg

# 3. Copy the URL and add to frontmatter
# (see detailed steps below)
```

## Detailed Workflow

### Step 1: Prepare Your Image

**Image Specifications:**
- **Aspect Ratio**: 16:9 (recommended: 1920×1080 pixels)
- **Format**: JPG, PNG, WebP, or AVIF
- **File Size**: Keep under 2MB for best performance
- **Content**: Choose images that represent your content well

**Optimization Tips:**
- Images are automatically optimized by Astro, but starting with reasonable sizes helps build times
- Use descriptive filenames matching your content slug
- Consider using WebP or AVIF for better compression

### Step 2: Place in Staging Directory

Copy your image to the appropriate staging directory:

```bash
# For blog posts
cp your-image.jpg public/images-staging/blog/your-slug.jpg

# For works
cp your-image.png public/images-staging/works/your-slug.png
```

**Naming Convention:**
- Use the same slug as your content file (without .mdx extension)
- Example: `vibe-coding-vs-agentic-coding.jpg` for `vibe-coding-vs-agentic-coding.mdx`

### Step 3: Upload to Vercel Blob

Run the upload script:

```bash
npm run upload-image blog/your-slug.jpg
```

**What happens:**
1. Script reads the file from `public/images-staging/`
2. Computes a SHA-256 hash of the content (for cache busting)
3. Uploads to Vercel Blob at `images/{type}/{slug}-{hash}.{ext}`
4. Returns a public URL

**Example Output:**
```
📤 Vercel Blob Image Upload

   Type: blog
   Slug: vibe-coding
   File: /path/to/public/images-staging/blog/vibe-coding.jpg
   Hash: a3f8b2c1
   Path: images/blog/vibe-coding-a3f8b2c1.jpg

⬆️  Uploading to Vercel Blob...
✅ Upload successful!

📋 Copy this to your frontmatter:

image:
  url: "https://xyz.public.blob.vercel-storage.com/images/blog/vibe-coding-a3f8b2c1.jpg"
  alt: "Description of your image"

🔗 Blob URL:
https://xyz.public.blob.vercel-storage.com/images/blog/vibe-coding-a3f8b2c1.jpg
```

### Step 4: Update Content Frontmatter

Add the image field to your MDX file's frontmatter:

**For Blog Posts** (`src/content/blog/*.mdx`):
```yaml
---
title: "Your Post Title"
description: "Post description"
pubDate: 2025-01-18
author: "Your Name"
tags: ["tag1", "tag2"]
image:
  url: "https://xyz.public.blob.vercel-storage.com/images/blog/your-slug-hash.jpg"
  alt: "Descriptive alt text for accessibility"
---
```

**For Works** (`src/content/works/*.mdx`):
```yaml
---
title: "Your Work Title"
description: "Work description"
type: "research"  # or "project" or "other"
date: 2025-01-18
tags: ["tag1", "tag2"]
image:
  url: "https://xyz.public.blob.vercel-storage.com/images/works/your-slug-hash.png"
  alt: "Descriptive alt text for accessibility"
venue: "Conference Name"  # optional, for research
---
```

**Important Notes:**
- The `image` field is **optional** - content without images will display fine
- **Always include descriptive alt text** for accessibility
- The URL must be the complete Blob URL returned by the upload script

### Step 5: Build and Verify

Build the site to verify everything works:

```bash
npm run build
```

Preview locally:

```bash
npm run dev
```

Check that:
- Images display on the homepage
- Images display on index pages (`/blog`, `/works`)
- Images display on detail pages (`/blog/slug`, `/works/slug`)
- Images are responsive and maintain aspect ratio

## Image Display Behavior

### Homepage
- Images appear between the heading and description
- Constrained by card width
- 16:9 aspect ratio maintained
- Rounded corners applied

### Collection Pages (Blog/Works Index)
- Images at top of card with hover scale effect
- Full card width
- 16:9 aspect ratio

### Detail Pages
- Large featured image between header and content
- Optimized for 1920×1080 display
- Loaded eagerly (not lazy) for above-fold content

## Troubleshooting

### Upload Fails

**"BLOB_READ_WRITE_TOKEN not found"**
- Ensure `.env.local` exists with the token
- Token should be from Vercel Blob storage settings

**"Could not read file"**
- Verify file exists in `public/images-staging/{type}/`
- Check filename matches exactly (case-sensitive)

**"Invalid path format"**
- Use format: `blog/filename.jpg` or `works/filename.png`
- Don't include `public/images-staging/` in the command

### Images Not Displaying

**Check Astro config:**
- Verify `image.remotePatterns` includes Vercel Blob domain
- See `astro.config.mjs` for current configuration

**Check frontmatter:**
- Ensure `image.url` is the complete Blob URL
- Verify `image.alt` is present (accessibility requirement)

**Check browser console:**
- Look for CORS or loading errors
- Verify URL is accessible

### Build Errors

**"Failed to fetch remote image"**
- Verify the Blob URL is publicly accessible
- Check Vercel Blob dashboard for the file

**"Invalid image format"**
- Ensure file extension matches actual format
- Use supported formats: JPG, PNG, WebP, AVIF

## Removing or Replacing Images

### To Replace an Image

1. Upload new version (will get new hash):
   ```bash
   npm run upload-image blog/your-slug-v2.jpg
   ```

2. Update frontmatter with new URL
3. Old image remains in Blob storage (immutable URLs)

### To Remove an Image

1. Delete `image` field from frontmatter
2. Content will display without image
3. Original Blob storage file remains (safe to delete manually via Vercel dashboard if needed)

## Best Practices

### Image Selection
- Choose images that enhance understanding of the content
- Ensure images are relevant and high quality
- Consider contrast and readability

### Accessibility
- Write descriptive alt text that explains the image content
- Don't start with "Image of..." or "Picture of..."
- Be specific: "Graph showing performance improvements" vs "Graph"

### Performance
- Start with optimized images (under 2MB)
- Use modern formats (WebP/AVIF) when possible
- Let Astro handle responsive optimization

### Organization
- Keep staging directory organized
- Delete uploaded files from staging after successful upload
- Use consistent naming matching content slugs

## Advanced: Bulk Operations

For uploading multiple images:

```bash
# Upload all blog images
for img in public/images-staging/blog/*.jpg; do
  npm run upload-image blog/$(basename "$img")
done
```

For updating multiple files, consider writing a custom script that:
1. Reads existing frontmatter
2. Uploads new images
3. Updates frontmatter automatically

## Storage Management

### Vercel Blob Dashboard
- View all uploaded images at vercel.com → Project → Storage
- Check storage usage and limits
- Delete unused images if needed

### Content Hashing
- Each image gets a unique hash based on content
- Same image uploaded twice = same URL (deduplication)
- Changing image content = new hash = new URL
- Supports cache immutability (1 year cache headers)

## Environment Variables

The upload script requires:

```bash
# .env.local
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx
```

Get this token from:
1. Vercel Dashboard → Project → Storage → Blob
2. Create new token or use existing
3. Add to `.env.local` (never commit this file!)

## Summary

1. ✅ Prepare 16:9 image (1920×1080 recommended)
2. ✅ Place in `public/images-staging/{type}/`
3. ✅ Run `npm run upload-image {type}/{filename}`
4. ✅ Copy URL to frontmatter with descriptive alt text
5. ✅ Build and verify

Images enhance your content but are optional - all features work with or without them!
