#!/usr/bin/env node
/**
 * Import Free Computer Courses content into Swiftener posts as markdown.
 *
 * Usage:
 *   node scripts/import-fcc-courses.js
 *   FCC_ROOT=/path/to/freecomputercourses node scripts/import-fcc-courses.js
 *
 * Options:
 *   --lessons   also create one post per lesson (in addition to course posts)
 *   --dry-run   print what would be imported without writing
 *
 * Default: course posts + lesson posts (readable pages like FCC tutorials).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');
const { getDb } = require('../config/db');
const Post = require('../models/Post');
const slugify = require('slugify');

const SKIP_COURSES = new Set(['cheatsheets', 'resources']);
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const INCLUDE_LESSONS = !args.has('--courses-only');
const LESSONS_ONLY = args.has('--lessons-only');

const FCC_ROOT =
  process.env.FCC_ROOT ||
  path.resolve(__dirname, '..', '..', 'freecomputercourses');

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, ''));
}

function inlineMarkdown(html) {
  let s = String(html || '');
  s = s.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    const text = stripTags(label).trim() || href;
    return `[${text}](${href})`;
  });
  s = s.replace(/<code>([\s\S]*?)<\/code>/gi, (_, c) => `\`${decodeEntities(c)}\``);
  s = s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, (_, __, t) => `**${stripTags(t).trim()}**`);
  s = s.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, (_, __, t) => `*${stripTags(t).trim()}*`);
  return stripTags(s).trim();
}

function htmlToMarkdown(html) {
  let s = String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  s = s.replace(/<header class="article-header"[\s\S]*?<\/header>/gi, '');
  s = s.replace(/<section class="related"[\s\S]*?<\/section>/gi, '');
  s = s.replace(/<section class="page-comments"[\s\S]*?<\/section>/gi, '');
  s = s.replace(/<p class="byline"[\s\S]*?<\/p>/gi, '');
  s = s.replace(/<p class="article-actions"[\s\S]*?<\/p>/gi, '');

  // Project CTA aside → clean markdown block
  s = s.replace(/<aside class="project-cta"[^>]*>([\s\S]*?)<\/aside>/gi, (_, inner) => {
    let block = inner;
    block = block.replace(/<p class="project-cta-label"[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n### ${stripTags(t).trim()}\n\n`);
    block = block.replace(/<p class="project-cta-run-label"[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n#### ${stripTags(t).trim()}\n\n`);
    block = block.replace(/<p class="project-cta-path"[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `${inlineMarkdown(t)}\n\n`);
    block = block.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, code) => {
      const body = decodeEntities(code).replace(/\n$/, '');
      return `\n\`\`\`\n${body}\n\`\`\`\n\n`;
    });
    block = block.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const text = stripTags(label).trim() || href;
      return `[${text}](${href})`;
    });
    block = block.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `${inlineMarkdown(t)}\n\n`);
    block = block.replace(/<[^>]+>/g, '');
    return `\n${decodeEntities(block).trim()}\n\n`;
  });

  s = s.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, code) => {
    const body = decodeEntities(code).replace(/\n$/, '');
    return `\n\`\`\`\n${body}\n\`\`\`\n\n`;
  });
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `\n# ${stripTags(t).trim()}\n\n`);
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n## ${stripTags(t).trim()}\n\n`);
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n### ${stripTags(t).trim()}\n\n`);
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${inlineMarkdown(t)}\n`);
  s = s.replace(/<\/?ul[^>]*>/gi, '\n');
  s = s.replace(/<\/?ol[^>]*>/gi, '\n');
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `${inlineMarkdown(t)}\n\n`);
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/?(section|div|article|span|main|aside)[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');

  // Never keep HTML indentation — marked treats 4-space indents as code blocks
  const lines = decodeEntities(s).split('\n');
  const out = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(line.trim().startsWith('```') ? line.trim() : line);
      continue;
    }
    out.push(inFence ? line.replace(/^\s{0,4}/, '') : line.trim());
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function resolveLessonFile(lessonPath) {
  const rel = String(lessonPath || '').replace(/^\//, '');
  const candidates = [
    path.join(FCC_ROOT, 'public', rel),
    path.join(FCC_ROOT, 'public', rel.replace(/\.html$/, ''), 'index.html'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

function extractArticleHtml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const article = raw.match(/<article[^>]*class=["'][^"']*tutorial[^"']*["'][^>]*>([\s\S]*?)<\/article>/i);
  if (article) return article[1];
  const main = raw.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  return main ? main[1] : raw;
}

function loadLessons() {
  const file = path.join(FCC_ROOT, 'public', 'data', 'lessons.json');
  if (!fs.existsSync(file)) {
    throw new Error(`FCC lessons catalog not found: ${file}`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(raw.lessons) ? raw.lessons : [];
}

function findAdminId() {
  const preferred = process.env.ADMIN_EMAIL
    ? getDb().prepare(`SELECT id FROM users WHERE lower(email) = lower(?) AND role = 'admin'`).get(process.env.ADMIN_EMAIL)
    : null;
  if (preferred) return preferred.id;
  const admin = getDb().prepare(`SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`).get();
  if (!admin) throw new Error('No admin user found — create an admin first');
  return admin.id;
}

function upsertPost({ title, slugHint, body, excerpt, category, tags, authorId }) {
  const existing = Post.findBySlug(slugHint);
  if (existing?._id) {
    if (DRY_RUN) return { action: 'update', id: existing._id, slug: slugHint };
    Post.update(existing._id, {
      title,
      body,
      excerpt,
      category,
      tags,
      status: 'published',
      publishedAt: new Date(),
    });
    getDb().prepare('UPDATE posts SET author_id = ? WHERE id = ?').run(authorId, existing._id);
    return { action: 'update', id: existing._id, slug: slugHint };
  }

  const base = slugify(slugHint, { lower: true, strict: true, trim: true }) || slugHint;
  // generateUniqueSlug is async but Post lookups are sync — use a sync loop
  let slug = base;
  let n = 2;
  while (Post.findOneBySlug(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  if (DRY_RUN) return { action: 'create', slug };
  const post = Post.create({
    title,
    slug,
    body,
    excerpt,
    category,
    tags,
    author: authorId,
    status: 'published',
    publishedAt: new Date(),
  });
  return { action: 'create', id: post._id, slug: post.slug };
}

function buildCoursePost(courseSlug, lessons, authorId) {
  const first = lessons[0];
  const title = `${first.courseLabel} Tutorials`;
  const slug = `fcc-${courseSlug}`;
  const category = first.familyLabel || 'Courses';
  const tags = Array.from(
    new Set([courseSlug, first.family, 'free-computer-courses', 'tutorial'].filter(Boolean))
  );

  const parts = [
    `# ${title}`,
    '',
    `Imported from Free Computer Courses. ${lessons.length} lessons.`,
    '',
  ];

  for (const lesson of lessons) {
    parts.push(`## ${lesson.title}`);
    parts.push('');
    if (lesson.description) {
      parts.push(lesson.description);
      parts.push('');
    }
    const file = resolveLessonFile(lesson.path);
    if (file) {
      const md = htmlToMarkdown(extractArticleHtml(file));
      if (md) {
        parts.push(md);
        parts.push('');
      }
    } else {
      parts.push(`*(Source page not found: ${lesson.path})*`);
      parts.push('');
    }
  }

  const body = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const excerpt = first.description || `${first.courseLabel} course with ${lessons.length} lessons.`;

  return upsertPost({
    title,
    slugHint: slug,
    body,
    excerpt: excerpt.slice(0, 500),
    category,
    tags,
    authorId,
  });
}

function buildLessonPost(lesson, authorId) {
  const file = resolveLessonFile(lesson.path);
  const articleMd = file ? htmlToMarkdown(extractArticleHtml(file)) : '';
  const title =
    lesson.courseLabel && !String(lesson.title).includes(lesson.courseLabel)
      ? `${lesson.courseLabel}: ${lesson.title}`
      : lesson.title;
  const body = [`# ${title}`, '', lesson.description || '', '', articleMd]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const slug = `fcc-${String(lesson.id || lesson.path)
    .replace(/\.html$/i, '')
    .replace(/[^\w/-]+/g, '-')
    .replace(/\//g, '-')
    .toLowerCase()}`;

  return upsertPost({
    title,
    slugHint: slug,
    body,
    excerpt: (lesson.description || '').slice(0, 500),
    category: lesson.courseLabel || 'Courses',
    tags: [lesson.course, lesson.topicSlug, lesson.family, 'free-computer-courses', 'lesson'].filter(
      Boolean
    ),
    authorId,
  });
}

function main() {
  connectDB();
  if (!fs.existsSync(FCC_ROOT)) {
    throw new Error(`FCC_ROOT does not exist: ${FCC_ROOT}`);
  }

  const authorId = findAdminId();
  const lessons = loadLessons().filter((l) => l.course && !SKIP_COURSES.has(l.course));
  const byCourse = new Map();
  for (const lesson of lessons) {
    if (!byCourse.has(lesson.course)) byCourse.set(lesson.course, []);
    byCourse.get(lesson.course).push(lesson);
  }

  console.log(`[import] FCC root: ${FCC_ROOT}`);
  console.log(`[import] Admin author_id: ${authorId}`);
  console.log(`[import] Courses: ${byCourse.size}, lessons: ${lessons.length}${DRY_RUN ? ' (dry-run)' : ''}`);

  let created = 0;
  let updated = 0;

  if (!LESSONS_ONLY) {
    for (const [courseSlug, courseLessons] of byCourse) {
      const result = buildCoursePost(courseSlug, courseLessons, authorId);
      if (result.action === 'create') created += 1;
      else updated += 1;
      console.log(`[course] ${result.action} ${result.slug} (${courseLessons.length} lessons)`);
    }
  }

  if (INCLUDE_LESSONS || LESSONS_ONLY) {
    let i = 0;
    for (const lesson of lessons) {
      const result = buildLessonPost(lesson, authorId);
      if (result.action === 'create') created += 1;
      else updated += 1;
      i += 1;
      if (i % 100 === 0) console.log(`[lesson] processed ${i}/${lessons.length}`);
    }
    console.log(`[import] Lesson posts processed: ${lessons.length}`);
  }

  const total = getDb().prepare('SELECT COUNT(*) AS c FROM posts').get().c;
  console.log(`[import] Done. created=${created} updated=${updated} total_posts=${total}`);
}

main();
