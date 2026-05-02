export const ROSTER = {
  teams: [
    {
      id: 'india', name: 'India', shortName: 'IND', color: '#1E88E5', flagEmoji: '🇮🇳',
      players: [
        { name: "Rohit Sharma", skill: 90 }, { name: "Shubman Gill", skill: 85 },
        { name: "Virat Kohli", skill: 95 }, { name: "Shreyas Iyer", skill: 80 },
        { name: "KL Rahul", skill: 82 }, { name: "Hardik Pandya", skill: 88, bowlType: 'fast' },
        { name: "Ravindra Jadeja", skill: 89, bowlType: 'spin' }, { name: "Axar Patel", skill: 80, bowlType: 'spin' },
        { name: "Kuldeep Yadav", skill: 84, bowlType: 'spin' }, { name: "Jasprit Bumrah", skill: 96, bowlType: 'fast' },
        { name: "Mohammed Siraj", skill: 86, bowlType: 'fast' }
      ]
    },
    {
      id: 'australia', name: 'Australia', shortName: 'AUS', color: '#FFC107', flagEmoji: '🇦🇺',
      players: [
        { name: "David Warner", skill: 88 }, { name: "Travis Head", skill: 87 },
        { name: "Mitch Marsh", skill: 85, bowlType: 'fast' }, { name: "Steve Smith", skill: 92 },
        { name: "Glenn Maxwell", skill: 89, bowlType: 'spin' }, { name: "Marcus Stoinis", skill: 82, bowlType: 'fast' },
        { name: "Alex Carey", skill: 80 }, { name: "Pat Cummins", skill: 93, bowlType: 'fast' },
        { name: "Mitchell Starc", skill: 90, bowlType: 'fast' }, { name: "Adam Zampa", skill: 86, bowlType: 'spin' },
        { name: "Josh Hazlewood", skill: 88, bowlType: 'fast' }
      ]
    },
    {
      id: 'england', name: 'England', shortName: 'ENG', color: '#E53935', flagEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      players: [
        { name: "Jos Buttler", skill: 91 }, { name: "Phil Salt", skill: 83 },
        { name: "Will Jacks", skill: 81, bowlType: 'spin' }, { name: "Jonny Bairstow", skill: 85 },
        { name: "Harry Brook", skill: 86 }, { name: "Moeen Ali", skill: 82, bowlType: 'spin' },
        { name: "Sam Curran", skill: 85, bowlType: 'fast' }, { name: "Chris Woakes", skill: 84, bowlType: 'fast' },
        { name: "Adil Rashid", skill: 88, bowlType: 'spin' }, { name: "Mark Wood", skill: 87, bowlType: 'fast' },
        { name: "Jofra Archer", skill: 90, bowlType: 'fast' }
      ]
    },
    {
      id: 'south_africa', name: 'South Africa', shortName: 'RSA', color: '#43A047', flagEmoji: '🇿🇦',
      players: [
        { name: "Quinton de Kock", skill: 89 }, { name: "Reeza Hendricks", skill: 81 },
        { name: "Rassie vd Dussen", skill: 84 }, { name: "Aiden Markram", skill: 86, bowlType: 'spin' },
        { name: "Heinrich Klaasen", skill: 90 }, { name: "David Miller", skill: 88 },
        { name: "Marco Jansen", skill: 83, bowlType: 'fast' }, { name: "Keshav Maharaj", skill: 85, bowlType: 'spin' },
        { name: "Kagiso Rabada", skill: 91, bowlType: 'fast' }, { name: "Lungi Ngidi", skill: 84, bowlType: 'fast' },
        { name: "Tabraiz Shamsi", skill: 86, bowlType: 'spin' }
      ]
    },
    {
      id: 'new_zealand', name: 'New Zealand', shortName: 'NZ', color: '#424242', flagEmoji: '🇳🇿',
      players: [
        { name: "Finn Allen", skill: 81 }, { name: "Devon Conway", skill: 87 },
        { name: "Kane Williamson", skill: 92 }, { name: "Daryl Mitchell", skill: 86, bowlType: 'fast' },
        { name: "Glenn Phillips", skill: 85, bowlType: 'spin' }, { name: "Jimmy Neesham", skill: 82, bowlType: 'fast' },
        { name: "Mitchell Santner", skill: 85, bowlType: 'spin' }, { name: "Tim Southee", skill: 87, bowlType: 'fast' },
        { name: "Trent Boult", skill: 90, bowlType: 'fast' }, { name: "Lockie Ferguson", skill: 86, bowlType: 'fast' },
        { name: "Ish Sodhi", skill: 83, bowlType: 'spin' }
      ]
    },
    {
      id: 'pakistan', name: 'Pakistan', shortName: 'PAK', color: '#1B5E20', flagEmoji: '🇵🇰',
      players: [
        { name: "Babar Azam", skill: 93 }, { name: "Mohammad Rizwan", skill: 88 },
        { name: "Fakhar Zaman", skill: 84 }, { name: "Iftikhar Ahmed", skill: 81, bowlType: 'spin' },
        { name: "Shadab Khan", skill: 85, bowlType: 'spin' }, { name: "Imad Wasim", skill: 83, bowlType: 'spin' },
        { name: "Shaheen Afridi", skill: 92, bowlType: 'fast' }, { name: "Naseem Shah", skill: 87, bowlType: 'fast' },
        { name: "Haris Rauf", skill: 86, bowlType: 'fast' }, { name: "Usama Mir", skill: 80, bowlType: 'spin' },
        { name: "Abrar Ahmed", skill: 82, bowlType: 'spin' }
      ]
    },
    {
      id: 'sri_lanka', name: 'Sri Lanka', shortName: 'SL', color: '#1A237E', flagEmoji: '🇱🇰',
      players: [
        { name: "Pathum Nissanka", skill: 84 }, { name: "Kusal Mendis", skill: 83 },
        { name: "Sadeera Samarawickrama", skill: 81 }, { name: "Charith Asalanka", skill: 82 },
        { name: "Dasun Shanaka", skill: 80, bowlType: 'fast' }, { name: "Wanindu Hasaranga", skill: 89, bowlType: 'spin' },
        { name: "Maheesh Theekshana", skill: 86, bowlType: 'spin' }, { name: "Matheesha Pathirana", skill: 85, bowlType: 'fast' },
        { name: "Dushmantha Chameera", skill: 84, bowlType: 'fast' }, { name: "Dilshan Madushanka", skill: 83, bowlType: 'fast' },
        { name: "Angelo Mathews", skill: 82, bowlType: 'fast' }
      ]
    },
    {
      id: 'west_indies', name: 'West Indies', shortName: 'WI', color: '#880E4F', flagEmoji: '🏝️',
      players: [
        { name: "Brandon King", skill: 82 }, { name: "Kyle Mayers", skill: 81, bowlType: 'fast' },
        { name: "Nicholas Pooran", skill: 89 }, { name: "Shai Hope", skill: 85 },
        { name: "Rovman Powell", skill: 83, bowlType: 'fast' }, { name: "Andre Russell", skill: 88, bowlType: 'fast' },
        { name: "Jason Holder", skill: 84, bowlType: 'fast' }, { name: "Akeal Hosein", skill: 85, bowlType: 'spin' },
        { name: "Alzarri Joseph", skill: 86, bowlType: 'fast' }, { name: "Gudakesh Motie", skill: 82, bowlType: 'spin' },
        { name: "Shamar Joseph", skill: 83, bowlType: 'fast' }
      ]
    },
    {
      id: 'bangladesh', name: 'Bangladesh', shortName: 'BAN', color: '#004D40', flagEmoji: '🇧🇩',
      players: [
        { name: "Litton Das", skill: 82 }, { name: "Tanzid Hasan", skill: 78 },
        { name: "Najmul Hossain Shanto", skill: 81 }, { name: "Shakib Al Hasan", skill: 88, bowlType: 'spin' },
        { name: "Towhid Hridoy", skill: 80 }, { name: "Mushfiqur Rahim", skill: 84 },
        { name: "Mahmudullah", skill: 82, bowlType: 'spin' }, { name: "Mehidy Hasan Miraz", skill: 83, bowlType: 'spin' },
        { name: "Taskin Ahmed", skill: 85, bowlType: 'fast' }, { name: "Mustafizur Rahman", skill: 86, bowlType: 'fast' },
        { name: "Shoriful Islam", skill: 81, bowlType: 'fast' }
      ]
    },
    {
      id: 'afghanistan', name: 'Afghanistan', shortName: 'AFG', color: '#0D47A1', flagEmoji: '🇦🇫',
      players: [
        { name: "Rahmanullah Gurbaz", skill: 84 }, { name: "Ibrahim Zadran", skill: 83 },
        { name: "Rahmat Shah", skill: 80 }, { name: "Hashmatullah Shahidi", skill: 81 },
        { name: "Azmatullah Omarzai", skill: 82, bowlType: 'fast' }, { name: "Mohammad Nabi", skill: 85, bowlType: 'spin' },
        { name: "Rashid Khan", skill: 93, bowlType: 'spin' }, { name: "Mujeeb Ur Rahman", skill: 87, bowlType: 'spin' },
        { name: "Fazalhaq Farooqi", skill: 84, bowlType: 'fast' }, { name: "Naveen-ul-Haq", skill: 83, bowlType: 'fast' },
        { name: "Noor Ahmad", skill: 82, bowlType: 'spin' }
      ]
    }
  ]
};

export function getTeam(id) {
  return ROSTER.teams.find(t => t.id === id) || ROSTER.teams[0];
}

export function getRandomOpponent(excludeId) {
  const available = ROSTER.teams.filter(t => t.id !== excludeId);
  return available[Math.floor(Math.random() * available.length)];
}

/** Last 5 players of each team are the bowling specialists */
export function getBowlers(teamId) {
  const team = getTeam(teamId);
  return team.players.slice(-5);
}
