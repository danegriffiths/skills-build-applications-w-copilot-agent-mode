import { isValidObjectId } from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function badRequest(message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = 400;
  return error;
}

function parseObjectId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && isValidObjectId(trimmed) ? trimmed : null;
}

export async function listActivities() {
  return Activity.find().sort({ occurredAt: -1 }).lean();
}

export async function createActivity(input: unknown) {
  if (!isRecord(input)) throw badRequest('Activity payload is required.');

  const userId = parseObjectId(input.userId);
  const teamId = parseObjectId(input.teamId);
  const type = typeof input.type === 'string' ? input.type.trim() : '';
  const minutes = Number(input.minutes);

  if (!userId || !teamId) throw badRequest('userId and teamId are required.');
  if (!type || !Number.isFinite(minutes) || minutes <= 0) throw badRequest('Type and minutes must be valid.');
  if (!(await User.exists({ _id: userId }))) throw badRequest('User not found.');
  if (!(await Team.exists({ _id: teamId }))) throw badRequest('Team not found.');

  const activity = await Activity.create({
    user: userId,
    team: teamId,
    type,
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });

  return activity.toObject();
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!isRecord(input)) throw badRequest('Team payload is required.');

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const mascot = typeof input.mascot === 'string' ? input.mascot.trim() : '';

  if (!name) throw badRequest('Team name is required.');
  if (!mascot) throw badRequest('Team mascot is required.');

  const members = Array.isArray(input.members)
    ? input.members
        .map((member) => parseObjectId(member))
        .filter((member): member is string => Boolean(member))
    : [];

  const team = await Team.create({ name, mascot, members });
  return team.toObject();
}

export async function getLeaderboard() {
  const teams = await Team.find().lean();
  const totals = await Activity.aggregate([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
  ]);

  const totalsByTeam = new Map<string, number>();
  for (const entry of totals) {
    totalsByTeam.set(String(entry._id), Number(entry.totalPoints) || 0);
  }

  const leaderboard = teams
    .map((team) => ({
      teamName: team.name,
      totalPoints: totalsByTeam.get(String(team._id)) ?? 0,
      rank: 0,
    }))
    .filter((entry) => entry.totalPoints > 0)
    .sort((left, right) => right.totalPoints - left.totalPoints || left.teamName.localeCompare(right.teamName));

  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return leaderboard;
}

export async function suggestWorkouts(userEmail: string) {
  const email = typeof userEmail === 'string' ? userEmail.trim() : '';
  if (!email) {
    throw badRequest('A user email is required.');
  }

  const user = await User.findOne({ email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }).lean();
  if (!user) {
    const error = new Error('User not found.');
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  const recentActivities = await Activity.find({ user: user._id }).sort({ occurredAt: -1 }).limit(10).lean();
  const activityTypeCounts = new Map<string, number>();
  for (const activity of recentActivities) {
    const type = typeof activity.type === 'string' ? activity.type.trim() : '';
    if (!type) continue;
    activityTypeCounts.set(type, (activityTypeCounts.get(type) ?? 0) + 1);
  }

  const primaryType = [...activityTypeCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  const preferredFocus = typeof user.fitnessGoal === 'string' && user.fitnessGoal.trim() ? user.fitnessGoal.trim() : primaryType;
  const focusCandidates = [...new Set([preferredFocus, primaryType].filter(Boolean))];

  let workouts = await Workout.find({ focus: { $in: focusCandidates } }).lean();
  if (workouts.length === 0) {
    workouts = await Workout.find().lean();
  }

  return workouts
    .sort((left, right) => Number(left.minutes) - Number(right.minutes))
    .slice(0, 3)
    .map((workout) => ({
      title: workout.title,
      focus: workout.focus,
      minutes: workout.minutes,
      difficulty: workout.difficulty,
      reason: `Matches your ${preferredFocus} goal and recent ${primaryType ?? 'activity'} patterns.`,
    }));
}

export { User };
