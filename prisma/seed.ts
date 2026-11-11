import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { config } from '../src/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { LocalStorageDriver } from '../src/storage/local.driver';
import { S3StorageDriver } from '../src/storage/s3.driver';
import { StorageService } from '../src/storage/storage.service';
import type { FieldInput } from '../src/templates/template.schema';

const prisma = new PrismaService();
const storage = new StorageService(config.storage.driver === 's3' ? new S3StorageDriver() : new LocalStorageDriver());

const scale = { min: 1, max: 7, labels: { '1': 'Poor', '7': 'Excellent' } };

function axis(key: string, label: string, helpText: string, noun: string): FieldInput[] {
  return [
    { key, label, helpText, type: 'SCALE', scope: 'PER_RESPONSE', required: true, config: scale },
    {
      key: `${key}_explanation`,
      label: `${label}: explanation`,
      helpText: null,
      type: 'TEXTAREA',
      scope: 'PER_RESPONSE',
      required: true,
      config: { minChars: 40, maxChars: 2000, placeholder: `Briefly explain the ${noun} score` },
    },
  ];
}

const defaultRubric: FieldInput[] = [
  { key: 'individual_rating', label: 'Individual Rating', helpText: null, type: 'SECTION', scope: 'PER_RESPONSE', required: false, config: {} },
  ...axis(
    'content_quality',
    'Content quality',
    'How complete, accurate and useful the content is, including whether it covers the key concepts from the source material without misleading omissions, inaccuracies or irrelevant additions.',
    'content quality',
  ),
  ...axis(
    'storytelling',
    'Storytelling',
    'How well the deck flows as a cohesive narrative, with clear transitions, logical or emotional build-up, and a structure that feels engaging rather than like a list of disconnected facts.',
    'storytelling',
  ),
  ...axis(
    'writing_style',
    'Writing style',
    'How clear, concise, specific and natural the language is. Generic, inflated, repetitive, buzzword-heavy or formulaic language is penalised.',
    'writing style',
  ),
  ...axis(
    'aesthetics',
    'Aesthetics',
    'How polished and visually appealing the deck feels overall, including typography, colour use, visual consistency, visual variety, and the quality of charts, diagrams, images and other visual elements.',
    'aesthetics',
  ),
  ...axis(
    'layout',
    'Layout',
    'How text, visuals, headers, charts and other elements are arranged within each slide and across the deck, including spacing, alignment, grouping, hierarchy, and avoidance of clutter or overlap.',
    'layout',
  ),
  ...axis('overall', 'Overall', 'Now, using all the above elements as guidance, please give the artifact an overall rating.', 'overall'),
  { key: 'ranking', label: 'Overall Ranking', helpText: 'Rank the responses from best to worst. Each response can only be used once.', type: 'RANKING', scope: 'PER_TASK', required: true, config: {} },
  {
    key: 'ranking_rationale',
    label: 'What drove the ranking? Note ties or close calls.',
    helpText: null,
    type: 'TEXTAREA',
    scope: 'PER_TASK',
    required: true,
    config: { minChars: 40, maxChars: 3000, placeholder: 'What separated the responses?' },
  },
];

const PALETTE: Record<string, string> = { A: '#2F6B4F', B: '#2B4C7E', C: '#8A4B2C' };

async function placeholderSlide(label: string, index: number): Promise<Buffer> {
  const color = PALETTE[label];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    <rect width="1920" height="1080" fill="#ffffff"/>
    <rect x="0" y="0" width="1920" height="16" fill="${color}"/>
    <text x="120" y="220" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="700" fill="#18181B">Response ${label}</text>
    <text x="120" y="330" font-family="Helvetica, Arial, sans-serif" font-size="56" fill="#52525B">Placeholder slide ${index}</text>
    <rect x="120" y="440" width="${500 + index * 200}" height="40" rx="8" fill="${color}" opacity="0.85"/>
    <rect x="120" y="520" width="${900 - index * 120}" height="40" rx="8" fill="${color}" opacity="0.5"/>
    <rect x="120" y="600" width="${700 + index * 60}" height="40" rx="8" fill="${color}" opacity="0.3"/>
    <text x="1800" y="1020" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="36" fill="#A1A1AA">${index}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function seedUser(email: string, name: string, role: 'ADMIN' | 'REVIEWER' | 'RATER', password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    create: { email, name, role, passwordHash },
    update: { role, passwordHash, name },
  });
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@deckeval.local').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';
  const userPassword = process.env.SEED_USER_PASSWORD ?? 'password123';

  const admin = await seedUser(adminEmail, 'Admin', 'ADMIN', adminPassword);
  await seedUser('reviewer@deckeval.local', 'Riley Reviewer', 'REVIEWER', userPassword);
  await seedUser('rater1@deckeval.local', 'Rae Rater', 'RATER', userPassword);
  await seedUser('rater2@deckeval.local', 'Sam Rater', 'RATER', userPassword);

  const existing = await prisma.project.findFirst({ where: { name: 'Slides Eval' } });
  if (existing) {
    console.log('Seed data already present, users refreshed.');
    return;
  }

  const template = await prisma.rubricTemplate.create({
    data: {
      name: 'Slides Eval default',
      fields: {
        create: defaultRubric.map((f, order) => ({ ...f, order, config: f.config as object })),
      },
    },
  });
  const project = await prisma.project.create({ data: { name: 'Slides Eval', templateId: template.id } });

  const tags = await Promise.all(
    [
      { name: 'Finance', color: '#2B4C7E' },
      { name: 'Education', color: '#2F6B4F' },
      { name: 'Urgent', color: '#B91C1C' },
    ].map((t) => prisma.tag.upsert({ where: { name: t.name }, create: t, update: {} })),
  );

  const task = await prisma.task.create({
    data: {
      title: 'Quarterly results deck for a regional bakery chain',
      projectId: project.id,
      priority: 2,
      status: 'PUBLISHED',
      ratersNeeded: 2,
      templateVersionId: template.id,
      createdById: admin.id,
      instructions:
        '<p>Read the user request and input files first. Then review each response deck slide by slide.</p><p><strong>Rate each response independently.</strong> Do not compare responses in the per-response boxes; save comparisons for the ranking.</p>',
      userRequest:
        '<p>Make me a 10-slide deck summarising our Q3 results for the board. Keep it visual, call out the two new shops, and end with what we plan for Q4.</p>',
      tags: { create: [{ tagId: tags[0].id }, { tagId: tags[2].id }] },
    },
  });

  for (const [order, label] of ['A', 'B', 'C'].entries()) {
    const response = await prisma.response.create({ data: { taskId: task.id, label, order } });
    for (let i = 1; i <= 3; i++) {
      const png = await placeholderSlide(label, i);
      const meta = await sharp(png).metadata();
      const web = await sharp(png).resize({ width: config.limits.webImageWidth }).webp({ quality: 85 }).toBuffer();
      const storageKey = storage.newKey(`tasks/${task.id}/responses/${response.id}`, `slide${i}.png`);
      const webKey = storage.newKey(`tasks/${task.id}/responses/${response.id}`, 'web.webp', '-web');
      await storage.putObject(storageKey, png, 'image/png');
      await storage.putObject(webKey, web, 'image/webp');
      await prisma.slide.create({
        data: { responseId: response.id, order: i - 1, storageKey, webKey, width: meta.width ?? 1920, height: meta.height ?? 1080 },
      });
    }
  }

  console.log(`Seeded project "${project.name}", template ${template.id} and sample task ${task.id}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
