import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AppNotification,
  ChecklistItem,
  Contract,
  CvProfile,
  Document,
  DocumentFile,
  LeaveSettings,
  Profile,
  Rank,
  SeaTimeRecord,
  TripChecklistMark,
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
import * as ChecklistRepo from '@/database/repositories/checklist-repository';
import * as NotesRepo from '@/database/repositories/calendar-notes-repository';
import {
  clearDeliveredForContract,
  clearDeliveredForDocument,
  resyncDocumentNotifications,
  resyncNotifications,
} from '@/services/notification-service';
import type { ContractListRow, DocumentListRow } from '@/database/repositories';
import type { DocumentSort } from '@/domain/document-sort';

export const queryKeys = {
  profile: ['profile'] as const,
  cvProfile: ['cv-profile'] as const,
  ranks: ['ranks'] as const,
  vessels: ['vessels'] as const,
  contracts: ['contracts'] as const,
  documents: ['documents'] as const,
  documentSort: ['document-sort'] as const,
  documentTypes: ['document-types'] as const,
  documentFiles: (id: string) => ['document-files', id] as const,
  seaTime: ['sea-time'] as const,
  seaTimeRecords: ['sea-time-records'] as const,
  leaveSettings: ['leave-settings'] as const,
  notifications: ['notifications'] as const,
  tripFiles: (key: string) => ['trip-files', key] as const,
  checklist: ['checklist'] as const,
  calendarNotes: ['calendar-notes'] as const,
  tripChecklist: (contractId: string) => ['trip-checklist', contractId] as const,
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
    mutationFn: (input: {
      department: Rank['department'];
      name: string;
      level: number;
      promotionMonths?: number | null;
    }) => RanksRepo.createRank(input.department, input.name, input.level, input.promotionMonths ?? 12),
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

export function useUpdateRankInsignia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, insignia }: { id: string; insignia: Rank['insignia'] }) =>
      RanksRepo.updateRankInsignia(id, insignia),
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
    mutationFn: (input: Omit<Vessel, 'id' | 'createdAt'> & { id?: string }) => VesselsRepo.saveVessel(input),
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
      // Trip reminders follow the dates; a signed-off trip's checklist is dropped.
      // Rescheduling reminders can take seconds: do it in the background so saving returns at once.
      void resyncNotifications().then(() => {
        qc.invalidateQueries({ queryKey: queryKeys.notifications });
        qc.invalidateQueries({ queryKey: ['trip-checklist'] });
      });
    },
  });
}

export function useSignOffContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => VesselsRepo.signOffContract(id, date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
      qc.invalidateQueries({ queryKey: queryKeys.seaTime });
      // Trip reminders follow the dates; a signed-off trip's checklist is dropped.
      // Rescheduling reminders can take seconds: do it in the background so saving returns at once.
      void resyncNotifications().then(() => {
        qc.invalidateQueries({ queryKey: queryKeys.notifications });
        qc.invalidateQueries({ queryKey: ['trip-checklist'] });
      });
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
      // Trip reminders follow the dates; a signed-off trip's checklist is dropped.
      // Rescheduling reminders can take seconds: do it in the background so saving returns at once.
      void resyncNotifications().then(() => {
        qc.invalidateQueries({ queryKey: queryKeys.notifications });
        qc.invalidateQueries({ queryKey: ['trip-checklist'] });
      });
    },
  });
}

export function useDocuments() {
  return useQuery({ queryKey: queryKeys.documents, queryFn: () => DocumentsRepo.listDocuments() });
}

export function useDocumentSort() {
  return useQuery({ queryKey: queryKeys.documentSort, queryFn: RanksRepo.getDocumentSort, staleTime: Infinity });
}

/** Saves the list order; the cache updates at once so the button and list respond instantly. */
export function useSaveDocumentSort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sort: DocumentSort) => RanksRepo.saveDocumentSort(sort),
    onMutate: (sort) => {
      qc.setQueryData(queryKeys.documentSort, sort);
    },
    onError: () => qc.invalidateQueries({ queryKey: queryKeys.documentSort }),
  });
}

export function useSaveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Document, 'id' | 'createdAt'> & { id?: string }) => DocumentsRepo.saveDocument(input),
    onSuccess: () => {
      // Reconcile reminders right away so a just-added expired / in-window doc alerts now.
      qc.invalidateQueries({ queryKey: queryKeys.documents });
      // Rescheduling reminders can take seconds: do it in the background so saving returns at once.
      void resyncDocumentNotifications().then(() => qc.invalidateQueries({ queryKey: queryKeys.notifications }));
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => DocumentsRepo.deleteDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents });
      // Rescheduling reminders can take seconds: do it in the background so saving returns at once.
      void resyncDocumentNotifications().then(() => qc.invalidateQueries({ queryKey: queryKeys.notifications }));
    },
  });
}

