/**
 * Bot Database — WINGGO
 * 1000 unique realistic Indian player bots
 * Generated deterministically — no hardcoded array bloat
 */

export interface BotPlayer {
  id: number;
  name: string;
  city: string;
  initial: string;
  avatarColor: string;
}

const MALE_NAMES = [
  "Amit", "Rahul", "Vikas", "Suresh", "Arjun", "Rohit", "Deepak", "Raj",
  "Sanjay", "Nikhil", "Vivek", "Karan", "Ravi", "Ajay", "Anil", "Vikram",
  "Mahesh", "Ramesh", "Dinesh", "Sunil", "Prakash", "Ashok", "Govind", "Manoj",
  "Rajan", "Ritesh", "Sumit", "Tarun", "Ankit", "Gaurav", "Harsh", "Yash",
  "Dev", "Aakash", "Sahil", "Pranav", "Rohan", "Varun", "Shyam", "Hari",
  "Mohit", "Naveen", "Pankaj", "Sandeep", "Rajesh", "Saurabh", "Tushar", "Umesh",
  "Vijay", "Yogesh",
];

const FEMALE_NAMES = [
  "Priya", "Pooja", "Anjali", "Neha", "Sneha", "Divya", "Riya", "Kavita",
  "Rekha", "Sunita", "Meena", "Nisha", "Geeta", "Ananya", "Shreya", "Isha",
  "Simran", "Komal", "Sonal", "Swati", "Vandana", "Usha", "Tanya", "Radha",
  "Pinky", "Payal", "Nidhi", "Mona", "Lata", "Kiran",
];

const SURNAMES = [
  "Kumar", "Sharma", "Singh", "Verma", "Gupta", "Patel", "Mishra", "Yadav",
  "Joshi", "Tiwari", "Pandey", "Dubey", "Saxena", "Agarwal", "Mehta", "Shah",
  "Nair", "Pillai", "Reddy", "Rao", "Iyer", "Das", "Bose", "Chauhan",
  "Pathak", "Srivastava",
];

const CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune",
  "Ahmedabad", "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal",
  "Patna", "Ludhiana", "Agra", "Nashik", "Vadodara", "Surat", "Rajkot",
  "Meerut", "Varanasi", "Allahabad", "Amritsar", "Jodhpur", "Coimbatore",
  "Vijayawada", "Visakhapatnam", "Ranchi", "Guwahati", "Chandigarh",
  "Thiruvananthapuram", "Kochi", "Bhubaneswar", "Dehradun", "Raipur",
  "Agartala", "Imphal", "Shillong",
];

const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e",
];

const SUFFIXES_STYLED = [
  "_Pro", "_King", "_Star", "_Boss", "_Elite",
  "_Gamer", "_Champion", "_Legend", "_Master", "_Ace",
];

let _bots: BotPlayer[] | null = null;

function buildBots(): BotPlayer[] {
  const bots: BotPlayer[] = [];
  const allFirst = [...MALE_NAMES, ...FEMALE_NAMES]; // 80

  // Pattern A: FirstName_Surname  (80 × 26 = 2080 possible — we take first 700)
  outer:
  for (const first of allFirst) {
    for (const last of SURNAMES) {
      if (bots.length >= 700) break outer;
      bots.push({
        id: bots.length,
        name: `${first}_${last}`,
        city: CITIES[bots.length % CITIES.length],
        initial: first[0].toUpperCase(),
        avatarColor: AVATAR_COLORS[bots.length % AVATAR_COLORS.length],
      });
    }
  }

  // Pattern B: FirstName_Surname + _Pro/_King/etc  (200 more)
  let b = 0;
  while (bots.length < 900) {
    const first = allFirst[b % allFirst.length];
    const last  = SURNAMES[(b * 3) % SURNAMES.length];
    const sfx   = SUFFIXES_STYLED[b % SUFFIXES_STYLED.length];
    bots.push({
      id: bots.length,
      name: `${first}_${last}${sfx}`,
      city: CITIES[(bots.length * 7) % CITIES.length],
      initial: first[0].toUpperCase(),
      avatarColor: AVATAR_COLORS[bots.length % AVATAR_COLORS.length],
    });
    b++;
  }

  // Pattern C: FirstName + 2-digit number  (100 more)
  let c = 0;
  while (bots.length < 1000) {
    const first = allFirst[c % allFirst.length];
    const num   = 10 + (c % 90);
    bots.push({
      id: bots.length,
      name: `${first}${num}`,
      city: CITIES[(bots.length * 13) % CITIES.length],
      initial: first[0].toUpperCase(),
      avatarColor: AVATAR_COLORS[bots.length % AVATAR_COLORS.length],
    });
    c++;
  }

  return bots;
}

function getBots(): BotPlayer[] {
  if (!_bots) _bots = buildBots();
  return _bots;
}

/** Pick a uniformly random bot from the 1000-bot pool */
export function getRandomBot(): BotPlayer {
  const bots = getBots();
  return bots[Math.floor(Math.random() * bots.length)];
}

/** Get a specific bot by index (wraps around) */
export function getBotByIndex(idx: number): BotPlayer {
  const bots = getBots();
  return bots[Math.abs(Math.floor(idx)) % bots.length];
}

/** Total number of bots in the database */
export const BOT_COUNT = 1000;
