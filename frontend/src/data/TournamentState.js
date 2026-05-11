import { IPL_ROSTER } from './IPLRoster.js';
import { config } from '../config.js';

const STORAGE_KEY = 'cricket_tournament_state';

export class TournamentState {
  constructor() {
    this.data = this.load();
  }

  load() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return null;
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  init(userTeamId) {
    const teams = IPL_ROSTER.teams;
    const fixtures = this.generateFixtures(teams);
    
    // Initialize Stats for all players
    const stats = {};
    teams.forEach(team => {
      team.players.forEach(player => {
        stats[player.name] = {
          name: player.name,
          teamId: team.id,
          batting: { matches: 0, innings: 0, runs: 0, highScore: 0, ballsFaced: 0, fifties: 0, hundreds: 0, fours: 0, sixes: 0, lastFive: [] },
          bowling: { matches: 0, overs: 0, balls: 0, wickets: 0, runsConceded: 0, bestFigures: { w: 0, r: 0 } }
        };
      });
    });

    this.data = {
      userTeamId,
      fixtures,
      currentMatchIndex: 0,
      stats,
      isKnockouts: false,
      knockoutFixtures: [],
      winner: null
    };

    // Auto-simulate until the first user match
    this.simulateUntilUserMatch();
    this.save();
  }

