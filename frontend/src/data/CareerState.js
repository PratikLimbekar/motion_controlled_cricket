const STORAGE_KEY = 'cricket_career_state';

export class CareerState {
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

  init(playerName) {
    this.data = {
      playerName,
      currentStage: 'domestic', // domestic, ipl, international
      reputation: 0,
      iplTotalRuns: 0,
      completedScenarios: [], // Array of scenario IDs
      
      // Stats across formats
      stats: {
        test: this.getInitialStats(),
        odi: this.getInitialStats(),
        t20: this.getInitialStats(),
        ipl: this.getInitialStats()
      },
      
      // Narrative milestones
      milestones: {
        iplCallup: false,
        nationalCallup: false,
        worldCupWinner: false
      },
      
      // Series progress
      series: {
        currentSeriesId: null,
        matchesPlayedInSeries: 0,
        seriesWins: 0
      }
    };
    this.save();
  }

  getInitialStats() {
    return {
      matches: 0,
      innings: 0,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      highScore: 0,
      fifties: 0,
      hundreds: 0,
      average: 0,
      strikeRate: 0
    };
  }

  updateStats(format, stats) {
    if (!this.data.stats[format]) return;
    const s = this.data.stats[format];
    s.matches++;
    s.innings++;
    s.runs += stats.runs;
    s.balls += stats.balls;
    s.fours += stats.fours;
    s.sixes += stats.sixes;
    s.highScore = Math.max(s.highScore, stats.runs);
    
    if (stats.runs >= 100) s.hundreds++;
    else if (stats.runs >= 50) s.fifties++;
    
    // Recalculate Avg/SR
    s.average = s.innings > 0 ? parseFloat((s.runs / s.innings).toFixed(2)) : 0;
    s.strikeRate = s.balls > 0 ? parseFloat(((s.runs / s.balls) * 100).toFixed(2)) : 0;
    
    // IPL specific milestone tracking
    if (format === 'ipl') {
      this.data.iplTotalRuns += stats.runs;
    }
    
    this.save();
  }

  completeScenario(scenarioId, repGained) {
    if (!this.data) return;
    if (!this.data.completedScenarios.includes(scenarioId)) {
      this.data.completedScenarios.push(scenarioId);
      this.data.reputation += repGained;
      this.save();
    }
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = null;
  }
}

export const career = new CareerState();
