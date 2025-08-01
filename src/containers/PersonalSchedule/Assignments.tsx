import { Competition, Person } from '@wca/helpers';
import { Fragment, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCollapse } from '@/hooks/UseCollapse';
import { useNow } from '@/hooks/useNow/useNow';
import { parseActivityCodeFlexible } from '@/lib/activityCodes';
import { isActivityWithRoomOrParent } from '@/lib/typeguards';
import { byDate, roundTime } from '@/lib/utils';
import { getRoomData, getRooms } from '../../lib/activities';
import { ExtraAssignment } from './PersonalExtraAssignment';
import { PersonalNormalAssignment } from './PersonalNormalAssignment';
import { getGroupedAssignmentsByDate } from './utils';

export interface AssignmentsProps {
  wcif: Competition;
  person: Person;
  showStationNumber: boolean;
}

const key = (compId: string, id) => `${compId}-${id}`;
export function Assignments({ wcif, person, showStationNumber }: AssignmentsProps) {
  const { t } = useTranslation();

  const showRoom = useMemo(() => wcif && getRooms(wcif).length > 1, [wcif]);

  const { collapsedDates, setCollapsedDates, toggleDate } = useCollapse(
    key(wcif.id, person.registrantId),
  );

  const now = useNow(15 * 1000);

  const scheduleDays = useMemo(() => getGroupedAssignmentsByDate(wcif, person), [person, wcif]);

  useEffect(() => {
    const today = new Date().getTime();

    const collapse: string[] = [];
    scheduleDays.forEach(({ date, assignments }) => {
      const lastActivity = [...assignments].reverse().find((a) => a.activity)?.activity;
      if (!lastActivity) {
        return;
      }

      const lastActivityEndTime = new Date(lastActivity.endTime);
      // Collapse days that are more than 4 hours old.
      if (
        today - lastActivityEndTime.getTime() > 1000 * 60 * 60 * 4 &&
        !collapsedDates.includes(date)
      ) {
        collapse.push(date);
      }
    });

    setCollapsedDates((prev) => [...prev, ...collapse]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDays]);

  const isSingleDay = scheduleDays.length === 1;

  return (
    <>
      <div className="shadow-md">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100 shadow-sm">
              <th className="py-2 text-center w-20">
                {t('competition.personalSchedule.activity')}
              </th>
              <th className="py-2 text-center">{t('competition.personalSchedule.time')}</th>
              <th className="py-2 text-center">{t('competition.personalSchedule.assignment')}</th>
              <th className="py-2 text-center">{t('competition.personalSchedule.group')}</th>
              {showRoom && (
                <th className="py-2 text-center">{t('competition.personalSchedule.stage')}</th>
              )}
              {showStationNumber && (
                <th className="py-2 text-center">{t('competition.personalSchedule.station')}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {scheduleDays.map(({ date, dateParts, assignments }) => {
              const collapsed = collapsedDates.includes(date) && scheduleDays.length > 1;

              return (
                <Fragment key={date}>
                  {!isSingleDay && (
                    <tr onClick={() => toggleDate(date)}>
                      <td
                        colSpan={6}
                        className="font-bold text-base md:text-lg bg-slate-50 select-none cursor-pointer">
                        <div className="flex justify-between">
                          <span className="p-2 w-full text-center">
                            {dateParts.find((i) => i.type === 'weekday')?.value || date}
                          </span>
                          <span className="p-2 flex-end">{collapsed ? ' ▼' : ' ▲'}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {(collapsed ? [] : assignments)
                    .sort((a, b) => byDate(a.activity, b.activity))
                    .map(({ date, assignment }, index, sortedAssignments) => {
                      const activity = assignment.activity;
                      if (!activity) {
                        return null;
                      }

                      const roundedStartTime = roundTime(new Date(activity.startTime || 0), 5);
                      const roundedEndTime = roundTime(new Date(activity.endTime || 0), 5);

                      const isOver = now > roundedEndTime;
                      const isCurrent = now > roundedStartTime && now < roundedEndTime;

                      const room =
                        'room' in activity
                          ? activity.room
                          : 'parent' in activity
                            ? activity.parent?.room
                            : undefined;
                      if (assignment.type === 'extra') {
                        return (
                          <ExtraAssignment
                            key={`${date}-${roundedStartTime.toLocaleString()}-${
                              assignment.assignmentCode
                            }`}
                            assignment={assignment}
                            isOver={isOver}
                            isCurrent={isCurrent}
                            startTime={roundedStartTime}
                            endTime={roundedEndTime}
                            room={room}
                            timeZone={wcif.schedule.venues[0]?.timezone}
                          />
                        );
                      }

                      if (assignment.activityId === undefined || assignment.activityId === null) {
                        return null;
                      }

                      if (!room) {
                        return null;
                      }

                      const { eventId, roundNumber, attemptNumber } = parseActivityCodeFlexible(
                        assignment.activity?.activityCode || '',
                      );

                      const venue = wcif?.schedule.venues?.find((v) =>
                        v.rooms.some((r) => r.id === room.id),
                      );
                      const timeZone = venue?.timezone || 'UTC';

                      const stage = getRoomData(room, activity);

                      let howManyNextAssignmentsAreSameRoundAttempt = 0;
                      for (let i = index + 1; i < sortedAssignments.length; i++) {
                        const nextAssignment = sortedAssignments[i];
                        if (!nextAssignment?.activity) {
                          break;
                        }

                        if (!isActivityWithRoomOrParent(nextAssignment.activity)) {
                          break;
                        }

                        const {
                          eventId: nextAssignmentEventId,
                          roundNumber: nextAssignmentRoundNumber,
                          attemptNumber: nextAssignmentAttemptNumber,
                        } = parseActivityCodeFlexible(nextAssignment.activity.activityCode);
                        if (
                          eventId === nextAssignmentEventId &&
                          roundNumber === nextAssignmentRoundNumber &&
                          attemptNumber === nextAssignmentAttemptNumber
                        ) {
                          howManyNextAssignmentsAreSameRoundAttempt++;
                        } else {
                          break;
                        }
                      }

                      const previousAssignment = sortedAssignments[index - 1];
                      const nextAssignment = sortedAssignments[index + 1];
                      const previousAssignmentActivityCode =
                        previousAssignment?.activity &&
                        isActivityWithRoomOrParent(previousAssignment.activity) &&
                        parseActivityCodeFlexible(previousAssignment?.activity?.activityCode);
                      const nextAssignmentActivityCode =
                        nextAssignment?.activity &&
                        isActivityWithRoomOrParent(nextAssignment.activity) &&
                        parseActivityCodeFlexible(nextAssignment?.activity?.activityCode);

                      const previousActivityIsSameRoundAttempt =
                        previousAssignmentActivityCode &&
                        previousAssignmentActivityCode?.eventId === eventId &&
                        previousAssignmentActivityCode?.roundNumber === roundNumber &&
                        previousAssignmentActivityCode?.attemptNumber === attemptNumber;

                      const nextActivityIsSameRoundAttempt =
                        nextAssignmentActivityCode &&
                        nextAssignmentActivityCode?.eventId === eventId &&
                        nextAssignmentActivityCode?.roundNumber === roundNumber &&
                        nextAssignmentActivityCode?.attemptNumber === attemptNumber;

                      const showTopBorder = !previousActivityIsSameRoundAttempt;
                      const showBottomBorder = !nextActivityIsSameRoundAttempt;

                      return (
                        <PersonalNormalAssignment
                          key={`${assignment.activityId}-${assignment.assignmentCode}`}
                          competitionId={wcif.id}
                          assignment={assignment}
                          activity={activity}
                          timeZone={timeZone}
                          room={stage}
                          isCurrent={isCurrent}
                          isOver={isOver}
                          showTopBorder={showTopBorder}
                          showBottomBorder={showBottomBorder}
                          showRoom={showRoom}
                          showStationNumber={showStationNumber}
                          rowSpan={howManyNextAssignmentsAreSameRoundAttempt}
                        />
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
