import type { AnswerMap, RubricFieldDef } from './rubric';

export type Role = 'ADMIN' | 'REVIEWER' | 'RATER';
export type TaskStatus = 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
export type SubStatus = 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export interface TagDTO {
  id: string;
  name: string;
  color: string;
}

export interface FileDTO {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
}

export interface SlideDTO {
  id: string;
  order: number;
  caption: string | null;
  width: number;
  height: number;
  url: string;
  originalUrl: string;
}

export interface ResponseDTO {
  id: string;
  label: string;
  order: number;
  slides: SlideDTO[];
  files: FileDTO[];
}

export interface TaskSummaryDTO {
  id: string;
  title: string;
  priority: number;
  status: TaskStatus;
  dueAt: string | null;
  projectId: string;
  projectName: string;
  tags: TagDTO[];
  responseCount: number;
  ratersNeeded: number;
  submissionCount: number;
  updatedAt: string;
}

export interface TaskDetailDTO extends TaskSummaryDTO {
  instructions: string;
  userRequest: string;
  templateVersionId: string;
  inputFiles: FileDTO[];
  responses: ResponseDTO[];
  assigneeIds: string[];
  openQueue: boolean;
}

export interface ReviewCommentDTO {
  id: string;
  fieldId: string;
  responseId: string | null;
  body: string;
  suggestedValue: unknown;
  reviewerName: string | null;
  createdAt: string;
  draft: boolean;
}

export interface SubmissionDTO {
  id: string;
  status: SubStatus;
  activeSeconds: number;
  submittedAt: string | null;
  answers: AnswerMap;
  comments: ReviewCommentDTO[];
  raterName: string | null;
  raterEmail: string;
}

export interface WorkspaceDTO {
  task: TaskDetailDTO;
  fields: RubricFieldDef[];
  submission: SubmissionDTO | null;
  readOnly: boolean;
}

export interface DashboardItemDTO {
  task: TaskSummaryDTO;
  submissionId: string | null;
  submissionStatus: SubStatus | null;
  progress: { done: number; total: number } | null;
}

export interface DashboardDTO {
  next: TaskSummaryDTO | null;
  returned: DashboardItemDTO[];
  inProgress: DashboardItemDTO[];
  completed: DashboardItemDTO[];
}

export interface TemplateDTO {
  id: string;
  name: string;
  version: number;
  parentId: string | null;
  fields: RubricFieldDef[];
  submissionCount: number;
  projectNames: string[];
}

export interface ProjectDTO {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  templateVersion: number;
  taskCount: number;
}

export interface UserDTO extends SessionUser {
  active: boolean;
  createdAt: string;
}

export interface ReviewQueueItemDTO {
  submissionId: string;
  taskId: string;
  taskTitle: string;
  projectName: string;
  raterId: string;
  raterName: string | null;
  raterEmail: string;
  submittedAt: string | null;
  status: SubStatus;
  tags: TagDTO[];
}

export interface StatsDTO {
  tasksByStatus: Record<TaskStatus, number>;
  awaitingReview: number;
  avgActiveSeconds: number;
  perRater: Array<{ userId: string; name: string | null; email: string; submitted: number; approved: number; returned: number }>;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface UserTaskDTO {
  submissionId: string;
  taskId: string;
  taskTitle: string;
  projectName: string;
  priority: number;
  status: SubStatus;
  submittedAt: string | null;
  updatedAt: string;
  activeSeconds: number;
}

export interface UserDetailDTO {
  user: UserDTO;
  counts: Record<SubStatus, number>;
  totalActiveSeconds: number;
  tasks: UserTaskDTO[];
}
