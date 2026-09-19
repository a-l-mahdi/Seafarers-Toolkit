import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AppNotification,
  Contract,
  CvProfile,
  Document,
  DocumentFile,
  LeaveSettings,
  Profile,
  Rank,
  SeaTimeRecord,
  Vessel,
} from '@/types/domain';
import * as RanksRepo from '@/database/repositories/ranks-repository';
import * as ProfileRepo from '@/database/repositories/profile-repository';
import * as CvRepo from '@/database/repositories/cv-repository';
import * as VesselsRepo from '@/database/repositories/vessels-repository';
import * as SeaTimeRepo from '@/database/repositories/sea-time-repository';
import * as DocumentsRepo from '@/database/repositories/documents-repository';
import * as NotificationsRepo from '@/database/repositories/notifications-repository';
import * as TripFilesRepo from '@/database/repositories/trip-files-repository';
import { clearDeliveredForDocument, resyncDocumentNotifications } from '@/services/notification-service';
import type { ContractListRow, DocumentListRow } from '@/database/repositories';

export const queryKeys = {
  profile: ['profile'] as const,
  cvProfile: ['cv-profile'] as const,
  ranks: ['ranks'] as const,
  vessels: ['vessels'] as const,
  contracts: ['contracts'] as const,
  documents: ['documents'] as const,
  documentTypes: ['document-types'] as const,
  documentFiles: (id: string) => ['document-files', id] as const,
  seaTime: ['sea-time'] as const,
  seaTimeRecords: ['sea-time-records'] as const,
  leaveSettings: ['leave-settings'] as const,
  notifications: ['notifications'] as const,
  tripFiles: (key: string) => ['trip-files', key] as const,
};

export function useProfile() {
  return useQuery({ queryKey: queryKeys.profile, queryFn: ProfileRepo.getProfile });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Profile, 'id' | 'updatedAt'>) => ProfileRepo.saveProfile(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.profile }),
  });
}

export function useCvProfile() {
  return useQuery({ queryKey: queryKeys.cvProfile, queryFn: CvRepo.getCvProfile });
}

export function useSaveCvProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CvProfile) => CvRepo.saveCvProfile(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cvProfile }),
  });
}

export function useRanks() {
  return useQuery({ queryKey: queryKeys.ranks, queryFn: RanksRepo.listRanks });
}

export function useCreateRank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { department: Rank['department']; name: string; level: number; promotionMonths?: number | null }) =>
      RanksRepo.createRank(input.department, input.name, input.level, input.promotionMonths ?? 12),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ranks }),
  });
}

export function useUpdateRank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rank: Rank) => RanksRepo.updateRank(rank),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ranks }),
  });
}

export function useMoveRank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dir }: { id: string; dir: -1 | 1 }) => RanksRepo.moveRank(id, dir),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ranks }),
  });
}

export function useDeleteRank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => RanksRepo.deleteRank(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ranks });
      qc.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

/** Promotion sea time (days) for the sailor's current rank. */
export function usePromotionDays(rankId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.ranks, 'promotion-days', rankId],
    queryFn: () => RanksRepo.getPromotionDaysFor(rankId, 365),
    enabled: rankId !== undefined,
  });
}

export function useVessels() {
  return useQuery({ queryKey: queryKeys.vessels, queryFn: () => VesselsRepo.listVessels() });
}

export function useSaveVessel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Vessel, 'id' | 'createdAt'> & { id?: string }) =>
      VesselsRepo.saveVessel(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vessels });
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
    },
  });
}

export function useDeleteVessel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => VesselsRepo.deleteVessel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vessels });
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
    },
  });
}

export function useContracts() {
  return useQuery({ queryKey: queryKeys.contracts, queryFn: VesselsRepo.listContracts });
}

export function useSaveContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) =>
      VesselsRepo.saveContract(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
      qc.invalidateQueries({ queryKey: queryKeys.seaTime });
    },
  });
}

export function useSignOffContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      VesselsRepo.signOffContract(id, date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
      qc.invalidateQueries({ queryKey: queryKeys.seaTime });
    },
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => VesselsRepo.deleteContract(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
      qc.invalidateQueries({ queryKey: queryKeys.seaTime });
    },
  });
}

export function useDocuments() {
  return useQuery({ queryKey: queryKeys.documents, queryFn: () => DocumentsRepo.listDocuments() });
}

