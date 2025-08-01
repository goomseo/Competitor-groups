import { InfiniteData, useQuery } from '@tanstack/react-query';
import { Competition } from '@wca/helpers';
import { fetchWcif, UserCompsResponse } from '@/lib/api';
import { queryClient } from '@/providers/QueryProvider';

export const useWcif = (competitionId?: string) =>
  useQuery<Competition>({
    queryKey: ['wcif', competitionId],
    queryFn: () => {
      return fetchWcif(competitionId!);
    },
    // staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    // refetchInterval: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    networkMode: 'always',
    refetchOnReconnect: true,
    placeholderData: () => {
      const upcomingComps =
        queryClient
          .getQueryData<InfiniteData<CondensedApiCompetiton[]>>(['upcomingCompetitions'])
          ?.pages?.flat() || [];
      const myUpcomingComps = queryClient?.getQueryData<UserCompsResponse>(['userCompetitions']);

      const allComps = [
        ...upcomingComps,
        ...(myUpcomingComps?.upcoming_competitions || []),
        ...(myUpcomingComps?.ongoing_competitions || []),
      ];

      const comp = allComps.find((c) => c.id === competitionId);

      if (!comp) {
        return;
      }

      return {
        id: comp.id,
        name: comp.name,
        formatVersion: '1.0',
        shortName: comp.short_name,
        events: [],
        persons: [],
        schedule: {
          numberOfDays: 1,
          startDate: '',
          venues: [],
        },
        competitorLimit: 0,
        extensions: [],
      };
    },
    initialDataUpdatedAt: () => {
      return queryClient.getQueryState(['wcif', competitionId])?.dataUpdatedAt;
    },
    enabled: !!competitionId,
  });
