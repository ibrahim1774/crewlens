export type Tier = 'solo' | 'pro' | 'crew';
export type JobStatus = 'active' | 'archived';
export type SyncState = 'pending' | 'uploading' | 'synced' | 'failed';
export type MediaKind = 'photo' | 'video';

export interface Company {
  id: string;
  name: string;
  trade: string;
  tier: Tier;
  seats: number;
  createdAt: string;
}

export interface Member {
  userId: string;
  companyId: string;
  role: 'owner' | 'member';
  displayName: string;
  initials: string;
}

export interface Job {
  id: string;
  companyId: string;
  name: string;
  address: string;
  clientName: string | null;
  lat: number | null;
  lng: number | null;
  status: JobStatus;
  coverPhotoId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  /** Derived from photos. */
  coverUri: string | null;
  lastPhotoAt: string | null;
  photoCount: number;
  pendingCount: number;
  /** True once the project row exists in Supabase. */
  remote: boolean;
  /** Local changes not yet pushed. Server rows never overwrite a dirty job. */
  dirty: boolean;
  syncError: string | null;
}

export interface Photo {
  id: string;
  jobId: string;
  companyId: string;
  takerId: string;
  takerInitials: string;
  kind: MediaKind;
  localUri: string | null;
  localThumbUri: string | null;
  storagePath: string | null;
  thumbPath: string | null;
  width: number;
  height: number;
  durationS: number | null;
  takenAt: string;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  syncState: SyncState;
  attempts: number;
  lastError: string | null;
  uploadingSince: string | null;
  nextAttemptAt: string | null;
}

export interface ShareLink {
  id: string;
  companyId: string;
  jobId: string;
  type: 'live' | 'gallery';
  token: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export type DocKind = 'pdf' | 'image';
export type SentVia = 'text' | 'email' | 'share';

/** A PDF or image kept next to a job's photos: invoice, proposal, contract, permit. Pro and Crew. */
export interface Doc {
  id: string;
  jobId: string;
  companyId: string;
  name: string;
  kind: DocKind;
  localUri: string | null;
  storagePath: string | null;
  sizeBytes: number | null;
  pages: number | null;
  version: number;
  createdBy: string;
  sentTo: string | null;
  sentVia: SentVia | null;
  sentAt: string | null;
  syncState: 'pending' | 'synced' | 'failed';
  createdAt: string;
  updatedAt: string;
}
