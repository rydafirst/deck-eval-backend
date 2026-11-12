import type { FieldInput } from '../templates/template.schema';

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

export const DEFAULT_RUBRIC: FieldInput[] = [
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

export const DEFAULT_PROJECT_NAME = 'Slides Eval';
export const DEFAULT_RUBRIC_NAME = 'Slides Eval default';