  generateFixtures(teams) {
    const teamIds = teams.map(t => t.id);
    const n = teamIds.length;
    const matchesPerTeam = config.tournamentSettings.matchesPerTeam;
    const roundsCount = matchesPerTeam;
    const matchesPerRound = n / 2;
    
    const teamMatches = {};
    teamIds.forEach(id => teamMatches[id] = 0);

    const groupA = teamIds.slice(0, 5);
    const groupB = teamIds.slice(5, 10);
    
    const finalFixtures = [];
    
    // Play same group twice
    const addSameGroup = (group) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          finalFixtures.push({ team1: group[i], team2: group[j] });
          finalFixtures.push({ team1: group[j], team2: group[i] });
        }
      }
    };
    addSameGroup(groupA);
    addSameGroup(groupB);
    
    // Play other group once
    for (let i = 0; i < groupA.length; i++) {
      for (let j = 0; j < groupB.length; j++) {
        finalFixtures.push({ team1: groupA[i], team2: groupB[j] });
      }
    }
    
    // Play corresponding team in other group twice
    for (let i = 0; i < groupA.length; i++) {
      finalFixtures.push({ team1: groupB[i], team2: groupA[i] });
    }

    // Goal: Partition matches into rounds
    const rounds = Array.from({ length: roundsCount }, () => []);
    const teamRoundBusy = {};
    [...groupA, ...groupB].forEach(t => { teamRoundBusy[t] = Array(roundsCount).fill(false); });

    // Shuffle the match pool
    for (let i = finalFixtures.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [finalFixtures[i], finalFixtures[j]] = [finalFixtures[j], finalFixtures[i]];
    }

    const unplaced = [];
    finalFixtures.forEach(match => {
      let placed = false;
      for (let r = 0; r < roundsCount; r++) {
        if (!teamRoundBusy[match.team1][r] && !teamRoundBusy[match.team2][r] && rounds[r].length < matchesPerRound) {
          rounds[r].push(match);
          teamRoundBusy[match.team1][r] = true;
          teamRoundBusy[match.team2][r] = true;
          placed = true;
          break;
        }
      }
      if (!placed) unplaced.push(match);
    });

    unplaced.forEach(match => {
      for (let r = 0; r < roundsCount; r++) {
        if (rounds[r].length < matchesPerRound) {
          rounds[r].push(match);
          break;
        }
      }
    });

    const scheduledFixtures = rounds.flat();
    let currentDate = new Date('2026-03-22');
    return scheduledFixtures.map((f, index) => {
      if (index > 0 && index % 2 === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return {
        matchId: index + 1,
        team1: f.team1,
        team2: f.team2,
        date: currentDate.toISOString().split('T')[0],
        result: null
      };
    });
  }

  simulateUntilUserMatch() {
    while (this.data.currentMatchIndex < this.data.fixtures.length) {
      const match = this.data.fixtures[this.data.currentMatchIndex];
      if (match.team1 === this.data.userTeamId || match.team2 === this.data.userTeamId) {
        break;
      }
      this.simulateMatch(match);
      this.data.currentMatchIndex++;
    }
  }

  simulateMatch(match) {
    const isBattingFirstWins = Math.random() < 0.52;
    const team1Score = this.generateRealisticScore();
    const team2Result = this.generateChase(team1Score.runs, isBattingFirstWins);
    
    const winner = isBattingFirstWins ? match.team1 : match.team2;
    
    match.result = {
      winner,
      team1: team1Score,
      team2: team2Result
    };

    this.updateStatsFromSim(match);
  }

  generateRealisticScore() {
    let runs;
    const rand = Math.random();
    const minRPO = config.tournamentSettings.minTargetRPO;
    const maxRPO = config.tournamentSettings.maxTargetRPO;
    const avgRPO = (minRPO + maxRPO) / 2;
    const range = maxRPO - minRPO;

    if (rand < 0.6) {
      // Average scoring
      runs = (avgRPO * config.tournamentSettings.oversPerMatch) + (Math.random() - 0.5) * (range * 0.5 * config.tournamentSettings.oversPerMatch); 
    } else if (rand < 0.8) {
      // Low scoring
      runs = (minRPO * config.tournamentSettings.oversPerMatch) + Math.random() * (range * 0.3 * config.tournamentSettings.oversPerMatch);
    } else {
      // High scoring
      runs = (maxRPO * config.tournamentSettings.oversPerMatch) - Math.random() * (range * 0.3 * config.tournamentSettings.oversPerMatch);
    }
    const wickets = 2 + Math.floor(Math.random() * 9);
    return { runs: Math.floor(runs), wickets, overs: config.tournamentSettings.oversPerMatch };
  }

  generateChase(target, winnerIsBattingFirst) {
    if (winnerIsBattingFirst) {
      const runs = target - 1 - Math.floor(Math.random() * 5);
      const wickets = 8 + Math.floor(Math.random() * 3);
      return { runs, wickets, overs: config.tournamentSettings.oversPerMatch };
    } else {
      const runs = target + 1 + Math.floor(Math.random() * 5);
      const wickets = 2 + Math.floor(Math.random() * 8);
      const overs = (config.tournamentSettings.oversPerMatch / 2) + Math.random() * (config.tournamentSettings.oversPerMatch / 2 - 0.1);
      return { runs, wickets, overs: parseFloat(overs.toFixed(1)) };
    }
  }

  updateStatsFromSim(match) {
    const t1 = IPL_ROSTER.teams.find(t => t.id === match.team1);
    const t2 = IPL_ROSTER.teams.find(t => t.id === match.team2);
    this.distributeStats(t1, match.result.team1, t2);
    this.distributeStats(t2, match.result.team2, t1);
  }

  distributeStats(battingTeam, scorecard, bowlingTeam) {
    const { runs, wickets, overs } = scorecard;
    const players = battingTeam.players;
    const distribution = [0.35, 0.20, 0.15, 0.10, 0.05, 0.05, 0.05];
    players.forEach((p, i) => {
      const pStats = this.data.stats[p.name];
      pStats.batting.matches++;
      if (i < 7) {
        pStats.batting.innings++;
        const pRuns = Math.floor(runs * (distribution[i] * (0.8 + Math.random() * 0.4)));
        pStats.batting.runs += pRuns;
        pStats.batting.highScore = Math.max(pStats.batting.highScore, pRuns);
        if (pRuns >= 100) pStats.batting.hundreds++;
        else if (pRuns >= 50) pStats.batting.fifties++;
        const pSixes = Math.floor(pRuns / 15 * Math.random());
        const pFours = Math.floor((pRuns - pSixes * 6) / 6 * (0.5 + Math.random()));
        pStats.batting.fours += pFours;
        pStats.batting.sixes += pSixes;
        pStats.batting.lastFive.push(pRuns);
        if (pStats.batting.lastFive.length > 5) pStats.batting.lastFive.shift();
        const sr = 120 + Math.random() * 60;
        const balls = Math.floor((pRuns / sr) * 100);
        pStats.batting.ballsFaced += balls;
      }
    });
    const bowlers = bowlingTeam.players.slice(-5);
    bowlers.forEach(b => {
      const bStats = this.data.stats[b.name];
      bStats.bowling.matches++;
      const bOvers = Math.min(4, overs / 5);
      const bBalls = Math.floor(bOvers * 6);
      bStats.bowling.balls += bBalls;
      bStats.bowling.overs = parseFloat((bStats.bowling.balls / 6).toFixed(1));
      const bWickets = Math.floor(wickets * (Math.random() / 2.5));
      bStats.bowling.wickets += bWickets;
      const bRuns = Math.floor(runs / 5 * (0.8 + Math.random() * 0.4));
      bStats.bowling.runsConceded += bRuns;
      if (bWickets > bStats.bowling.bestFigures.w || (bWickets === bStats.bowling.bestFigures.w && bRuns < bStats.bowling.bestFigures.r)) {
        bStats.bowling.bestFigures = { w: bWickets, r: bRuns };
      }
    });
  }

  getPointsTable() {
    const table = {};
    IPL_ROSTER.teams.forEach(t => {
      table[t.id] = { 
        id: t.id, name: t.name, shortName: t.shortName, 
        played: 0, won: 0, lost: 0, nr: 0, points: 0, 
        runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0 
      };
    });
    this.data.fixtures.forEach(f => {
      if (!f.result) return;
      const t1 = table[f.team1];
      const t2 = table[f.team2];
      t1.played++; t2.played++;
      if (f.result.winner === f.team1) {
        t1.won++; t1.points += 2;
        t2.lost++;
      } else if (f.result.winner === f.team2) {
        t2.won++; t2.points += 2;
        t1.lost++;
      } else {
        t1.nr++; t1.points++;
        t2.nr++; t2.points++;
      }
      t1.runsScored += f.result.team1.runs;
      t1.oversFaced += f.result.team1.overs;
      t1.runsConceded += f.result.team2.runs;
      t1.oversBowled += f.result.team2.overs;
      t2.runsScored += f.result.team2.runs;
      t2.oversFaced += f.result.team2.overs;
      t2.runsConceded += f.result.team1.runs;
      t2.oversBowled += f.result.team1.overs;
    });
    return Object.values(table).map(t => {
      const nrr = (t.oversFaced > 0 && t.oversBowled > 0) 
        ? (t.runsScored / t.oversFaced) - (t.runsConceded / t.oversBowled)
        : 0;
      return { ...t, nrr: parseFloat(nrr.toFixed(3)) };
    }).sort((a, b) => b.points - a.points || b.nrr - a.nrr);
  }

  getNextMatch() {
    if (this.data.isKnockouts) {
      return this.data.knockoutFixtures.find(f => !f.result);
    }
    return this.data.fixtures[this.data.currentMatchIndex];
  }

  recordUserMatchResult(result, userBattingStats, oppBowlingStats) {
    const match = this.getNextMatch();
    match.result = result;
    userBattingStats.forEach(s => {
      const pStats = this.data.stats[s.name];
      if (pStats) {
        pStats.batting.matches++;
        pStats.batting.innings++;
        pStats.batting.runs += s.runs;
        pStats.batting.ballsFaced += s.balls;
        pStats.batting.highScore = Math.max(pStats.batting.highScore, s.runs);
        if (s.runs >= 100) pStats.batting.hundreds++;
        else if (s.runs >= 50) pStats.batting.fifties++;
        pStats.batting.fours += s.fours || 0;
        pStats.batting.sixes += s.sixes || 0;
        pStats.batting.lastFive.push(s.runs);
        if (pStats.batting.lastFive.length > 5) pStats.batting.lastFive.shift();
      }
    });
    oppBowlingStats.forEach(s => {
      const pStats = this.data.stats[s.name];
      if (pStats) {
        pStats.bowling.matches++;
        pStats.bowling.balls += s.balls;
        pStats.bowling.overs = parseFloat((pStats.bowling.balls / 6).toFixed(1));
        pStats.bowling.runsConceded += s.runs;
        pStats.bowling.wickets += s.wickets;
        if (s.wickets > pStats.bowling.bestFigures.w || (s.wickets === pStats.bowling.bestFigures.w && s.runs < pStats.bowling.bestFigures.r)) {
          pStats.bowling.bestFigures = { w: s.wickets, r: s.runs };
        }
      }
    });

    if (this.data.isKnockouts) {
      this.resolveKnockouts();
    } else {
      this.data.currentMatchIndex++;
      if (this.data.currentMatchIndex >= this.data.fixtures.length) {
        this.initKnockouts();
      } else {
        this.simulateUntilUserMatch();
        if (this.data.currentMatchIndex >= this.data.fixtures.length) {
          this.initKnockouts();
        }
      }
    }
    this.save();
  }

  initKnockouts() {
    const top4 = this.getPointsTable().slice(0, 4);
    this.data.isKnockouts = true;
    this.data.knockoutFixtures = [
      { id: 'q1', name: 'Qualifier 1', team1: top4[0].id, team2: top4[1].id, result: null },
      { id: 'el', name: 'Eliminator', team1: top4[2].id, team2: top4[3].id, result: null }
    ];
  }

  resolveKnockouts() {
    const q1 = this.data.knockoutFixtures.find(f => f.id === 'q1');
    const el = this.data.knockoutFixtures.find(f => f.id === 'el');
    if (q1?.result && el?.result && !this.data.knockoutFixtures.find(f => f.id === 'q2')) {
      const q1Loser = q1.result.winner === q1.team1 ? q1.team2 : q1.team1;
      const elWinner = el.result.winner;
      this.data.knockoutFixtures.push({ id: 'q2', name: 'Qualifier 2', team1: q1Loser, team2: elWinner, result: null });
    } else {
      const q2 = this.data.knockoutFixtures.find(f => f.id === 'q2');
      if (q2?.result && !this.data.knockoutFixtures.find(f => f.id === 'final')) {
        const q1Winner = q1.result.winner;
        const q2Winner = q2.result.winner;
        this.data.knockoutFixtures.push({ id: 'final', name: 'Final', team1: q1Winner, team2: q2Winner, result: null });
      } else {
        const final = this.data.knockoutFixtures.find(f => f.id === 'final');
        if (final?.result) {
          this.data.winner = final.result.winner;
        }
      }
    }
    this.checkUserElimination();
  }

  checkUserElimination() {
    const table = this.getPointsTable();
    const isTop4 = table.slice(0, 4).some(t => t.id === this.data.userTeamId);
    if (!this.data.isKnockouts && this.data.currentMatchIndex >= this.data.fixtures.length && !isTop4) {
      this.simulateRemainingKnockouts();
      return;
    }
    if (this.data.isKnockouts) {
      const activeMatch = this.getNextMatch();
      if (activeMatch && activeMatch.team1 !== this.data.userTeamId && activeMatch.team2 !== this.data.userTeamId) {
        this.simulateMatch(activeMatch);
        this.resolveKnockouts();
      } else if (!activeMatch && !this.data.winner) {
        this.simulateRemainingKnockouts();
      }
    }
  }

  simulateRemainingKnockouts() {
    while (!this.data.winner) {
      const match = this.getNextMatch();
      if (!match) break;
      this.simulateMatch(match);
      this.resolveKnockouts();
    }
    this.save();
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = null;
  }
}

export const tournament = new TournamentState();