export function useSaveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Document, 'id' | 'createdAt'> & { id?: string }) =>
      DocumentsRepo.saveDocument(input),
    onSuccess: async () => {
      // Reconcile reminders immediately so a just-added expired / in-window doc alerts now.
      await resyncDocumentNotifications();
      qc.invalidateQueries({ queryKey: queryKeys.documents });
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => DocumentsRepo.deleteDocument(id),
    onSuccess: async () => {
      await resyncDocumentNotifications();
      qc.invalidateQueries({ queryKey: queryKeys.documents });
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useDocumentTypes() {
  return useQuery({ queryKey: queryKeys.documentTypes, queryFn: DocumentsRepo.listDocumentTypes });
}

export function useCreateDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => DocumentsRepo.createDocumentType(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.documentTypes }),
  });
}

export function useDeleteDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => DocumentsRepo.deleteDocumentType(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.documentTypes });
      void qc.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });
}

export function useDocumentFiles(documentId: string | null) {
  return useQuery({
    queryKey: queryKeys.documentFiles(documentId ?? 'none'),
    queryFn: () => DocumentsRepo.listDocumentFiles(documentId!),
    enabled: !!documentId,
  });
}

export function useAddDocumentFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: Omit<DocumentFile, 'id' | 'createdAt'>) =>
      DocumentsRepo.saveDocumentFile(file),
    onSuccess: (_data, file) => {
      qc.invalidateQueries({ queryKey: queryKeys.documentFiles(file.documentId) });
    },
  });
}

export function useDeleteDocumentFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; documentId: string }) => DocumentsRepo.deleteDocumentFile(id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.documentFiles(vars.documentId) });
    },
  });
}

export function useSeaTimeSummary() {
  return useQuery({
    queryKey: queryKeys.seaTime,
    queryFn: async () => {
      const [contracts, ranks] = await Promise.all([VesselsRepo.listContracts(), RanksRepo.listRanks()]);
      const rankNames = new Map(ranks.map((r) => [r.id, r.name]));
      // listRanks is ordered by department → level → name, so the array index is
      // the seniority order (senior first). byRank then follows the hierarchy.
      const rankOrder = new Map(ranks.map((r, i) => [r.id, i]));
      return SeaTimeRepo.getSeaTimeSummary(contracts, rankNames, rankOrder);
    },
  });
}

export function useSeaTimeRecords() {
  return useQuery({ queryKey: queryKeys.seaTimeRecords, queryFn: SeaTimeRepo.listSeaTimeRecords });
}

export function useSaveSeaTimeRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Omit<SeaTimeRecord, 'id' | 'createdAt'> & { id?: string }
    ) => SeaTimeRepo.saveSeaTimeRecord(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seaTimeRecords });
      qc.invalidateQueries({ queryKey: queryKeys.seaTime });
    },
  });
}

export function useDeleteSeaTimeRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => SeaTimeRepo.deleteSeaTimeRecord(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seaTimeRecords });
      qc.invalidateQueries({ queryKey: queryKeys.seaTime });
    },
  });
}

export function useLeaveSettings() {
  return useQuery({ queryKey: queryKeys.leaveSettings, queryFn: RanksRepo.getLeaveSettings });
}

export function useSaveLeaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: LeaveSettings) => RanksRepo.saveLeaveSettings(settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.leaveSettings }),
  });
}

export function useNotifications() {
  return useQuery({ queryKey: queryKeys.notifications, queryFn: () => NotificationsRepo.listNotifications() });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => NotificationsRepo.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

/** When a document's alert page opens: mark its notifications read (they stay in
 *  the list, ticked) and clear its banners from the status bar. */
export function useMarkDocumentNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      await NotificationsRepo.markReadForDocument(documentId);
      await clearDeliveredForDocument(documentId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => NotificationsRepo.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => NotificationsRepo.dismiss(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useTripFiles(filter: { contractId?: string | null; seaTimeId?: string | null; kind?: TripFilesRepo.TripFileKind }) {
  const key = `${filter.contractId ?? ''}|${filter.seaTimeId ?? ''}|${filter.kind ?? ''}`;
  return useQuery({
    queryKey: queryKeys.tripFiles(key),
    queryFn: () =>
      TripFilesRepo.listTripFiles({
        contractId: filter.contractId ?? undefined,
        seaTimeId: filter.seaTimeId ?? undefined,
        kind: filter.kind,
      }),
  });
}

export function useAddTripFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: Omit<TripFilesRepo.TripFile, 'id' | 'createdAt'>) =>
      TripFilesRepo.saveTripFile(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip-files'] });
    },
  });
}

export function useDeleteTripFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => TripFilesRepo.deleteTripFile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip-files'] });
    },
  });
}

export type { ContractListRow, DocumentListRow };
export type { AppNotification };
