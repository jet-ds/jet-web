import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../config/site';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  // Get all published blog posts
  const blog = await getCollection('blog', ({ data }) => {
    return data.draft !== true;
  });

  // Sort by date (newest first)
  const sortedPosts = blog.sort((a, b) => {
    return new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime();
  });

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site || SITE.siteUrl,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.slug}/`,
      author: post.data.author || SITE.author,
      categories: post.data.tags || [],
    })),
    customData: `<language>en-us</language>`,
    stylesheet: '/rss-styles.xsl', // Optional: can create later
  });
}
