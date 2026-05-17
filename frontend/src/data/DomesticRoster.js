export const DOMESTIC_ROSTER = {
  teams: [
    {
      id: 'mumbai', name: 'Mumbai', shortName: 'MUM', color: '#1E88E5', flagEmoji: '🏏',
      players: [
        { name: "Prithvi Shaw", skill: 85 }, { name: "Yashasvi Jaiswal", skill: 88 },
        { name: "Ajinkya Rahane", skill: 84 }, { name: "Sarfaraz Khan", skill: 86 },
        { name: "Suryakumar Yadav", skill: 92 }, { name: "Shivam Dube", skill: 84, bowlType: 'fast' },
        { name: "Shams Mulani", skill: 80, bowlType: 'spin' }, { name: "Shardul Thakur", skill: 85, bowlType: 'fast' },
        { name: "Tanush Kotian", skill: 78, bowlType: 'spin' }, { name: "Dhawal Kulkarni", skill: 82, bowlType: 'fast' },
        { name: "Tushar Deshpande", skill: 83, bowlType: 'fast' }
      ]
    },
    {
      id: 'karnataka', name: 'Karnataka', shortName: 'KAR', color: '#FFEB3B', flagEmoji: '🏏',
      players: [
        { name: "Mayank Agarwal", skill: 86 }, { name: "Devdutt Padikkal", skill: 84 },
        { name: "Manish Pandey", skill: 85 }, { name: "Karun Nair", skill: 82 },
        { name: "KL Rahul", skill: 90 }, { name: "Krishnappa Gowtham", skill: 81, bowlType: 'spin' },
        { name: "Shreyas Gopal", skill: 80, bowlType: 'spin' }, { name: "Jagadeesha Suchith", skill: 78, bowlType: 'spin' },
        { name: "Prasidh Krishna", skill: 88, bowlType: 'fast' }, { name: "Vidwath Kaverappa", skill: 83, bowlType: 'fast' },
        { name: "Vyshak Vijay Kumar", skill: 82, bowlType: 'fast' }
      ]
    },
    {
      id: 'delhi', name: 'Delhi', shortName: 'DEL', color: '#E53935', flagEmoji: '🏏',
      players: [
        { name: "Shikhar Dhawan", skill: 87 }, { name: "Prithvi Shaw", skill: 83 },
        { name: "Rishabh Pant", skill: 91 }, { name: "Nitish Rana", skill: 84 },
        { name: "Yash Dhull", skill: 79 }, { name: "Lalit Yadav", skill: 80, bowlType: 'spin' },
        { name: "Axar Patel", skill: 88, bowlType: 'spin' }, { name: "Ishant Sharma", skill: 86, bowlType: 'fast' },
        { name: "Navdeep Saini", skill: 84, bowlType: 'fast' }, { name: "Kuldeep Yadav", skill: 87, bowlType: 'spin' },
        { name: "Khaleel Ahmed", skill: 85, bowlType: 'fast' }
      ]
    }
  ]
};

export function getDomesticTeam(id) {
  return DOMESTIC_ROSTER.teams.find(t => t.id === id) || DOMESTIC_ROSTER.teams[0];
}

export function getDomesticBowlers(teamId) {
  const team = getDomesticTeam(teamId);
  return team.players.slice(-5);
}
