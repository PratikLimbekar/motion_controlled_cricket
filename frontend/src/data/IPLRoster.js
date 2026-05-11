export const IPL_ROSTER = {
  teams: [
    {
      id: 'csk', name: 'Chennai Super Kings', shortName: 'CSK', color: '#FFFF3C', flagEmoji: '🦁',
      players: [
        { name: "Ruturaj Gaikwad", skill: 88 }, { name: "Sanju Samson", skill: 85 },
        { name: "Ajinkya Rahane", skill: 82 }, { name: "Ayush Mhatre", skill: 87 },
        { name: "Urvil Patel", skill: 86 }, { name: "Dewald Brevis", skill: 89, bowlType: 'spin' },
        { name: "MS Dhoni", skill: 90 }, { name: "Shivam Dube", skill: 83, bowlType: 'fast' },
        { name: "Deepak Chahar", skill: 84, bowlType: 'fast' }, { name: "Tushar Deshpande", skill: 82, bowlType: 'fast' },
        { name: "Maheesh Theekshana", skill: 85, bowlType: 'spin' }
      ]
    },
    {
      id: 'mi', name: 'Mumbai Indians', shortName: 'MI', color: '#004BA0', flagEmoji: '🌊',
      players: [
        { name: "Rohit Sharma", skill: 90 }, { name: "Ishan Kishan", skill: 86 },
        { name: "Suryakumar Yadav", skill: 94 }, { name: "Tilak Varma", skill: 85 },
        { name: "Hardik Pandya", skill: 88, bowlType: 'fast' }, { name: "Tim David", skill: 84 },
        { name: "Mohammad Nabi", skill: 82, bowlType: 'spin' }, { name: "Gerald Coetzee", skill: 85, bowlType: 'fast' },
        { name: "Piyush Chawla", skill: 83, bowlType: 'spin' }, { name: "Jasprit Bumrah", skill: 96, bowlType: 'fast' },
        { name: "Akash Madhwal", skill: 81, bowlType: 'fast' }
      ]
    },
    {
      id: 'rcb', name: 'Royal Challengers Bengaluru', shortName: 'RCB', color: '#EC1C24', flagEmoji: '👑',
      players: [
        { name: "Faf du Plessis", skill: 89 }, { name: "Virat Kohli", skill: 95 },
        { name: "Rajat Patidar", skill: 84 }, { name: "Glenn Maxwell", skill: 89, bowlType: 'spin' },
        { name: "Cameron Green", skill: 86, bowlType: 'fast' }, { name: "Dinesh Karthik", skill: 87 },
        { name: "Mahipal Lomror", skill: 80 }, { name: "Alzarri Joseph", skill: 84, bowlType: 'fast' },
        { name: "Karn Sharma", skill: 81, bowlType: 'spin' }, { name: "Mohammed Siraj", skill: 88, bowlType: 'fast' },
        { name: "Yash Dayal", skill: 82, bowlType: 'fast' }
      ]
    },
    {
      id: 'kkr', name: 'Kolkata Knight Riders', shortName: 'KKR', color: '#3A225D', flagEmoji: '💜',
      players: [
        { name: "Phil Salt", skill: 87 }, { name: "Sunil Narine", skill: 90, bowlType: 'spin' },
        { name: "Venkatesh Iyer", skill: 84 }, { name: "Shreyas Iyer", skill: 86 },
        { name: "Rinku Singh", skill: 88 }, { name: "Andre Russell", skill: 92, bowlType: 'fast' },
        { name: "Ramandeep Singh", skill: 81 }, { name: "Mitchell Starc", skill: 91, bowlType: 'fast' },
        { name: "Harshit Rana", skill: 83, bowlType: 'fast' }, { name: "Varun Chakaravarthy", skill: 87, bowlType: 'spin' },
        { name: "Vaibhav Arora", skill: 82, bowlType: 'fast' }
      ]
    },
    {
      id: 'dc', name: 'Delhi Capitals', shortName: 'DC', color: '#00008B', flagEmoji: '🐯',
      players: [
        { name: "David Warner", skill: 88 }, { name: "Prithvi Shaw", skill: 83 },
        { name: "Jake Fraser-McGurk", skill: 86 }, { name: "Rishabh Pant", skill: 91 },
        { name: "Tristan Stubbs", skill: 85 }, { name: "Axar Patel", skill: 88, bowlType: 'spin' },
        { name: "Sumit Kumar", skill: 78 }, { name: "Kuldeep Yadav", skill: 89, bowlType: 'spin' },
        { name: "Anrich Nortje", skill: 87, bowlType: 'fast' }, { name: "Khaleel Ahmed", skill: 84, bowlType: 'fast' },
        { name: "Mukesh Kumar", skill: 83, bowlType: 'fast' }
      ]
    },
    {
      id: 'rr', name: 'Rajasthan Royals', shortName: 'RR', color: '#EA1A85', flagEmoji: '🏰',
      players: [
        { name: "Yashasvi Jaiswal", skill: 89 }, { name: "Vaibhav Sooryavanshi", skill: 92 },
        { name: "Jos Buttler", skill: 90 }, { name: "Riyan Parag", skill: 86 },
        { name: "Dhruv Jurel", skill: 82 }, { name: "Shimron Hetmyer", skill: 85 },
        { name: "Ravichandran Ashwin", skill: 87, bowlType: 'spin' }, { name: "Trent Boult", skill: 91, bowlType: 'fast' },
        { name: "Avesh Khan", skill: 84, bowlType: 'fast' }, { name: "Sandeep Sharma", skill: 83, bowlType: 'fast' },
        { name: "Yuzvendra Chahal", skill: 88, bowlType: 'spin' }
      ]
    },
    {
      id: 'srh', name: 'Sunrisers Hyderabad', shortName: 'SRH', color: '#F26522', flagEmoji: '🦅',
      players: [
        { name: "Travis Head", skill: 91 }, { name: "Abhishek Sharma", skill: 87 },
        { name: "Aiden Markram", skill: 85 }, { name: "Heinrich Klaasen", skill: 93 },
        { name: "Nitish Reddy", skill: 82, bowlType: 'fast' }, { name: "Abdul Samad", skill: 81 },
        { name: "Shahbaz Ahmed", skill: 83, bowlType: 'spin' }, { name: "Pat Cummins", skill: 92, bowlType: 'fast' },
        { name: "Bhuvneshwar Kumar", skill: 86, bowlType: 'fast' }, { name: "Mayank Markande", skill: 82, bowlType: 'spin' },
        { name: "T Natarajan", skill: 85, bowlType: 'fast' }
      ]
    },
    {
      id: 'pbks', name: 'Punjab Kings', shortName: 'PBKS', color: '#ED1B24', flagEmoji: '🦁',
      players: [
        { name: "Shikhar Dhawan", skill: 86 }, { name: "Jonny Bairstow", skill: 85 },
        { name: "Prabhsimran Singh", skill: 81 }, { name: "Sam Curran", skill: 87, bowlType: 'fast' },
        { name: "Liam Livingstone", skill: 88, bowlType: 'spin' }, { name: "Shashank Singh", skill: 83 },
        { name: "Jitesh Sharma", skill: 82 }, { name: "Harpreet Brar", skill: 84, bowlType: 'spin' },
        { name: "Harshal Patel", skill: 85, bowlType: 'fast' }, { name: "Kagiso Rabada", skill: 90, bowlType: 'fast' },
        { name: "Arshdeep Singh", skill: 87, bowlType: 'fast' }
      ]
    },
    {
      id: 'lsg', name: 'Lucknow Super Giants', shortName: 'LSG', color: '#0057E7', flagEmoji: '🏏',
      players: [
        { name: "KL Rahul", skill: 89 }, { name: "Quinton de Kock", skill: 88 },
        { name: "Devdutt Padikkal", skill: 81 }, { name: "Marcus Stoinis", skill: 86, bowlType: 'fast' },
        { name: "Nicholas Pooran", skill: 90 }, { name: "Ayush Badoni", skill: 82 },
        { name: "Krunal Pandya", skill: 85, bowlType: 'spin' }, { name: "Ravi Bishnoi", skill: 87, bowlType: 'spin' },
        { name: "Mohsin Khan", skill: 83, bowlType: 'fast' }, { name: "Mayank Yadav", skill: 86, bowlType: 'fast' },
        { name: "Naveen-ul-Haq", skill: 84, bowlType: 'fast' }
      ]
    },
    {
      id: 'gt', name: 'Gujarat Titans', shortName: 'GT', color: '#0B2135', flagEmoji: '⚡',
      players: [
        { name: "Shubman Gill", skill: 91 }, { name: "Wriddhiman Saha", skill: 82 },
        { name: "Sai Sudharsan", skill: 85 }, { name: "David Miller", skill: 88 },
        { name: "Azmatullah Omarzai", skill: 83, bowlType: 'fast' }, { name: "Rahul Tewatia", skill: 84 },
        { name: "Rashid Khan", skill: 94, bowlType: 'spin' }, { name: "Umesh Yadav", skill: 83, bowlType: 'fast' },
        { name: "Spencer Johnson", skill: 82, bowlType: 'fast' }, { name: "Mohit Sharma", skill: 85, bowlType: 'fast' },
        { name: "Noor Ahmad", skill: 84, bowlType: 'spin' }
      ]
    }
  ]
};

export function getIPLTeam(id) {
  return IPL_ROSTER.teams.find(t => t.id === id);
}
