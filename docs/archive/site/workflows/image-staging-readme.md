> **Superseded workflow.** Archived on 2026-07-13. Follow the canonical [image workflow in AGENTS.md](../../../../AGENTS.md#image-workflow).

# Image Staging Directory

This directory is used for staging images before uploading them to Vercel Blob storage.

## Directory Structure

```
images-staging/
├── blog/        # Blog post featured images
├── works/       # Works/project featured images
└── README.md    # This file
```

## Usage

1. **Place your image** in the appropriate subdirectory:
   - Blog images → `public/images-staging/blog/`
   - Works images → `public/images-staging/works/`

2. **Name your image** with the content slug:
   - Example: `vibe-coding-vs-agentic-coding.jpg`
   - Example: `recursive-convergence-hypothesis.png`

3. **Upload to Vercel Blob**:
   ```bash
   npm run upload-image blog/your-image.jpg
   # or
   npm run upload-image works/your-image.png
   ```

4. **Copy the returned URL** to your content frontmatter:
   ```yaml
   image:
     url: "https://xyz.public.blob.vercel-storage.com/images/blog/your-image-a3f8b2c1.jpg"
     alt: "Descriptive alt text for accessibility"
   ```

## Image Specifications

- **Aspect Ratio**: 16:9 (recommended: 1920×1080)
- **Format**: JPG, PNG, WebP, or AVIF
- **Size**: Keep under 2MB for optimal performance
- **Optimization**: Images are automatically optimized by Astro during build

## Notes

- Images in this directory are NOT tracked by git after upload
- The directory structure is preserved for organization
- Each upload generates a unique URL with content hashing
- Original files can be deleted after successful upload