export function useDocumentTypes() {
  return useQuery({ queryKey: queryKeys.documentTypes, queryFn: DocumentsRepo.listDocumentTypes });
}

export function useCreateDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { name: string; icon: string | null; color: string | null }) =>
      typeof input === 'string'
        ? DocumentsRepo.createDocumentType(input)
        : DocumentsRepo.createDocumentType(input.name, input.icon, input.color),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.documentTypes }),
  });
}

export function useUpdateDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name: string; icon: string | null; color: string | null }) =>
      DocumentsRepo.updateDocumentType(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.documentTypes });
      void qc.invalidateQueries({ queryKey: queryKeys.documents });
    },
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
    mutationFn: (file: Omit<DocumentFile, 'id' | 'createdAt'>) => DocumentsRepo.saveDocumentFile(file),
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
    mutationFn: (input: Omit<SeaTimeRecord, 'id' | 'createdAt'> & { id?: string }) =>
      SeaTimeRepo.saveSeaTimeRecord(input),
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

export function useTripFiles(filter: {
  contractId?: string | null;
  seaTimeId?: string | null;
  kind?: TripFilesRepo.TripFileKind;
}) {
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
    mutationFn: (file: Omit<TripFilesRepo.TripFile, 'id' | 'createdAt'>) => TripFilesRepo.saveTripFile(file),
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

/** Opening a trip reminder marks that contract's reminders read and clears its banners. */
export function useMarkContractNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string) => {
      await NotificationsRepo.markReadForContract(contractId);
      await clearDeliveredForContract(contractId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useChecklistItems() {
  return useQuery({ queryKey: queryKeys.checklist, queryFn: ChecklistRepo.listChecklistItems });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { parentId: string | null; name: string; quantity: number }) =>
      ChecklistRepo.addChecklistItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checklist }),
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name: string | null; quantity: number }) =>
      ChecklistRepo.updateChecklistItem(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checklist }),
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ChecklistRepo.deleteChecklistItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.checklist });
      qc.invalidateQueries({ queryKey: ['trip-checklist'] });
    },
  });
}

export function useTripChecklist(contractId: string | null) {
  return useQuery({
    queryKey: queryKeys.tripChecklist(contractId ?? 'none'),
    queryFn: () => ChecklistRepo.listTripChecklist(contractId!),
    enabled: !!contractId,
  });
}

type TripMarksInput = { itemKeys: string[]; column: 'out' | 'back'; packed: boolean };

/** Ticks / unticks entries of a trip. The cache changes on the tap itself (so ticks are instant);
 *  the database writes follow in the background, one after another. */
export function useSetTripChecklistMarks(contractId: string) {
  const qc = useQueryClient();
  const key = queryKeys.tripChecklist(contractId);
  const write = useMutation({
    mutationFn: (input: TripMarksInput) =>
      ChecklistRepo.setTripChecklistMarks(contractId, input.itemKeys, input.column, input.packed),
    // Rolling back to a snapshot would also undo later taps; reload what was stored instead.
    onError: () => qc.invalidateQueries({ queryKey: key }),
  });
  const mutate = (input: TripMarksInput) => {
    // A refetch still in flight would land an older state over this tap.
    void qc.cancelQueries({ queryKey: key });
    const prev = qc.getQueryData<TripChecklistMark[]>(key) ?? [];
    const next = new Map(prev.map((m) => [m.itemKey, m]));
    for (const itemKey of input.itemKeys) {
      const m = next.get(itemKey) ?? { itemKey, packedOut: false, packedBack: false };
      next.set(
        itemKey,
        input.column === 'out' ? { ...m, packedOut: input.packed } : { ...m, packedBack: input.packed },
      );
    }
    qc.setQueryData(key, [...next.values()]);
    write.mutate(input);
  };
  return { mutate };
}

export function useCalendarNotes() {
  return useQuery({ queryKey: queryKeys.calendarNotes, queryFn: NotesRepo.listCalendarNotes });
}

/** Saves a note and (re)schedules its reminder before resolving. */
export function useSaveCalendarNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Parameters<typeof NotesRepo.saveCalendarNote>[0]) => {
      const note = await NotesRepo.saveCalendarNote(input);
      void resyncNotifications().then(() => qc.invalidateQueries({ queryKey: queryKeys.notifications }));
      return note;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendarNotes });
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useDeleteCalendarNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await NotesRepo.deleteCalendarNote(id);
      void resyncNotifications().then(() => qc.invalidateQueries({ queryKey: queryKeys.notifications }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendarNotes });
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export type { ContractListRow, DocumentListRow };
export type { ChecklistItem };
export type { AppNotification };
